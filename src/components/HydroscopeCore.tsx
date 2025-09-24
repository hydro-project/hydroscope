/**
 * HydroscopeCore - Main React component that manages VisualizationState lifecycle
 * Architectural constraints: Manages async coordination, proper React state management
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { VisualizationState } from '../core/VisualizationState.js';
import { AsyncCoordinator } from '../core/AsyncCoordinator.js';
import { InteractionHandler } from '../core/InteractionHandler.js';
import { ReactFlowBridge } from '../bridges/ReactFlowBridge.js';
import { ELKBridge } from '../bridges/ELKBridge.js';
import type { 
  LayoutConfig, 
  StyleConfig, 
  ReactFlowData, 
  LayoutState,
  QueueStatus 
} from '../types/core.js';

export interface HydroscopeCoreProps {
  /** Initial layout configuration */
  layoutConfig?: LayoutConfig;
  /** Style configuration for nodes and edges */
  styleConfig?: StyleConfig;
  /** Enable automatic layout on state changes */
  autoLayout?: boolean;
  /** Layout update debounce delay in milliseconds */
  layoutDebounceDelay?: number;
  /** Callback when ReactFlow data is updated */
  onDataUpdate?: (data: ReactFlowData) => void;
  /** Callback when layout state changes */
  onLayoutStateChange?: (state: LayoutState) => void;
  /** Callback when async operations status changes */
  onAsyncStatusChange?: (status: QueueStatus) => void;
  /** Callback for error handling */
  onError?: (error: Error, context: string) => void;
  /** Enable debug logging */
  debug?: boolean;
}

export interface HydroscopeCoreRef {
  /** Get the VisualizationState instance */
  getVisualizationState: () => VisualizationState;
  /** Get the AsyncCoordinator instance */
  getAsyncCoordinator: () => AsyncCoordinator;
  /** Get the InteractionHandler instance */
  getInteractionHandler: () => InteractionHandler;
  /** Trigger manual layout update */
  triggerLayout: () => Promise<void>;
  /** Get current ReactFlow data */
  getReactFlowData: () => ReactFlowData | null;
  /** Update layout configuration */
  updateLayoutConfig: (config: Partial<LayoutConfig>) => void;
  /** Update style configuration */
  updateStyleConfig: (config: Partial<StyleConfig>) => void;
  /** Clear all async operations */
  clearAsyncOperations: () => void;
}

