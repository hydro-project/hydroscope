/**
 * useFlowGraphController
 * Encapsulates FlowGraph state management: engine/bridge, layout runs,
 * config updates, ReactFlow data, and event handlers. Behavior-preserving.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow, applyNodeChanges, type NodeMouseHandler, type EdgeMouseHandler } from '@xyflow/react';

import { createVisualizationEngine } from '../core/VisualizationEngine';
import { ReactFlowBridge } from '../bridges/ReactFlowBridge';
import { useManualPositions } from './useManualPositions';
import { UI_CONSTANTS } from '../shared/config';
import type { VisualizationState } from '../core/VisualizationState';
import type { ReactFlowData } from '../bridges/ReactFlowBridge';
import type { RenderConfig, FlowGraphEventHandlers, LayoutConfig } from '../core/types';

export interface UseFlowGraphControllerArgs {
  visualizationState: VisualizationState;
  config: RenderConfig;
  layoutConfig?: LayoutConfig;
  eventHandlers?: FlowGraphEventHandlers;
}

export interface UseFlowGraphControllerReturn {
  reactFlowData: ReactFlowData | null;
  loading: boolean;
  error: string | null;
  refreshLayout: (force?: boolean) => Promise<void>;
  fitOnce: () => void;
  // Handlers
  onNodeClick: NodeMouseHandler;
  onEdgeClick: EdgeMouseHandler;
  onNodeDrag: NodeMouseHandler;
  onNodeDragStop: NodeMouseHandler;
  onNodesChange: (changes: any[]) => void;
}

export function useFlowGraphController({
  visualizationState,
  config,
  layoutConfig,
  eventHandlers,
}: UseFlowGraphControllerArgs): UseFlowGraphControllerReturn {
  const [reactFlowData, setReactFlowData] = useState<ReactFlowData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { fitView } = useReactFlow();

  // Manual position management
  const { manualPositions, applyManualPositions } = useManualPositions();

  // Track the base layout data (before manual positioning)
  const baseReactFlowDataRef = useRef<ReactFlowData | null>(null);

  // Track the last fit operation to prevent excessive fits
  const lastFitTimeRef = useRef<number>(0);
  const autoFitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create bridge and engine (stable instances)
  const bridge = useMemo(() => new ReactFlowBridge(), []);
  const engine = useMemo(
    () =>
      createVisualizationEngine(visualizationState, {
        autoLayout: true,
        enableLogging: false,
        layoutConfig: layoutConfig,
      }),
    [visualizationState]
  );

  // Cleanup timeout on unmount
  useEffect(
    () => () => {
      if (autoFitTimeoutRef.current) clearTimeout(autoFitTimeoutRef.current);
    },
    []
  );

  const fitOnce = useCallback(() => {
    try {
      fitView({ 
        padding: UI_CONSTANTS.FIT_VIEW_PADDING, 
        maxZoom: UI_CONSTANTS.FIT_VIEW_MAX_ZOOM, 
        duration: UI_CONSTANTS.FIT_VIEW_DURATION 
      });
      lastFitTimeRef.current = Date.now();
    } catch (err) {
      console.warn('[FlowGraph] ⚠️ fitOnce failed:', err);
    }
  }, [fitView]);

  const refreshLayout = useCallback(
    async (force?: boolean) => {
      try {
        setLoading(true);
        setError(null);

        // Forcing a refresh should not reset layoutCount (which would re-trigger smart collapse).
        // We still allow updated layoutConfig to be applied, but avoid autoReLayout=true which resets counters.
        if (force && layoutConfig) {
          engine.updateLayoutConfig({ ...layoutConfig }, false);
        }

        // Check if we should use selective layout
        const lastChangedContainer = visualizationState.getLastChangedContainer();
        if (lastChangedContainer && !force) {
          // Use selective layout for individual container changes
          await engine.runSelectiveLayout(lastChangedContainer);
          visualizationState.clearLastChangedContainer();
        } else {
          // Use full layout for other cases
          await engine.runLayout();
        }

        const baseData = bridge.convertVisualizationState(visualizationState);
        baseReactFlowDataRef.current = baseData;
        const dataWithManual = applyManualPositions(baseData, manualPositions);
        setReactFlowData(dataWithManual);

        if (config.fitView !== false) {
          setTimeout(() => {
            try {
              fitView({ 
                padding: UI_CONSTANTS.FIT_VIEW_PADDING, 
                maxZoom: UI_CONSTANTS.FIT_VIEW_MAX_ZOOM, 
                duration: UI_CONSTANTS.FIT_VIEW_DURATION 
              });
              lastFitTimeRef.current = Date.now();
            } catch (err) {
              console.warn('[FlowGraph] ⚠️ Auto-fit failed during refresh:', err);
            }
          }, 200);
        }
      } catch (err) {
        console.error('[FlowGraph] ❌ Failed to refresh layout:', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [
      applyManualPositions,
      bridge,
      config.fitView,
      engine,
      fitView,
      manualPositions,
      visualizationState,
    ]
  );

  // Listen to layout config changes (when data already present)
  useEffect(() => {
    if (!layoutConfig || !reactFlowData) return;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        engine.updateLayoutConfig(layoutConfig, false);
        await engine.runLayout();
        const baseData = bridge.convertVisualizationState(visualizationState);
        baseReactFlowDataRef.current = baseData;
        const withManual = applyManualPositions(
          baseData,
          visualizationState.getAllManualPositions()
        );
        setReactFlowData(withManual);
      } catch (err) {
        console.error('[FlowGraph] ❌ Failed to apply layout change:', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [layoutConfig]);

  // Listen to config changes (palette, edge styles)
  useEffect(() => {
    // Palette
    if (config?.colorPalette) {
      bridge.setColorPalette(config.colorPalette);
      setReactFlowData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          nodes: prev.nodes.map(n => ({
            ...n,
            data: { ...n.data, colorPalette: config.colorPalette },
          })),
        };
      });
    }
    // Edge style config
    if (config?.edgeStyleConfig) {
      bridge.setEdgeStyleConfig(config.edgeStyleConfig);
    }
  }, [config?.colorPalette, config?.edgeStyleConfig, bridge]);

  // Listen to visualization state changes
  useEffect(() => {
    const handle = async () => {
      try {
        const state = engine.getState();
        if (state.phase === 'laying_out') {
          // Skip; engine busy
          return;
        }

        setLoading(true);
        setError(null);
        await engine.runLayout();
        const baseData = bridge.convertVisualizationState(visualizationState);
        baseReactFlowDataRef.current = baseData;
        const withManual = applyManualPositions(baseData, manualPositions);
        setReactFlowData(withManual);

        if (config.fitView !== false) {
          const now = Date.now();
          const since = now - lastFitTimeRef.current;
          if (autoFitTimeoutRef.current) clearTimeout(autoFitTimeoutRef.current);
          const delay = since > UI_CONSTANTS.LAYOUT_DELAY_THRESHOLD 
            ? UI_CONSTANTS.LAYOUT_DELAY_SHORT 
            : UI_CONSTANTS.LAYOUT_DELAY_NORMAL;
          autoFitTimeoutRef.current = setTimeout(() => {
            try {
              fitView({ 
                padding: UI_CONSTANTS.FIT_VIEW_PADDING, 
                maxZoom: UI_CONSTANTS.FIT_VIEW_MAX_ZOOM, 
                duration: UI_CONSTANTS.FIT_VIEW_DURATION 
              });
              lastFitTimeRef.current = Date.now();
            } catch (err) {
              console.warn('[FlowGraph] ⚠️ Auto-fit failed:', err);
            }
          }, delay);
        }
      } catch (err) {
        console.error('[FlowGraph] ❌ Failed to update visualization:', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    handle();
    // Alpha: only initial render; real change detection would add listeners
  }, [visualizationState, engine, bridge, applyManualPositions]);

  // Update ReactFlow positions when manual positions change (no re-layout)
  useEffect(() => {
    if (baseReactFlowDataRef.current && visualizationState.hasAnyManualPositions()) {
      const updated = applyManualPositions(
        baseReactFlowDataRef.current,
        visualizationState.getAllManualPositions()
      );
      setReactFlowData(updated);
    }
  }, [visualizationState, applyManualPositions]);

  // Event handlers
  const onNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      // Check if this is a container node
      const container = visualizationState.getContainer(node.id);

      if (container) {
        // For container nodes, call the event handler FIRST (to change container state)
        // then do click animation logic AFTER the container state has changed
        eventHandlers?.onNodeClick?.(event, node);

        // Set isClicked: true for the clicked node, false for all others
        visualizationState.visibleNodes.forEach(n => {
          visualizationState.updateNode(n.id, { isClicked: n.id === node.id });
        });

        // Note: Don't call refreshLayout here for containers - the container handler will do its own layout refresh
      } else {
        // For regular nodes, do click animation logic first, then call event handler
        // Set isClicked: true for the clicked node, false for all others
        visualizationState.visibleNodes.forEach(n => {
          visualizationState.updateNode(n.id, { isClicked: n.id === node.id });
        });

        // Trigger a refresh to update node ordering
        refreshLayout(false);

        // Call the original event handler if provided
        eventHandlers?.onNodeClick?.(event, node);
      }
    },
    [eventHandlers, visualizationState, refreshLayout]
  );

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (event, edge) => {
      eventHandlers?.onEdgeClick?.(event, edge);
    },
    [eventHandlers]
  );

  const onNodeDrag: NodeMouseHandler = useCallback(
    (event, node) => {
      eventHandlers?.onNodeDrag?.(event, node);
    },
    [eventHandlers]
  );

  const onNodeDragStop: NodeMouseHandler = useCallback(
    (event, node) => {
      visualizationState.setManualPosition(node.id, node.position.x, node.position.y);

      if (config.fitView !== false) {
        const now = Date.now();
        const since = now - lastFitTimeRef.current;
        if (autoFitTimeoutRef.current) clearTimeout(autoFitTimeoutRef.current);
        if (since > UI_CONSTANTS.LAYOUT_DELAY_THRESHOLD) {
          autoFitTimeoutRef.current = setTimeout(() => {
            try {
              fitView({ 
                padding: UI_CONSTANTS.FIT_VIEW_PADDING, 
                maxZoom: UI_CONSTANTS.FIT_VIEW_MAX_ZOOM, 
                duration: UI_CONSTANTS.FIT_VIEW_DURATION 
              });
              lastFitTimeRef.current = Date.now();
            } catch (err) {
              console.warn('[FlowGraph] ⚠️ Auto-fit after drag failed:', err);
            }
          }, 200);
        }
      }
    },
    [visualizationState, config.fitView, fitView]
  );

  const onNodesChange = useCallback((changes: any[]) => {
    setReactFlowData(prev => {
      if (!prev) return prev;
      return { ...prev, nodes: applyNodeChanges(changes, prev.nodes) };
    });
  }, []);

  return {
    reactFlowData,
    loading,
    error,
    refreshLayout,
    fitOnce,
    onNodeClick,
    onEdgeClick,
    onNodeDrag,
    onNodeDragStop,
    onNodesChange,
  };
}
