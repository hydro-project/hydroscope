/**
 * HydroscopeCore - Minimal visualization component
 * 
 * This component provides core graph visualization and interaction functionality
 * without UI enhancements like file upload, search panels, or styling controls.
 * 
 * Key Features:
 * - Parse and render JSON input data
 * - Handle node selection, expansion, and collapse operations
 * - Manage container state and visual feedback
 * - Provide error handling for invalid JSON
 * - Integrate with VisualizationState, ReactFlowBridge, and ELKBridge through AsyncCoordinator
 * - Ensure all ReactFlow and ELK operations are coordinated through AsyncCoordinator
 * 
 * Architecture:
 * - Uses existing VisualizationState for data management
 * - All operations go through AsyncCoordinator for proper sequencing
 * - Atomic state change -> re-layout -> render pipeline
 * - Error boundaries for graceful failure handling
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "./nodes/index.js";
import { edgeTypes } from "./edges/index.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { InteractionHandler } from "../core/InteractionHandler.js";
import { JSONParser } from "../utils/JSONParser.js";
import { ErrorBoundary } from "./ErrorBoundary.js";

import type { HydroscopeData, ReactFlowData } from "../types/core.js";

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Props interface for the HydroscopeCore component
 * 
 * Provides minimal configuration options for core visualization functionality
 * without any UI enhancement features.
 */
export interface HydroscopeCoreProps {
  /** JSON data to visualize */
  data: HydroscopeData;
  
  /** Height of the visualization container */
  height?: string | number;
  
  /** Width of the visualization container */
  width?: string | number;
  
  /** Whether to show ReactFlow controls */
  showControls?: boolean;
  
  /** Whether to show minimap */
  showMiniMap?: boolean;
  
  /** Whether to show background pattern */
  showBackground?: boolean;
  
  /** Enable container collapse/expand */
  enableCollapse?: boolean;
  
  /** Initial layout algorithm */
  initialLayoutAlgorithm?: string;
  
  /** Initial color palette */
  initialColorPalette?: string;
  
  /** Callback when node is clicked */
  onNodeClick?: (
    event: React.MouseEvent,
    node: { id: string; data?: unknown; position?: { x: number; y: number } },
    visualizationState?: VisualizationState,
  ) => void;
  
  /** Callback when container is collapsed */
  onContainerCollapse?: (
    containerId: string,
    visualizationState?: VisualizationState,
  ) => void;
  
  /** Callback when container is expanded */
  onContainerExpand?: (
    containerId: string,
    visualizationState?: VisualizationState,
  ) => void;
  
  /** Callback when error occurs */
  onError?: (error: Error) => void;
  
  /** Optional custom styling */
  className?: string;
  
  /** Optional style overrides */
  style?: React.CSSProperties;
}

/**
 * Internal state interface for the HydroscopeCore component
 * 
 * Manages all component state including data, UI state, and coordination
 * with v6 architecture components.
 */
interface HydroscopeCoreState {
  /** V6 VisualizationState instance for graph operations */
  visualizationState: VisualizationState | null;
  
  /** V6 AsyncCoordinator for managing async operations */
  asyncCoordinator: AsyncCoordinator | null;
  
  /** ReactFlow data for rendering */
  reactFlowData: ReactFlowData;
  
  /** Error state */
  error: Error | null;
  
  /** Loading state */
  isLoading: boolean;
}

// ============================================================================
// Internal ReactFlow Component
// ============================================================================

/**
 * Internal component that uses ReactFlow hooks
 * This component must be wrapped in ReactFlowProvider
 */