export const HydroscopeCore = React.forwardRef<HydroscopeCoreRef, HydroscopeCoreProps>(
  ({
    layoutConfig = {},
    styleConfig = {},
    autoLayout = true,
    layoutDebounceDelay = 300,
    onDataUpdate,
    onLayoutStateChange,
    onAsyncStatusChange,
    onError,
    debug = false
  }, ref) => {
    // Core instances - created once and reused
    const visualizationStateRef = useRef<VisualizationState | null>(null);
    const asyncCoordinatorRef = useRef<AsyncCoordinator | null>(null);
    const interactionHandlerRef = useRef<InteractionHandler | null>(null);
    const reactFlowBridgeRef = useRef<ReactFlowBridge | null>(null);
    const elkBridgeRef = useRef<ELKBridge | null>(null);
    
    // Layout debounce timer
    const layoutTimerRef = useRef<NodeJS.Timeout | null>(null);
    
    // React state for UI updates
    const [reactFlowData, setReactFlowData] = useState<ReactFlowData | null>(null);
    const [layoutState, setLayoutState] = useState<LayoutState>({
      phase: 'initial',
      layoutCount: 0,
      lastUpdate: Date.now()
    });
    const [asyncStatus, setAsyncStatus] = useState<QueueStatus>({
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      totalProcessed: 0,
      averageProcessingTime: 0,
      errors: []
    });

    // Debug logging helper
    const debugLog = useCallback((message: string, data?: any) => {
      if (debug) {
        console.log(`[HydroscopeCore] ${message}`, data);
      }
    }, [debug]);

    // Error handling helper
    const handleError = useCallback((error: Error, context: string) => {
      debugLog(`Error in ${context}:`, error);
      if (onError) {
        onError(error, context);
      } else {
        console.error(`[HydroscopeCore] Error in ${context}:`, error);
      }
    }, [onError, debugLog]);

    // Initialize core instances
    useEffect(() => {
      try {
        debugLog('Initializing core instances');
        
        // Create VisualizationState
        visualizationStateRef.current = new VisualizationState();
        
        // Create AsyncCoordinator
        asyncCoordinatorRef.current = new AsyncCoordinator();
        
        // Create bridges
        reactFlowBridgeRef.current = new ReactFlowBridge(styleConfig);
        elkBridgeRef.current = new ELKBridge(layoutConfig);
        
        // Create InteractionHandler
        interactionHandlerRef.current = new InteractionHandler(
          visualizationStateRef.current,
          asyncCoordinatorRef.current
        );

        debugLog('Core instances initialized successfully');
        
        // Set initial layout state
        const initialLayoutState = visualizationStateRef.current.getLayoutState();
        setLayoutState(initialLayoutState);
        
        // Set initial async status
        const initialAsyncStatus = asyncCoordinatorRef.current.getQueueStatus();
        setAsyncStatus(initialAsyncStatus);
        
      } catch (error) {
        handleError(error as Error, 'initialization');
      }
    }, []); // Empty dependency array - initialize once

    // Update bridges when configs change
    useEffect(() => {
      if (reactFlowBridgeRef.current) {
        debugLog('Updating ReactFlow bridge style config');
        reactFlowBridgeRef.current = new ReactFlowBridge(styleConfig);
      }
    }, [styleConfig, debugLog]);

    useEffect(() => {
      if (elkBridgeRef.current) {
        debugLog('Updating ELK bridge layout config');
        elkBridgeRef.current.updateConfiguration(layoutConfig);
      }
    }, [layoutConfig, debugLog]);

    // Debounced layout trigger
    const triggerLayoutDebounced = useCallback(() => {
      if (layoutTimerRef.current) {
        clearTimeout(layoutTimerRef.current);
      }
      
      layoutTimerRef.current = setTimeout(() => {
        triggerLayoutImmediate();
      }, layoutDebounceDelay);
    }, [layoutDebounceDelay]);

    // Immediate layout trigger
    const triggerLayoutImmediate = useCallback(async () => {
      if (!visualizationStateRef.current || !asyncCoordinatorRef.current || !elkBridgeRef.current) {
        return;
      }

      try {
        debugLog('Triggering layout update');
        
        // Queue ELK layout operation
        await asyncCoordinatorRef.current.queueELKLayout(
          visualizationStateRef.current,
          elkBridgeRef.current.getConfiguration()
        );
        
        // Update layout state
        const newLayoutState = visualizationStateRef.current.getLayoutState();
        setLayoutState(newLayoutState);
        
        // Update async status
        const newAsyncStatus = asyncCoordinatorRef.current.getQueueStatus();
        setAsyncStatus(newAsyncStatus);
        
        // Generate new ReactFlow data
        await updateReactFlowData();
        
        debugLog('Layout update completed');
        
      } catch (error) {
        handleError(error as Error, 'layout update');
      }
    }, [debugLog, handleError]);

    // Update ReactFlow data
    const updateReactFlowData = useCallback(async () => {
      if (!visualizationStateRef.current || !reactFlowBridgeRef.current || !interactionHandlerRef.current) {
        return;
      }

      try {
        debugLog('Updating ReactFlow data');
        
        // Generate ReactFlow data with interaction handlers
        const newData = reactFlowBridgeRef.current.toReactFlowData(
          visualizationStateRef.current,
          interactionHandlerRef.current
        );
        
        setReactFlowData(newData);
        
        if (onDataUpdate) {
          onDataUpdate(newData);
        }
        
        debugLog('ReactFlow data updated', { nodeCount: newData.nodes.length, edgeCount: newData.edges.length });
        
      } catch (error) {
        handleError(error as Error, 'ReactFlow data update');
      }
    }, [onDataUpdate, debugLog, handleError]);

    // Monitor layout state changes
    useEffect(() => {
      if (onLayoutStateChange) {
        onLayoutStateChange(layoutState);
      }
    }, [layoutState, onLayoutStateChange]);

    // Monitor async status changes
    useEffect(() => {
      if (onAsyncStatusChange) {
        onAsyncStatusChange(asyncStatus);
      }
    }, [asyncStatus, onAsyncStatusChange]);

    // Auto-layout when enabled
    useEffect(() => {
      if (autoLayout && visualizationStateRef.current) {
        // Set up a periodic check for state changes that require layout
        const checkInterval = setInterval(() => {
          if (visualizationStateRef.current) {
            const currentLayoutState = visualizationStateRef.current.getLayoutState();
            if (currentLayoutState.phase === 'initial' || 
                (currentLayoutState.lastUpdate > layoutState.lastUpdate && 
                 currentLayoutState.phase !== 'laying_out' && 
                 currentLayoutState.phase !== 'rendering')) {
              triggerLayoutDebounced();
            }
          }
        }, 100); // Check every 100ms

        return () => clearInterval(checkInterval);
      }
    }, [autoLayout, layoutState.lastUpdate, triggerLayoutDebounced]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        debugLog('Cleaning up HydroscopeCore');
        
        if (layoutTimerRef.current) {
          clearTimeout(layoutTimerRef.current);
        }
        
        if (interactionHandlerRef.current) {
          interactionHandlerRef.current.cleanup();
        }
        
        if (asyncCoordinatorRef.current) {
          asyncCoordinatorRef.current.clearQueue();
        }
        
        if (reactFlowBridgeRef.current) {
          reactFlowBridgeRef.current.clearCaches();
        }
      };
    }, [debugLog]);

    // Expose ref methods
    React.useImperativeHandle(ref, () => ({
      getVisualizationState: () => {
        if (!visualizationStateRef.current) {
          throw new Error('VisualizationState not initialized');
        }
        return visualizationStateRef.current;
      },
      
      getAsyncCoordinator: () => {
        if (!asyncCoordinatorRef.current) {
          throw new Error('AsyncCoordinator not initialized');
        }
        return asyncCoordinatorRef.current;
      },
      
      getInteractionHandler: () => {
        if (!interactionHandlerRef.current) {
          throw new Error('InteractionHandler not initialized');
        }
        return interactionHandlerRef.current;
      },
      
      triggerLayout: triggerLayoutImmediate,
      
      getReactFlowData: () => reactFlowData,
      
      updateLayoutConfig: (config: Partial<LayoutConfig>) => {
        if (elkBridgeRef.current) {
          elkBridgeRef.current.updateConfiguration(config);
          if (autoLayout) {
            triggerLayoutDebounced();
          }
        }
      },
      
      updateStyleConfig: (config: Partial<StyleConfig>) => {
        if (reactFlowBridgeRef.current) {
          reactFlowBridgeRef.current = new ReactFlowBridge({ ...styleConfig, ...config });
          updateReactFlowData();
        }
      },
      
      clearAsyncOperations: () => {
        if (asyncCoordinatorRef.current) {
          asyncCoordinatorRef.current.clearQueue();
          const newAsyncStatus = asyncCoordinatorRef.current.getQueueStatus();
          setAsyncStatus(newAsyncStatus);
        }
      }
    }), [reactFlowData, autoLayout, triggerLayoutImmediate, triggerLayoutDebounced, updateReactFlowData, styleConfig]);

    // Memoized status for performance
    const status = useMemo(() => ({
      layoutState,
      asyncStatus,
      reactFlowData,
      isInitialized: !!(visualizationStateRef.current && asyncCoordinatorRef.current),
      isLayouting: layoutState.phase === 'laying_out' || layoutState.phase === 'rendering',
      hasErrors: asyncStatus.errors.length > 0
    }), [layoutState, asyncStatus, reactFlowData]);

    // This component doesn't render anything directly - it's a headless component
    // The ReactFlow data is provided through callbacks and ref methods
    return null;
  }
);

HydroscopeCore.displayName = 'HydroscopeCore';