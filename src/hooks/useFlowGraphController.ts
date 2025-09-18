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
import { consolidatedOperationManager } from '../utils/consolidatedOperationManager';
// import { layoutContentionMetrics } from '../utils/layoutContentionMetrics';
import { hscopeLogger } from '../utils/logger';
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

  // Debug: Track when reactFlowData changes
  useEffect(() => {
    hscopeLogger.log(
      'layout',
      `reactFlowData changed: ${reactFlowData ? `${reactFlowData.nodes.length} nodes, ${reactFlowData.edges.length} edges` : 'null'}`
    );
  }, [reactFlowData]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flag to prevent infinite loops when we're updating ReactFlow data internally
  const isInternalUpdateRef = useRef(false);

  // Enhanced state setter with global operation manager protection
  const setReactFlowDataWithLogging = useCallback(
    (data: ReactFlowData | null, layoutId: string) => {
      hscopeLogger.log(
        'layout',
        `setData request layout=${layoutId} newNodes=${data?.nodes.length || 0} newEdges=${data?.edges.length || 0}`
      );

      // DIAGNOSTIC: Log edge data for debugging missing edges
      if ((data?.edges.length || 0) === 0 && (data?.nodes.length || 0) > 5) {
        hscopeLogger.error(
          'layout',
          `🚨 EDGE DATA LOSS: ${data?.nodes.length || 0} nodes but 0 edges for layout ${layoutId}`
        );
        hscopeLogger.error('layout', '🚨 This indicates edges were lost during state transitions');
      }

      // Set flag to indicate this is an internal update
      isInternalUpdateRef.current = true;

      // CRITICAL: If we're inside an operation, execute immediately to maintain atomicity
      if (consolidatedOperationManager.isInsideOperation()) {
        hscopeLogger.log('layout', `setData immediate (inside operation) layout=${layoutId}`);

        // PROTECTION: Don't clear existing data with empty data during layout operations
        if ((!data || data.nodes.length === 0) && reactFlowData && reactFlowData.nodes.length > 0) {
          hscopeLogger.warn(
            'layout',
            `🛡️ Preventing data clear during operation: keeping ${reactFlowData.nodes.length} nodes instead of setting to ${!data ? 'null' : 'empty'}`
          );
          return;
        }

        // PROTECTION: Validate node structure before setting ReactFlow data
        if (data && data.nodes.length > 0) {
          const invalidNodes = data.nodes.filter(node => 
            !node.id || !node.type || !node.position || !node.data ||
            typeof node.position.x !== 'number' || typeof node.position.y !== 'number'
          );
          
          if (invalidNodes.length > 0) {
            hscopeLogger.error(
              'layout',
              `🚨 INVALID REACTFLOW DATA: ${invalidNodes.length} nodes have structural issues. Skipping update.`,
              invalidNodes.slice(0, 3).map(n => ({ id: n?.id, type: n?.type, position: n?.position }))
            );
            return;
          }
        }

        // Add small delay to ensure ReactFlow has finished processing previous updates
        setTimeout(() => {
          setReactFlowData(data);
          // Reset flag after ReactFlow processes the new data
          setTimeout(() => {
            isInternalUpdateRef.current = false;
          }, 100);
        }, 10);
        return;
      }

      // Use consolidated operation manager for protected state updates
      const operationId = consolidatedOperationManager.queueReactFlowUpdate(
        newData => {
          setReactFlowData(newData);
          // Reset flag after a short delay to allow ReactFlow to process
          setTimeout(() => {
            isInternalUpdateRef.current = false;
          }, 100);
        },
        data,
        layoutId,
        'high' // Layout updates are high priority
      );

      if (operationId) hscopeLogger.log('layout', `setData queued op=${operationId}`);
      else hscopeLogger.warn('layout', `setData blocked layout=${layoutId}`);

      // Verify state change in next tick (only for debugging)
      // Drop verbose verification; retain minimal optional hook (disabled by default)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // Intentionally empty - including reactFlowData would cause infinite loops
  );

  // Circuit breaker for rapid layout refreshes
  const layoutCircuitBreakerRef = useRef({
    count: 0,
    lastReset: Date.now(),
    maxCount: 5, // Max 5 layouts per reset period
    resetPeriod: 2000, // Reset every 2 seconds
  });

  // When a layout attempt is blocked by the global lock we queue a limited number of retries
  const _pendingLayoutRetryRef = useRef<{ force?: boolean; attempts: number } | null>(null);

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
      hscopeLogger.warn('layout', `circuit-breaker count=${breaker.count}`);
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
  // Prevent repeated initial auto-fit thrash
  const hasInitialAutoFitRef = useRef<boolean>(false);
  // Track last applied palette to avoid redundant node data rewrites
  const lastAppliedPaletteRef = useRef<string | null>(null);

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
      const fitOptions = {
        padding: UI_CONSTANTS.FIT_VIEW_PADDING,
        maxZoom: UI_CONSTANTS.FIT_VIEW_MAX_ZOOM,
        duration: UI_CONSTANTS.FIT_VIEW_DURATION,
      };

      // Use consolidated operation manager for manual fitView requests
      consolidatedOperationManager.requestAutoFit(fitView, fitOptions, 'manual-fit-request');

      hscopeLogger.log('fit', 'manual fitView requested');
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

      const _profiler = getProfiler();
      const _timestamp = Date.now();
      const layoutId = `layout-${_timestamp}`;

      // Use the consolidated operation manager for layout operations
      const success = await consolidatedOperationManager.queueLayoutOperation(
        layoutId,
        async () => {
          await executeLayoutOperation(layoutId, force);
        },
        {
          priority: force ? 'high' : 'normal',
          reason: `layout refresh ${force ? '(forced)' : ''}`,
          triggerAutoFit: config.fitView !== false, // Respect fitView config
          force,
        }
      );

      if (!success) {
        hscopeLogger.warn('layout', `refresh failed id=${layoutId}`);
        return;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checkCircuitBreaker, visualizationState, engine, applyManualPositions]
  );

  const executeLayoutOperation = useCallback(
    async (layoutId: string, force?: boolean) => {
      hscopeLogger.log(
        'layout',
        `start refresh id=${layoutId} force=${!!force} nodes=${reactFlowData?.nodes.length || 0}`
      );

      const profiler = getProfiler();

      try {
        setLoading(true);
        setError(null);

        profiler?.start('Layout Calculation');

        // Forcing a refresh should not reset layoutCount (which would re-trigger smart collapse).
        // We still allow updated layoutConfig to be applied, but avoid autoReLayout=true which resets counters.
        if (force && layoutConfig) {
          hscopeLogger.log('layout', `🔧 Updating layout config [${layoutId}]`);
          engine.updateLayoutConfig({ ...layoutConfig }, false);
        }

        // Check if we should use selective layout
        const lastChangedContainer = visualizationState.getLastChangedContainer();
        if (lastChangedContainer && !force) {
          // Use selective layout for individual container changes
          hscopeLogger.log(
            'layout',
            `selective layout container=${lastChangedContainer} id=${layoutId}`
          );
          profiler?.start('Selective Layout');
          await engine.runSelectiveLayout(lastChangedContainer);
          visualizationState.clearLastChangedContainer();
          profiler?.end('Selective Layout', { containerId: lastChangedContainer });
        } else {
          // Use full layout for other cases
          hscopeLogger.log('layout', `full layout id=${layoutId}`);
          profiler?.start('Full Layout');
          await engine.runLayout();
          profiler?.end('Full Layout');
        }

        profiler?.end('Layout Calculation');

        // CRITICAL: Small delay to ensure ELK results are fully applied to VisualizationState
        // before ReactFlow conversion. This prevents race conditions where ReactFlow
        // tries to convert containers that ELK processed but haven't been applied yet.
        // TODO: Consider if this setTimeout is still necessary with ConsolidatedOperationManager coordination
        await new Promise(resolve => setTimeout(resolve, 10));

        profiler?.start('Rendering');
        hscopeLogger.log('layout', `convert state -> rfData id=${layoutId}`);
        const baseData = bridge.convertVisualizationState(visualizationState);
        hscopeLogger.log(
          'layout',
          `base data counts nodes=${baseData.nodes.length} edges=${baseData.edges.length} id=${layoutId}`
        );

        baseReactFlowDataRef.current = baseData;
        const dataWithManual = applyManualPositions(baseData, manualPositions);
        hscopeLogger.log(
          'layout',
          `apply manual positions count=${Object.keys(manualPositions).length} id=${layoutId}`
        );
        setReactFlowDataWithLogging(dataWithManual, layoutId);
        hscopeLogger.log('layout', `setData complete id=${layoutId}`);

        profiler?.end('Rendering', {
          nodeCount: dataWithManual.nodes.length,
          edgeCount: dataWithManual.edges.length,
        });

        // Controlled initial auto-fit (single within a time window)
        if (config.fitView !== false) {
          // Allow external batching (e.g., container toggle batches) to suppress the immediate auto-fit
          if (typeof window !== 'undefined' && (window as any).__hydroSkipNextAutoFit) {
            hscopeLogger.log('fit', `auto-fit suppressed flag id=${layoutId}`);
            try {
              delete (window as any).__hydroSkipNextAutoFit;
            } catch {
              /* ignore */
            }
          } else {
            const now = Date.now();
            const sinceLast = now - lastFitTimeRef.current;
            if (!hasInitialAutoFitRef.current || sinceLast > 750) {
              const fitDelay = UI_CONSTANTS.LAYOUT_DELAY_NORMAL + 120; // Slightly longer to let DOM settle
              // NOTE: This setTimeout is okay because it uses consolidatedOperationManager.requestAutoFit()
              // which properly coordinates with other operations
              setTimeout(() => {
                try {
                  hscopeLogger.log(
                    'fit',
                    `auto-fit exec initial=${!hasInitialAutoFitRef.current} id=${layoutId}`
                  );
                  const fitOptions = {
                    padding: UI_CONSTANTS.FIT_VIEW_PADDING,
                    maxZoom: UI_CONSTANTS.FIT_VIEW_MAX_ZOOM,
                    duration: UI_CONSTANTS.FIT_VIEW_DURATION,
                  };
                  consolidatedOperationManager.requestAutoFit(
                    fitView,
                    fitOptions,
                    `initial-auto-fit-${layoutId}`
                  );
                  hasInitialAutoFitRef.current = true;
                } catch (err) {
                  console.warn(
                    `[FlowGraphController] ⚠️ Auto-fit failed during refresh [${layoutId}]:`,
                    err
                  );
                }
              }, fitDelay);
            } else {
              hscopeLogger.log('fit', `skip redundant auto-fit sinceLast=${sinceLast}ms`);
            }
          }
        }
        hscopeLogger.log('layout', `refresh success id=${layoutId}`);

        // Smart collapse now runs before ELK layout, so no re-layout is needed
      } catch (err) {
        profiler?.end('Layout Calculation');
        profiler?.end('Rendering');
        hscopeLogger.error('layout', `refresh failure id=${layoutId}`, err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
        // Note: Lock is now managed by the queue system, individual operations don't release it
        hscopeLogger.log('layout', `refresh finally complete id=${layoutId}`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layoutConfig and reactFlowData dependencies cause infinite loops
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
        const operationId = consolidatedOperationManager.queueReactFlowUpdate(
          setReactFlowData,
          withManual,
          'layout-config-change',
          'high'
        );
        hscopeLogger.log('layout', `layout-config change queued op=${operationId}`);
      } catch (err) {
        hscopeLogger.error('layout', 'apply layout-config failed', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Including bridge, engine, reactFlowData, visualizationState, applyManualPositions would create infinite re-layout loops
  }, [layoutConfig]);

  // Listen to config changes (palette, edge styles) with guards
  useEffect(() => {
    const palette = config?.colorPalette || null;
    const paletteChanged = palette !== lastAppliedPaletteRef.current;

    if (palette && paletteChanged) {
      bridge.setColorPalette(palette);
      lastAppliedPaletteRef.current = palette;
      const currentData = reactFlowData;
      if (currentData) {
        const needsUpdate = currentData.nodes.some(n => n.data?.colorPalette !== palette);
        if (needsUpdate) {
          const updatedData = {
            ...currentData,
            nodes: currentData.nodes.map(n => ({
              ...n,
              data: { ...n.data, colorPalette: palette },
            })),
          };
          const operationId = consolidatedOperationManager.queueReactFlowUpdate(
            setReactFlowData,
            updatedData,
            'palette-update',
            'normal'
          );
          hscopeLogger.log('layout', `palette update queued op=${operationId}`);
        } else {
          hscopeLogger.log('layout', 'palette unchanged');
        }
      }
    }

    if (config?.edgeStyleConfig) {
      const styleCfg = config.edgeStyleConfig;
      bridge.setEdgeStyleConfig(styleCfg);

      if (reactFlowData) {
        // Build a lightweight signature to detect meaningful style config changes
        const signatureSource = JSON.stringify({
          semantic: styleCfg.semanticMappings || null,
          property: styleCfg.propertyMappings || null,
        });
        // Simple non-crypto hash
        let hash = 0;
        for (let i = 0; i < signatureSource.length; i++) {
          hash = (hash * 31 + signatureSource.charCodeAt(i)) >>> 0;
        }
        const signature = `es_${hash.toString(36)}`;

        const needsEdgeUpdate = reactFlowData.edges.some(
          e => e.data?.__edgeStyleSignature !== signature
        );
        if (needsEdgeUpdate) {
          const updated = {
            ...reactFlowData,
            edges: reactFlowData.edges.map(ed => ({
              ...ed,
              data: {
                ...ed.data,
                __edgeStyleSignature: signature,
              },
            })),
          };
          const opId = consolidatedOperationManager.queueReactFlowUpdate(
            setReactFlowData,
            updated,
            'edge-style-update',
            'normal'
          );
          hscopeLogger.log('layout', `edge-style signature update queued op=${opId}`);
        } else {
          hscopeLogger.log('layout', 'edge-style signature unchanged');
        }
      }
    }
  }, [config?.colorPalette, config?.edgeStyleConfig, bridge, reactFlowData, setReactFlowData]);

  // Track visualization state version to prevent infinite loops
  const lastStateVersionRef = useRef<number>(0);

  // Listen to visualization state changes (only when state actually changes)
  useEffect(() => {
    const currentVersion = visualizationState.getVersion();

    // Skip if this is the same version we already processed
    if (currentVersion === lastStateVersionRef.current) {
      return;
    }

    const handle = async () => {
      try {
        const state = engine.getState();
        if (state.phase === 'laying_out') {
          // Skip; engine busy
          return;
        }

        // Update the version we're processing
        lastStateVersionRef.current = currentVersion;

        setLoading(true);
        setError(null);
        await engine.runLayout();
        const baseData = bridge.convertVisualizationState(visualizationState);
        baseReactFlowDataRef.current = baseData;
        const withManual = applyManualPositions(baseData, manualPositions);
        const operationId = consolidatedOperationManager.queueReactFlowUpdate(
          setReactFlowData,
          withManual,
          'state-change-layout',
          'high'
        );
        hscopeLogger.log(
          'layout',
          `state change layout queued op=${operationId} version=${currentVersion}`
        );

        if (config.fitView !== false) {
          const now = Date.now();
          const since = now - lastFitTimeRef.current;
          if (autoFitTimeoutRef.current) clearTimeout(autoFitTimeoutRef.current);
          const delay =
            since > UI_CONSTANTS.LAYOUT_DELAY_THRESHOLD
              ? UI_CONSTANTS.LAYOUT_DELAY_SHORT
              : UI_CONSTANTS.LAYOUT_DELAY_NORMAL;
          // NOTE: This setTimeout is okay because it uses consolidatedOperationManager.requestAutoFit()
          autoFitTimeoutRef.current = setTimeout(() => {
            try {
              const fitOptions = {
                padding: UI_CONSTANTS.FIT_VIEW_PADDING,
                maxZoom: UI_CONSTANTS.FIT_VIEW_MAX_ZOOM,
                duration: UI_CONSTANTS.FIT_VIEW_DURATION,
              };

              // Use consolidated operation manager for protected auto-fit operations
              consolidatedOperationManager.requestAutoFit(
                fitView,
                fitOptions,
                'state-change-auto-fit'
              );
              lastFitTimeRef.current = Date.now();
            } catch (err) {
              hscopeLogger.warn('fit', 'auto-fit failed state-change', err);
            }
          }, delay);
        }
      } catch (err) {
        hscopeLogger.error('layout', 'state change visualization update failed', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    handle();
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
      const operationId = consolidatedOperationManager.queueReactFlowUpdate(
        setReactFlowData,
        updated,
        'manual-position-update',
        'normal'
      );
      hscopeLogger.log('layout', `manual position update queued op=${operationId}`);
    }
  }, [visualizationState, applyManualPositions]);

  // Event handlers
  const onNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      const _timestamp = Date.now();
      hscopeLogger.log(
        'op',
        `node click id=${node.id} type=${node.type} x=${node.position.x} y=${node.position.y}`
      );

      // Check if this is a container node
      const container = visualizationState.getContainer(node.id);

      if (container) {
        hscopeLogger.log(
          'op',
          `container click id=${container.id} collapsed=${container.collapsed} children=${container.children?.size || 0}`
        );

        // For container nodes, call the event handler FIRST (to change container state)
        // then do click animation logic AFTER the container state has changed
        // call handler first (container state changes then we mark clicked)
        eventHandlers?.onNodeClick?.(event, node);

        // Set isClicked: true for the clicked node, false for all others
        visualizationState.visibleNodes.forEach(n => {
          visualizationState.updateNode(n.id, { isClicked: n.id === node.id });
        });

        hscopeLogger.log('layout', 'container click layout handled externally');
        // Note: Don't call refreshLayout here for containers - the container handler will do its own layout refresh
      } else {
        hscopeLogger.log('op', `regular node click id=${node.id}`);

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
      hscopeLogger.log('op', `node click handler done id=${node.id}`);
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
          // NOTE: This setTimeout is okay because it uses consolidatedOperationManager.requestAutoFit()
          autoFitTimeoutRef.current = setTimeout(() => {
            try {
              consolidatedOperationManager.requestAutoFit(
                fitView,
                {
                  padding: UI_CONSTANTS.FIT_VIEW_PADDING,
                  maxZoom: UI_CONSTANTS.FIT_VIEW_MAX_ZOOM,
                  duration: UI_CONSTANTS.FIT_VIEW_DURATION,
                },
                'drag-stop-auto-fit'
              );
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

  const onNodesChange = useCallback(
    (changes: any[]) => {
      // CRITICAL: Prevent infinite loops by ignoring changes during internal updates
      if (isInternalUpdateRef.current) {
        hscopeLogger.log('layout', `nodes change ignored (internal update in progress)`);
        return;
      }

      // For onNodesChange, we need to compute the update first, then apply it
      const currentData = reactFlowData;
      if (currentData) {
        const updatedData = {
          ...currentData,
          nodes: applyNodeChanges(changes, currentData.nodes),
        };
        const operationId = consolidatedOperationManager.queueReactFlowUpdate(
          setReactFlowData,
          updatedData,
          'nodes-change',
          'high'
        );
        hscopeLogger.log('layout', `nodes change queued op=${operationId}`);
      }
    },
    [reactFlowData]
  );

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