const HydroscopeCoreInternal: React.FC<HydroscopeCoreProps> = ({
  data,
  height = "100%",
  width = "100%",
  showControls = true,
  showMiniMap = true,
  showBackground = true,

  initialLayoutAlgorithm = "layered",
  onNodeClick,
  onContainerCollapse,
  onContainerExpand,
  onError,
  className,
  style,
}) => {
  // ReactFlow instance for programmatic control
  const reactFlowInstance = useReactFlow();
  
  // State management
  const [state, setState] = useState<HydroscopeCoreState>({
    visualizationState: null,
    asyncCoordinator: null,
    reactFlowData: { nodes: [], edges: [] },
    error: null,
    isLoading: true,
  });

  // Refs for core instances
  const reactFlowBridgeRef = useRef<ReactFlowBridge | null>(null);
  const elkBridgeRef = useRef<ELKBridge | null>(null);
  const interactionHandlerRef = useRef<InteractionHandler | null>(null);
  const jsonParserRef = useRef<JSONParser | null>(null);



  // Error handling helper with recovery strategies
  const handleError = useCallback(
    (error: Error, context?: string) => {
      console.error(`[HydroscopeCore] Error${context ? ` in ${context}` : ''}:`, error);
      
      // Enhanced error message based on context
      let userFriendlyMessage = error.message;
      
      if (context === 'data parsing') {
        userFriendlyMessage = `Failed to parse visualization data: ${error.message}. Please check that your data is in the correct format.`;
      } else if (context === 'layout') {
        userFriendlyMessage = `Layout calculation failed: ${error.message}. The visualization may not display correctly.`;
      } else if (context === 'ReactFlow data update') {
        userFriendlyMessage = `Failed to update visualization: ${error.message}. Try refreshing the component.`;
      } else if (context === 'container interaction' || context === 'node click') {
        userFriendlyMessage = `Interaction failed: ${error.message}. The element may be in an invalid state.`;
      }
      
      const enhancedError = new Error(userFriendlyMessage);
      enhancedError.stack = error.stack;
      
      setState(prev => ({ ...prev, error: enhancedError, isLoading: false }));
      onError?.(enhancedError);
    },
    [onError]
  );

  // Initialize core instances
  useEffect(() => {
    try {
      console.log('[HydroscopeCore] Initializing core instances');
      
      // Create VisualizationState
      const visualizationState = new VisualizationState();
      
      // Create AsyncCoordinator
      const asyncCoordinator = new AsyncCoordinator();
      
      // Create bridges
      reactFlowBridgeRef.current = new ReactFlowBridge({
        nodeStyles: {},
        edgeStyles: {},
        semanticMappings: {},
        propertyMappings: {},
      });
      
      elkBridgeRef.current = new ELKBridge({
        algorithm: initialLayoutAlgorithm,
      });
      
      // Create InteractionHandler
      interactionHandlerRef.current = new InteractionHandler(
        visualizationState,
        asyncCoordinator,
      );
      
      // Create JSONParser
      jsonParserRef.current = new JSONParser({
        debug: false,
        validateDuringParsing: true,
      });
      
      setState(prev => ({
        ...prev,
        visualizationState,
        asyncCoordinator,
        error: null,
      }));
      
      console.log('[HydroscopeCore] Core instances initialized successfully');
    } catch (error) {
      console.error('[HydroscopeCore] Initialization error:', error);
      setState(prev => ({ ...prev, error: error as Error, isLoading: false }));
    }
  }, [initialLayoutAlgorithm]);

  // Validate JSON data structure
  const validateData = useCallback((data: HydroscopeData): void => {
    if (!data) {
      throw new Error('Data is required');
    }
    
    if (typeof data !== 'object') {
      throw new Error('Data must be an object');
    }
    
    if (!Array.isArray(data.nodes)) {
      throw new Error('Data must contain a nodes array');
    }
    
    if (!Array.isArray(data.edges)) {
      throw new Error('Data must contain an edges array');
    }
    
    if (!Array.isArray(data.hierarchyChoices)) {
      throw new Error('Data must contain a hierarchyChoices array');
    }
    
    if (!data.nodeAssignments || typeof data.nodeAssignments !== 'object') {
      throw new Error('Data must contain a nodeAssignments object');
    }
    
    // Basic validation of nodes
    data.nodes.forEach((node, index) => {
      if (!node.id) {
        throw new Error(`Node at index ${index} is missing required 'id' field`);
      }
      // Check for either label, fullLabel, or shortLabel
      if (!node.label && !node.fullLabel && !node.shortLabel) {
        throw new Error(`Node '${node.id}' is missing label field (expected 'label', 'fullLabel', or 'shortLabel')`);
      }
    });
    
    // Basic validation of edges
    data.edges.forEach((edge, index) => {
      if (!edge.id) {
        throw new Error(`Edge at index ${index} is missing required 'id' field`);
      }
      if (!edge.source) {
        throw new Error(`Edge '${edge.id}' is missing required 'source' field`);
      }
      if (!edge.target) {
        throw new Error(`Edge '${edge.id}' is missing required 'target' field`);
      }
    });
  }, []);

  // Track if we've already processed this data to prevent infinite loops
  const processedDataRef = useRef<HydroscopeData | null>(null);
  
  // Parse data and update visualization state
  useEffect(() => {
    // Only proceed if we have data and all core instances are ready
    if (!data || !state.visualizationState || !state.asyncCoordinator || !jsonParserRef.current) {
      return;
    }
    
    // Prevent re-processing the same data
    if (processedDataRef.current === data) {
      return;
    }

    const parseAndRender = async () => {
      try {
        // Mark this data as being processed
        processedDataRef.current = data;
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        console.log('[HydroscopeCore] Parsing data and updating visualization state');
        
        // Validate data structure first
        validateData(data);
        
        // Parse JSON data into a new VisualizationState
        const parseResult = await jsonParserRef.current!.parseData(data);
        
        console.log('[HydroscopeCore] Data parsed successfully', {
          nodes: parseResult.stats.nodeCount,
          edges: parseResult.stats.edgeCount,
          containers: parseResult.stats.containerCount,
          warnings: parseResult.warnings.length,
          processingTime: parseResult.stats.processingTime,
        });

        // Log any warnings from parsing
        if (parseResult.warnings.length > 0) {
          console.warn('[HydroscopeCore] Parsing warnings:', parseResult.warnings);
        }
        
        // Validate that we got some data
        if (parseResult.stats.nodeCount === 0) {
          throw new Error('No valid nodes found in the data. Please check that your data contains valid node definitions.');
        }
        
        // Warn about potential issues but don't fail
        if (parseResult.stats.edgeCount === 0) {
          console.warn('[HydroscopeCore] No edges found in data - visualization will only show nodes');
        }
        
        if (parseResult.stats.containerCount === 0) {
          console.warn('[HydroscopeCore] No containers found in data - nodes will not be grouped');
        }
        
        // Replace our visualization state with the parsed one
        // This ensures we get all the properly parsed and validated data
        // IMPORTANT: This is the ONLY VisualizationState instance we should use
        const singleVisualizationState = parseResult.visualizationState;
        
        setState(prev => ({
          ...prev,
          visualizationState: singleVisualizationState,
        }));
        
        // Update the interaction handler with the SAME visualization state instance
        if (state.asyncCoordinator) {
          // Create a custom interaction handler that calls our callbacks
          interactionHandlerRef.current = new InteractionHandler(
            singleVisualizationState,
            state.asyncCoordinator,
          );
          
          // Override the container click handler to use AsyncCoordinator's atomic pipeline
          interactionHandlerRef.current.handleContainerClick = async (containerId: string, position?: { x: number; y: number }) => {
            try {
              console.log('[HydroscopeCore] Container interaction: starting AsyncCoordinator atomic pipeline for', containerId);
              
              // Validate container exists
              if (!containerId || !containerId.trim()) {
                console.warn('[HydroscopeCore] Invalid container ID:', containerId);
                return;
              }
              
              // Get container state before the click
              const container = singleVisualizationState.getContainer(containerId);
              if (!container) {
                console.warn('[HydroscopeCore] Container not found:', containerId);
                return;
              }
              
              const wasCollapsed = Boolean(container.collapsed);
              console.log('[HydroscopeCore] Container state before click:', { containerId, wasCollapsed });
              
              // Use AsyncCoordinator's atomic pipeline: State Change -> Layout -> ReactFlow
              if (state.asyncCoordinator) {
                // Step 1: Queue container state change through AsyncCoordinator
                const eventType = wasCollapsed ? "container_expand" : "container_collapse";
                console.log(`[HydroscopeCore] Queuing ${eventType} event through AsyncCoordinator`);
                
                await state.asyncCoordinator.queueApplicationEvent({
                  type: eventType,
                  payload: {
                    containerId,
                    state: singleVisualizationState,
                    triggerValidation: false // We'll handle ReactFlow update separately
                  },
                  timestamp: Date.now()
                });
                
                // Step 2: RESET and Queue layout update
                console.log('[HydroscopeCore] Clearing caches and queuing ELK layout through AsyncCoordinator');
                // Clear ReactFlow caches first to reset parent relationships
                if (reactFlowBridgeRef.current) {
                  console.log('[HydroscopeCore] 🔄 Clearing ReactFlow caches before layout');
                  reactFlowBridgeRef.current.clearCaches();
                }
                
                await state.asyncCoordinator.queueELKLayout(
                  singleVisualizationState,
                  elkBridgeRef.current!,
                );
                
                // Step 3: Update ReactFlow data
                console.log('[HydroscopeCore] Updating ReactFlow data after atomic pipeline');
                await updateReactFlowDataWithState(singleVisualizationState);
                
                // Verify state change occurred
                const containerAfter = singleVisualizationState.getContainer(containerId);
                const isCollapsedAfter = Boolean(containerAfter?.collapsed);
                console.log('[HydroscopeCore] Container state after atomic pipeline:', { 
                  containerId, 
                  wasCollapsed, 
                  isCollapsedAfter, 
                  stateChanged: wasCollapsed !== isCollapsedAfter 
                });
                
                // Call our callbacks based on the new state
                if (wasCollapsed && !isCollapsedAfter) {
                  console.log('[HydroscopeCore] Calling onContainerExpand callback');
                  onContainerExpand?.(containerId, singleVisualizationState);
                } else if (!wasCollapsed && isCollapsedAfter) {
                  console.log('[HydroscopeCore] Calling onContainerCollapse callback');
                  onContainerCollapse?.(containerId, singleVisualizationState);
                } else {
                  console.warn('[HydroscopeCore] Container state did not change as expected', { wasCollapsed, isCollapsedAfter });
                }
                
                console.log('[HydroscopeCore] AsyncCoordinator atomic pipeline complete');
              } else {
                console.error('[HydroscopeCore] AsyncCoordinator not available for container interaction');
              }
            } catch (error) {
              console.error('[HydroscopeCore] Error in AsyncCoordinator container pipeline:', error);
              console.log('[HydroscopeCore] Container operations often recover automatically, not showing error dialog');
              // Don't show error dialog for container operations as they often recover automatically
            }
          };
        }
        
        // Atomic pipeline step 2: Trigger layout through AsyncCoordinator
        console.log('[HydroscopeCore] Starting atomic pipeline: state change -> layout -> render');
        if (state.asyncCoordinator) {
          try {
            console.log('[HydroscopeCore] Pipeline step 2: Clearing caches and queuing ELK layout');
            // Clear caches first to ensure fresh state
            if (reactFlowBridgeRef.current) {
              console.log('[HydroscopeCore] 🔄 Clearing ReactFlow caches before initial layout');
              reactFlowBridgeRef.current.clearCaches();
            }
            
            await state.asyncCoordinator.queueELKLayout(
              singleVisualizationState,
              elkBridgeRef.current!,
            );
            console.log('[HydroscopeCore] Pipeline step 2 complete: Layout queued and processed');
          } catch (layoutError) {
            console.warn('[HydroscopeCore] Layout failed, continuing with default positions:', layoutError);
            // Continue with rendering even if layout fails - nodes will use default positions
          }
        }
        
        // Atomic pipeline step 3: Generate ReactFlow data (render)
        console.log('[HydroscopeCore] Pipeline step 3: Generating ReactFlow data');
        await updateReactFlowDataWithState(singleVisualizationState);
        console.log('[HydroscopeCore] Atomic pipeline complete: state -> layout -> render');
        
        setState(prev => ({ ...prev, isLoading: false }));
        
      } catch (error) {
        handleError(error as Error, 'data parsing');
      }
    };

    parseAndRender();
  }, [data, state.visualizationState, state.asyncCoordinator]);



  // Update ReactFlow data with a specific VisualizationState
  const updateReactFlowDataWithState = useCallback(async (visualizationState: VisualizationState) => {
    console.log('[HydroscopeCore] 🔄 updateReactFlowDataWithState called');
    if (!visualizationState || !reactFlowBridgeRef.current || !interactionHandlerRef.current) {
      console.warn('[HydroscopeCore] Cannot update ReactFlow data - missing dependencies', {
        hasVisualizationState: !!visualizationState,
        hasReactFlowBridge: !!reactFlowBridgeRef.current,
        hasInteractionHandler: !!interactionHandlerRef.current
      });
      return;
    }

    try {
      console.log('[HydroscopeCore] Updating ReactFlow data with specific state');
      
      // RESET: Clear ReactFlow caches to ensure fresh parent relationships
      console.log('[HydroscopeCore] 🔄 Clearing ReactFlow caches before data generation');
      reactFlowBridgeRef.current.clearCaches();
      
      // Log container states before generating ReactFlow data
      const containers = visualizationState.visibleContainers;
      console.log('[HydroscopeCore] Container states before ReactFlow generation:', 
        containers.map(c => ({ id: c.id, collapsed: c.collapsed, childrenCount: c.children.size }))
      );
      
      // Generate ReactFlow data with interaction handlers
      console.log('[HydroscopeCore] 🔄 Calling toReactFlowData on bridge');
      const newData = reactFlowBridgeRef.current.toReactFlowData(
        visualizationState,
        interactionHandlerRef.current,
      );
      console.log('[HydroscopeCore] 🔄 Bridge returned data with', newData.nodes.length, 'nodes');
      
      // Log the generated ReactFlow nodes to see their types and states
      console.log('[HydroscopeCore] Generated ReactFlow nodes:', 
        newData.nodes.map(n => ({ 
          id: n.id, 
          type: n.type, 
          nodeType: n.data?.nodeType, 
          collapsed: n.data?.collapsed,
          hasOnClick: !!n.data?.onClick
        }))
      );
      
      setState(prev => ({
        ...prev,
        reactFlowData: newData,
      }));

      // WORKAROUND: Force ReactFlow to recalculate positions after parent-child updates
      // This fixes the issue where child nodes cluster in upper-left after container expansion
      setTimeout(() => {
        console.log('[HydroscopeCore] 🔄 Forcing ReactFlow position recalculation and autofit');
        // Force a re-render by updating a dummy state
        setState(prev => ({ ...prev }));
        // Auto-fit the view to show the newly expanded content
        reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
      }, 100);
      
      console.log('[HydroscopeCore] ReactFlow data updated with specific state', {
        nodeCount: newData.nodes.length,
        edgeCount: newData.edges.length,
      });
    } catch (error) {
      console.error('[HydroscopeCore] Error updating ReactFlow data:', error);
      setState(prev => ({ ...prev, error: error as Error, isLoading: false }));
    }
  }, []);

  // Handle node clicks
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      try {
        console.log('[HydroscopeCore] Node clicked:', node.id);
        console.log('[HydroscopeCore] Node type:', node.type);
        console.log('[HydroscopeCore] Node data:', { 
          nodeType: node.data?.nodeType, 
          collapsed: node.data?.collapsed,
          hasOnClick: !!node.data?.onClick
        });
        
        // Validate node data
        if (!node || !node.id) {
          console.warn('[HydroscopeCore] Invalid node clicked:', node);
          return;
        }
        
        // Check if this is a container node
        if (node.data && node.data.nodeType === 'container') {
          console.log('[HydroscopeCore] Container node clicked:', node.id);
          
          // Call the container onClick handler if it exists (this will handle the state update and callbacks)
          if (node.data.onClick && typeof node.data.onClick === 'function') {
            console.log('[HydroscopeCore] Calling container onClick handler');
            node.data.onClick(node.id, 'container');
          }
          
          // Don't call the callbacks here - they're handled by the container interaction handler
          // to avoid duplicate calls and state conflicts
        }
        
        // Always call the general node click callback
        if (onNodeClick) {
          onNodeClick(
            event,
            {
              id: node.id,
              data: node.data,
              position: node.position,
            },
            state.visualizationState || undefined,
          );
        }
      } catch (error) {
        console.error('[HydroscopeCore] Error handling node click:', error);
        console.error('[HydroscopeCore] Error handling node click:', error);
        setState(prev => ({ ...prev, error: error as Error, isLoading: false }));
      }
    },
    [onNodeClick, onContainerCollapse, onContainerExpand, state.visualizationState]
  );



  // Memoized container dimensions
  const containerStyle = useMemo(() => ({
    height: typeof height === 'number' ? `${height}px` : height,
    width: typeof width === 'number' ? `${width}px` : width,
    ...style,
  }), [height, width, style]);

  // Retry mechanism
  const handleRetry = useCallback(() => {
    console.log('[HydroscopeCore] Retrying after error');
    setState(prev => ({ ...prev, error: null, isLoading: true }));
    // The useEffect will automatically re-run when error is cleared
  }, []);

  // Error state rendering
  if (state.error) {
    return (
      <div 
        className={className}
        style={{
          ...containerStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          padding: '20px',
          color: '#d32f2f',
          backgroundColor: '#ffeaea',
          border: '1px solid #ffcdd2',
          borderRadius: '4px',
        }}
      >
        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
          Visualization Error
        </h3>
        <p style={{ margin: '0 0 15px 0', fontSize: '14px', textAlign: 'center', maxWidth: '400px' }}>
          {state.error.message}
        </p>
        <button
          onClick={handleRetry}
          style={{
            padding: '8px 16px',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Loading state rendering
  if (state.isLoading) {
    return (
      <div 
        className={className}
        style={{
          ...containerStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
          backgroundColor: '#f5f5f5',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid #e0e0e0',
            borderTop: '3px solid #1976d2',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 10px',
          }} />
          <p style={{ margin: '0', fontSize: '14px' }}>
            Loading visualization...
          </p>
        </div>
      </div>
    );
  }

  console.log('[HydroscopeCore] Rendering ReactFlow with', state.reactFlowData.nodes.length, 'nodes');
  console.log('[HydroscopeCore] Node types:', state.reactFlowData.nodes.map(n => ({ id: n.id, type: n.type, nodeType: n.data?.nodeType })));
  
  return (
    <div 
      className={className} 
      style={{
        ...containerStyle,
        position: 'relative',
        pointerEvents: 'auto'
      }}
      onClick={() => console.log('[HydroscopeCore] Container div clicked')}
    >
      <ReactFlow
        key={`reactflow-reset-${Date.now()}`}
        nodes={state.reactFlowData.nodes as Node[]}
        edges={state.reactFlowData.edges as any[]}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={() => console.log('[HydroscopeCore] Pane clicked - ReactFlow is receiving events')}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.01}
        maxZoom={3}
        defaultViewport={{ x: 0, y: 0, zoom: 0.3 }}
        style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}
      >
        {showBackground && <Background />}
        {showControls && <Controls />}
        {showMiniMap && <MiniMap />}
      </ReactFlow>
      
      {/* CSS for loading spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ============================================================================
// Main HydroscopeCore Component
// ============================================================================

/**
 * HydroscopeCore - Minimal visualization component
 * 
 * Provides core graph visualization and interaction functionality without
 * UI enhancements. Must be provided with JSON data to visualize.
 */
export const HydroscopeCore: React.FC<HydroscopeCoreProps> = memo((props) => {
  return (
    <ErrorBoundary
      fallback={(_, __, retry, ___) => (
        <div style={{
          height: typeof props.height === 'number' ? `${props.height}px` : props.height || '100%',
          width: typeof props.width === 'number' ? `${props.width}px` : props.width || '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#d32f2f',
          backgroundColor: '#ffeaea',
          border: '1px solid #ffcdd2',
          borderRadius: '4px',
          padding: '20px',
        }}>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
              Component Error
            </h3>
            <p style={{ margin: '0 0 15px 0', fontSize: '14px' }}>
              An unexpected error occurred while rendering the visualization.
            </p>
            <button 
              onClick={retry}
              style={{
                padding: '8px 16px',
                backgroundColor: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}
    >
      <ReactFlowProvider>
        <HydroscopeCoreInternal {...props} />
      </ReactFlowProvider>
    </ErrorBoundary>
  );
});

HydroscopeCore.displayName = 'HydroscopeCore';