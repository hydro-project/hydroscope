/**
 * useFlowGraphController
 * Encapsulates FlowGraph state management: engine/bridge, layout runs,
 * config updates, ReactFlow data, and event handlers. Behavior-preserving.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useReactFlow,
  applyNodeChanges,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react';

import { createVisualizationEngine } from '../core/VisualizationEngine';
import { ReactFlowBridge } from '../bridges/ReactFlowBridge';
import { useManualPositions } from './useManualPositions';
import { UI_CONSTANTS } from '../shared/config';
import { getProfiler } from '../dev';
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

  // Enhanced state setter with logging
  const setReactFlowDataWithLogging = useCallback((data: ReactFlowData | null, layoutId: string) => {
    console.log(`[State] Setting ReactFlow data for layout ${layoutId}:`, {
      beforeState: reactFlowData ? {
        nodeCount: reactFlowData.nodes.length,
        edgeCount: reactFlowData.edges.length
      } : null,
      newData: data ? {
        nodeCount: data.nodes.length,
        edgeCount: data.edges.length
      } : null,
      timestamp: new Date().toISOString()
    });

    setReactFlowData(data);

    // Verify state change in next tick
    setTimeout(() => {
      console.log(`[State] State verification after layout ${layoutId}:`, {
        actualState: reactFlowData ? {
          nodeCount: reactFlowData.nodes.length,
          edgeCount: reactFlowData.edges.length
        } : null,
        expectedData: data ? {
          nodeCount: data.nodes.length,
          edgeCount: data.edges.length
        } : null
      });
    }, 0);
  }, [reactFlowData]);

  // Circuit breaker for rapid layout refreshes
  const layoutCircuitBreakerRef = useRef({
    count: 0,
    lastReset: Date.now(),
    maxCount: 5, // Max 5 layouts per reset period
    resetPeriod: 2000, // Reset every 2 seconds
  });

  // Add layout operation lock to prevent race conditions
  const layoutLockRef = useRef<string | null>(null);

  const checkCircuitBreaker = () => {
    const now = Date.now();
    const breaker = layoutCircuitBreakerRef.current;

    // Reset counter if enough time has passed
    if (now - breaker.lastReset > breaker.resetPeriod) {
      breaker.count = 0;
      breaker.lastReset = now;
    }

    // Check if we've exceeded the limit
    if (breaker.count >= breaker.maxCount) {
      console.warn(`[FlowGraphController] 🚨 Circuit breaker triggered - too many layouts (${breaker.count} in ${breaker.resetPeriod}ms)`);
      return false;
    }

    breaker.count++;
    return true;
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layoutConfig dependency causes infinite loops due to engine->layout->config feedback cycle
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
        duration: UI_CONSTANTS.FIT_VIEW_DURATION,
      });
      lastFitTimeRef.current = Date.now();
    } catch (err) {
      console.warn('[FlowGraph] ⚠️ fitOnce failed:', err);
    }
  }, [fitView]);

  const refreshLayout = useCallback(
    async (force?: boolean) => {
      // Check circuit breaker first
      if (!checkCircuitBreaker()) {
        console.warn(`[FlowGraphController] ⚠️ Layout refresh blocked by circuit breaker`);
        return;
      }

      const profiler = getProfiler();
      const timestamp = Date.now();
      const layoutId = `layout-${timestamp}`;

      // Check if another layout operation is already running
      if (layoutLockRef.current && !force) {
        console.warn(`[FlowGraphController] ⚠️ Layout refresh blocked - operation ${layoutLockRef.current} already in progress [${layoutId}]`);
        return;
      }

      // Acquire lock
      layoutLockRef.current = layoutId;

      console.log(`[FlowGraphController] 🔄 Starting refreshLayout(force=${force}) [${layoutId}]`);
      console.log(`[FlowGraphController] 📊 Current state:`, {
        hasReactFlowData: !!reactFlowData,
        nodeCount: reactFlowData?.nodes?.length || 0,
        edgeCount: reactFlowData?.edges?.length || 0,
        loading,
        error,
        manualPositionsCount: Object.keys(manualPositions).length,
        circuitBreakerCount: layoutCircuitBreakerRef.current.count,
      });

      try {
        setLoading(true);
        setError(null);

        profiler?.start('Layout Calculation');

        // Forcing a refresh should not reset layoutCount (which would re-trigger smart collapse).
        // We still allow updated layoutConfig to be applied, but avoid autoReLayout=true which resets counters.
        if (force && layoutConfig) {
          console.log(`[FlowGraphController] 🔧 Updating layout config [${layoutId}]`, layoutConfig);
          engine.updateLayoutConfig({ ...layoutConfig }, false);
        }

        // Check if we should use selective layout
        const lastChangedContainer = visualizationState.getLastChangedContainer();
        if (lastChangedContainer && !force) {
          // Use selective layout for individual container changes
          console.log(`[FlowGraphController] 🎯 Using selective layout for container: ${lastChangedContainer} [${layoutId}]`);
          profiler?.start('Selective Layout');
          await engine.runSelectiveLayout(lastChangedContainer);
          visualizationState.clearLastChangedContainer();
          profiler?.end('Selective Layout', { containerId: lastChangedContainer });
        } else {
          // Use full layout for other cases
          console.log(`[FlowGraphController] 🌐 Using full layout [${layoutId}]`);
          profiler?.start('Full Layout');
          await engine.runLayout();
          profiler?.end('Full Layout');
        }

        profiler?.end('Layout Calculation');

        profiler?.start('Rendering');
        console.log(`[FlowGraphController] 🎨 Converting visualization state to ReactFlow data [${layoutId}]`);
        const baseData = bridge.convertVisualizationState(visualizationState);
        console.log(`[FlowGraphController] 📈 Base data generated:`, {
          nodeCount: baseData.nodes.length,
          edgeCount: baseData.edges.length,
          layoutId,
        });

        baseReactFlowDataRef.current = baseData;
        const dataWithManual = applyManualPositions(baseData, manualPositions);
        console.log(`[FlowGraphController] 🎯 Final data with manual positions:`, {
          nodeCount: dataWithManual.nodes.length,
          edgeCount: dataWithManual.edges.length,
          manualPositionsApplied: Object.keys(manualPositions).length,
          layoutId,
        });

        console.log(`[FlowGraphController] 🔄 Calling setReactFlowData with:`, {
          nodeCount: dataWithManual.nodes.length,
          edgeCount: dataWithManual.edges.length,
          layoutId,
          timestamp: Date.now(),
        });
        setReactFlowDataWithLogging(dataWithManual, layoutId);
        console.log(`[FlowGraphController] ✅ setReactFlowData call completed [${layoutId}]`);

        profiler?.end('Rendering', {
          nodeCount: dataWithManual.nodes.length,
          edgeCount: dataWithManual.edges.length,
        });

        // Use a longer delay for auto-fit after layout to let the DOM settle
        if (config.fitView !== false) {
          const fitDelay = UI_CONSTANTS.LAYOUT_DELAY_NORMAL + 100; // Extra delay for stability
          setTimeout(() => {
            try {
              console.log(`[FlowGraphController] 🔍 Auto-fitting view [${layoutId}]`);
              fitView({
                padding: UI_CONSTANTS.FIT_VIEW_PADDING,
                maxZoom: UI_CONSTANTS.FIT_VIEW_MAX_ZOOM,
                duration: UI_CONSTANTS.FIT_VIEW_DURATION,
              });
              lastFitTimeRef.current = Date.now();
              console.log(`[FlowGraphController] ✅ Auto-fit completed [${layoutId}]`);
            } catch (err) {
              console.warn(`[FlowGraphController] ⚠️ Auto-fit failed during refresh [${layoutId}]:`, err);
            }
          }, fitDelay);
        }

        console.log(`[FlowGraphController] ✅ refreshLayout completed successfully [${layoutId}]`);
      } catch (err) {
        profiler?.end('Layout Calculation');
        profiler?.end('Rendering');
        console.error(`[FlowGraphController] ❌ Failed to refresh layout [${layoutId}]:`, err);
        console.error(`[FlowGraphController] 📊 Error context:`, {
          hasVisualizationState: !!visualizationState,
          hasEngine: !!engine,
          hasBridge: !!bridge,
          layoutId,
        });
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
        // Release lock
        if (layoutLockRef.current === layoutId) {
          layoutLockRef.current = null;
          console.log(`[FlowGraphController] 🔓 Released layout lock [${layoutId}]`);
        }
        console.log(`[FlowGraphController] 🏁 refreshLayout finally block [${layoutId}]`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layoutConfig dependency causes infinite loops in the layout engine feedback cycle
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Including bridge, engine, reactFlowData, visualizationState, applyManualPositions would create infinite re-layout loops
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
          const delay =
            since > UI_CONSTANTS.LAYOUT_DELAY_THRESHOLD
              ? UI_CONSTANTS.LAYOUT_DELAY_SHORT
              : UI_CONSTANTS.LAYOUT_DELAY_NORMAL;
          autoFitTimeoutRef.current = setTimeout(() => {
            try {
              fitView({
                padding: UI_CONSTANTS.FIT_VIEW_PADDING,
                maxZoom: UI_CONSTANTS.FIT_VIEW_MAX_ZOOM,
                duration: UI_CONSTANTS.FIT_VIEW_DURATION,
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
  }, [
    visualizationState,
    engine,
    bridge,
    applyManualPositions,
    config.fitView,
    fitView,
    manualPositions,
  ]);

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
      const timestamp = Date.now();
      console.log(`[FlowGraphController] 🖱️ Node clicked:`, {
        nodeId: node.id,
        nodeType: node.type,
        position: node.position,
        data: node.data,
        timestamp,
      });

      // Check if this is a container node
      const container = visualizationState.getContainer(node.id);

      if (container) {
        console.log(`[FlowGraphController] 📦 Container node clicked:`, {
          containerId: container.id,
          collapsed: container.collapsed,
          childrenCount: container.children?.size || 0,
          timestamp,
        });

        // For container nodes, call the event handler FIRST (to change container state)
        // then do click animation logic AFTER the container state has changed
        console.log(`[FlowGraphController] 🎬 Calling container event handler first`);
        eventHandlers?.onNodeClick?.(event, node);

        // Set isClicked: true for the clicked node, false for all others
        console.log(`[FlowGraphController] 🎯 Setting clicked state for container`);
        visualizationState.visibleNodes.forEach(n => {
          visualizationState.updateNode(n.id, { isClicked: n.id === node.id });
        });

        console.log(`[FlowGraphController] ⚠️ Container click - layout refresh will be handled by container handler`);
        // Note: Don't call refreshLayout here for containers - the container handler will do its own layout refresh
      } else {
        console.log(`[FlowGraphController] 🔵 Regular node clicked:`, {
          nodeId: node.id,
          timestamp,
        });

        // For regular nodes, do click animation logic first, then call event handler
        // Set isClicked: true for the clicked node, false for all others
        console.log(`[FlowGraphController] 🎯 Setting clicked state for regular node`);
        visualizationState.visibleNodes.forEach(n => {
          visualizationState.updateNode(n.id, { isClicked: n.id === node.id });
        });

        // Trigger a refresh to update node ordering
        console.log(`[FlowGraphController] 🔄 Triggering layout refresh for regular node click`);
        refreshLayout(false);

        // Call the original event handler if provided
        console.log(`[FlowGraphController] 🎬 Calling regular node event handler`);
        eventHandlers?.onNodeClick?.(event, node);
      }

      console.log(`[FlowGraphController] ✅ Node click handler completed for ${node.id}`);
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
                duration: UI_CONSTANTS.FIT_VIEW_DURATION,
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
