import React, {
  useCallback,
  useRef,
  useState,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { hscopeLogger } from '../utils/logger';
import { Card, Button, message } from 'antd';
import { InfoCircleOutlined, SettingOutlined } from '@ant-design/icons';
import HydroscopeCore, {
  type HydroscopeCoreProps as CoreProps,
  type HydroscopeCoreRef,
} from './HydroscopeCore';
import { FileDropZone } from './FileDropZone';
import { StyleTunerPanel } from './StyleTunerPanel';
import { InfoPanel, type InfoPanelRef } from './InfoPanel';
import type { VisualizationState } from '../core/VisualizationState';
import type { RenderConfig } from '../core/types';
import { parseGraphJSON, createRenderConfig } from '../core/JSONParser';
import { LAYOUT_CONSTANTS, DEFAULT_LAYOUT_CONFIG } from '../shared/config';
import { isDevelopment, getProfiler } from '../dev';
import {
  saveToStorage,
  loadFromStorage,
  clearHydroscopeStorage,
  STORAGE_KEYS,
  isStorageAvailable,
} from '../utils/persistence';
import { ResizeObserverErrorHandler } from '../utils/resizeObserverErrorHandler';
import { consolidatedOperationManager } from '../utils/consolidatedOperationManager';
import { LayoutOrchestrator } from '../core/LayoutOrchestrator';

// Conditional dev-only imports
let PerformanceDashboard: React.ComponentType<any> | null = null;
if (isDevelopment()) {
  try {
    // Use dynamic import for development-only components
    import('../dev/components/PerformanceDashboard')
      .then(devComponents => {
        PerformanceDashboard = devComponents.default;
      })
      .catch(_error => {
        console.warn('Development components not available');
      });
  } catch (_error) {
    console.warn('Development components not available');
  }
}

// Extended interface for the full Hydroscope component with UI panels
export interface HydroscopeProps extends CoreProps {
  showFileUpload?: boolean;
  showInfoPanel?: boolean;
  showStylePanel?: boolean;
  showPerformancePanel?: boolean;
  enableCollapse?: boolean;
  initialLayoutAlgorithm?: string;
  initialColorPalette?: string;
  onFileUpload?: (data: any, filename?: string) => void;
  onNodeClick?: (event: any, node: any, visualizationState?: VisualizationState) => void;
  onContainerCollapse?: (containerId: string, visualizationState?: VisualizationState) => void;
  onContainerExpand?: (containerId: string, visualizationState?: VisualizationState) => void;
  onConfigChange?: (config: RenderConfig) => void;
  generatedFilePath?: string;
}

// Re-export the ref interface from Core for external use
export type { HydroscopeCoreRef as HydroscopeRef } from './HydroscopeCore';

/**
 * Hydroscope: Complete graph visualization experience with full UI.
 *
 * Features:
 * - File upload and drag-drop
 * - Layout algorithm controls
 * - Style tuning panel with color palettes
 * - Interactive container collapse/expand
 * - Information panel with metadata and search
 * - Grouping controls
 * - Pack/Unpack all operations
 */
export const Hydroscope = forwardRef<HydroscopeCoreRef, HydroscopeProps>(
  (
    {
      data: initialData,
      showFileUpload = true,
      showInfoPanel = true,
      showStylePanel: _showStylePanel = true,
      showPerformancePanel = false,
      enableCollapse = true,
      autoFit = true,
      initialLayoutAlgorithm = DEFAULT_LAYOUT_CONFIG.algorithm,
      initialColorPalette = 'Set3',
      onFileUpload,
      onNodeClick,
      onContainerCollapse,
      onContainerExpand,
      onParsed,
      onConfigChange,
      style: _style,
      ...hydroscopeProps
    },
    ref
  ) => {
    // All hooks and effects go here, inside the function body
    const [data, setData] = useState(initialData);
    const [visualizationState, setVisualizationState] = useState<VisualizationState | null>(null);
    const [layoutOrchestrator, setLayoutOrchestrator] = useState<LayoutOrchestrator | null>(null);
    const [metadata, setMetadata] = useState<any>(null);
    const [graphData, setGraphData] = useState<any>(null); // Raw parsed JSON data like vis.js
    const [_edgeStyleConfig, setEdgeStyleConfig] = useState<any>(null); // Processed edge style config
    const [_isLayoutRunning, setIsLayoutRunning] = useState(false);
    // Derive collapsed containers from visualization state instead of maintaining separate state
    // Force re-computation when any layout refresh happens
    const [_layoutRefreshCounter, setLayoutRefreshCounter] = useState(0);
    const [hasParsedData, setHasParsedData] = useState<boolean>(false);
    const initialCollapsedCountRef = useRef<number>(0);

    // Drawer states
    const [infoPanelOpen, setInfoPanelOpen] = useState(false); // Start collapsed
    const [stylePanelOpen, setStylePanelOpen] = useState(false); // Start collapsed
    const [performancePanelOpen, setPerformancePanelOpen] = useState(showPerformancePanel || false);

    // Default values for reset functionality
    const defaultRenderConfig = useMemo(
      () => ({
        ...hydroscopeProps.config,
        edgeStyleConfig:
          (initialData &&
            typeof initialData === 'object' &&
            (initialData as any).edgeStyleConfig) ||
          undefined,
        reactFlowControlsScale: LAYOUT_CONSTANTS.REACTFLOW_CONTROLS_SCALE,
      }),
      [hydroscopeProps.config, initialData]
    );
    const defaultColorPalette = initialColorPalette;
    const defaultLayoutAlgorithm = initialLayoutAlgorithm;
    const defaultAutoFit = autoFit;

    // Load persisted settings with graceful fallback
    const storageAvailable = isStorageAvailable();
    const persistedRenderConfig = storageAvailable
      ? loadFromStorage(STORAGE_KEYS.RENDER_CONFIG, defaultRenderConfig)
      : defaultRenderConfig;
    const persistedColorPalette = storageAvailable
      ? loadFromStorage(STORAGE_KEYS.COLOR_PALETTE, defaultColorPalette)
      : defaultColorPalette;
    const persistedLayoutAlgorithm = storageAvailable
      ? loadFromStorage(STORAGE_KEYS.LAYOUT_ALGORITHM, defaultLayoutAlgorithm)
      : defaultLayoutAlgorithm;
    const persistedAutoFit = storageAvailable
      ? loadFromStorage(STORAGE_KEYS.AUTO_FIT, defaultAutoFit)
      : defaultAutoFit;

    // Configuration state with persistence (moved up to fix variable order)
    const [grouping, setGrouping] = useState<string | undefined>(hydroscopeProps.grouping);
    const [colorPalette, setColorPalette] = useState(persistedColorPalette);
    const [layoutAlgorithm, setLayoutAlgorithm] = useState(persistedLayoutAlgorithm);
    const [renderConfig, setRenderConfig] = useState<RenderConfig>(persistedRenderConfig);
    const [autoFitEnabled, setAutoFitEnabled] = useState<boolean>(persistedAutoFit);

    // Setup global autofit request mechanism for search expansion and other operations
    useEffect(() => {
      (window as any).__hydroRequestAutoFit = (reason?: string) => {
        if (hydroscopeRef.current?.fitView && autoFitEnabled) {
          const fitFn = hydroscopeRef.current.fitView;
          consolidatedOperationManager.requestAutoFit(fitFn, undefined, reason || 'global-request');
          hscopeLogger.log('fit', `global autofit requested: ${reason || 'unspecified'}`);
        }
      };

      // Cleanup on unmount
      return () => {
        delete (window as any).__hydroRequestAutoFit;
      };
    }, [autoFitEnabled]);

    // Ensure renderConfig.edgeStyleConfig is always in sync with graphData.edgeStyleConfig
    useEffect(() => {
      if (graphData && graphData.edgeStyleConfig) {
        setRenderConfig(prev => ({
          ...prev,
          edgeStyleConfig: graphData.edgeStyleConfig,
        }));
      }
    }, [graphData]);

    // Sync internal data state with prop changes
    useEffect(() => {
      // Sync internal data only when the prop changes; do not override local resets
      setData(initialData);
    }, [initialData]);

    const hydroscopeRef = useRef<HydroscopeCoreRef>(null);
    const infoPanelRef = useRef<InfoPanelRef>(null);

    // Forward ref to the core component
    useImperativeHandle(
      ref,
      () => ({
        getVisualizationState: () => hydroscopeRef.current?.getVisualizationState() || null,
        refreshLayout: (force?: boolean) =>
          hydroscopeRef.current?.refreshLayout(force) || Promise.resolve(),
        fitView: async () => {
          if (hydroscopeRef.current?.fitView) {
            const fitFn = hydroscopeRef.current.fitView;
            // Use consolidated system for imperative fitView
            consolidatedOperationManager.requestAutoFit(fitFn, undefined, 'imperative-fitview');
          }
        },
      }),
      []
    );

    // Search highlight state (mirrors InfoPanel search)
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchMatches, setSearchMatches] = useState<
      Array<{ id: string; label: string; type: 'container' | 'node' }>
    >([]);
    const [currentSearchMatchId, setCurrentSearchMatchId] = useState<string | undefined>(undefined);

    // Update render config when settings change
    useEffect(() => {
      // Keep renderConfig in sync with palette and auto-fit preference
      setRenderConfig(prev => {
        const next = {
          ...prev,
          colorPalette,
          fitView: autoFitEnabled,
          edgeStyleConfig: (graphData && graphData.edgeStyleConfig) || prev.edgeStyleConfig,
        } as RenderConfig;
        onConfigChange?.(next);
        return next;
      });
    }, [colorPalette, autoFitEnabled, onConfigChange, graphData]);

    // Persistence effects - save to localStorage when values change
    useEffect(() => {
      if (storageAvailable) {
        saveToStorage(STORAGE_KEYS.RENDER_CONFIG, renderConfig);
      }
    }, [renderConfig, storageAvailable]);

    useEffect(() => {
      if (storageAvailable) {
        saveToStorage(STORAGE_KEYS.COLOR_PALETTE, colorPalette);
      }
    }, [colorPalette, storageAvailable]);

    useEffect(() => {
      if (storageAvailable) {
        saveToStorage(STORAGE_KEYS.LAYOUT_ALGORITHM, layoutAlgorithm);
      }
    }, [layoutAlgorithm, storageAvailable]);

    useEffect(() => {
      if (storageAvailable) {
        saveToStorage(STORAGE_KEYS.AUTO_FIT, autoFitEnabled);
      }
    }, [autoFitEnabled, storageAvailable]);

    // Global keyboard shortcuts
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
          e.preventDefault();
          infoPanelRef.current?.focusSearch();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Reset to defaults function
    const handleResetToDefaults = useCallback(() => {
      setRenderConfig(defaultRenderConfig);
      setColorPalette(defaultColorPalette);
      setLayoutAlgorithm(defaultLayoutAlgorithm);
      setAutoFitEnabled(defaultAutoFit);

      // Clear persisted storage
      if (storageAvailable) {
        clearHydroscopeStorage();
      }
    }, [
      defaultRenderConfig,
      defaultColorPalette,
      defaultLayoutAlgorithm,
      defaultAutoFit,
      storageAvailable,
    ]);

    // Handle layout algorithm changes - trigger relayout when algorithm changes
    useEffect(() => {
      // Only refresh layout if we have a visualization state and this isn't the initial render
      // Only trigger on layoutAlgorithm changes, not visualizationState changes
      if (visualizationState && hydroscopeRef.current?.refreshLayout) {
        hydroscopeRef.current.refreshLayout(true);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layoutAlgorithm]); // Intentionally omitting visualizationState to prevent InfoPanel interference

    // Handle file upload
    const handleFileUpload = useCallback(
      (uploadedData: any, filename: string) => {
        setData(uploadedData);

        // Auto-enable performance panel for large files
        const dataSize = JSON.stringify(uploadedData).length;
        if (dataSize > 100 * 1024) {
          // 100KB threshold
          if (isDevelopment()) {
            setPerformancePanelOpen(true);
          }
        }

        onFileUpload?.(uploadedData, filename);
      },
      [onFileUpload]
    );

    // Handle parsing to get access to visualization state
    const handleParsed = useCallback(
      (parsedMetadata: any, visState: VisualizationState) => {
        setVisualizationState(visState);
        setMetadata(parsedMetadata);

        // Set the grouping to the selectedGrouping from parsing
        if (parsedMetadata?.selectedGrouping) {
          setGrouping(parsedMetadata.selectedGrouping);
        }

        // Initialize collapsed containers are handled automatically by VisualizationState
        // No need to manually track them here
        initialCollapsedCountRef.current = visState.getCollapsedContainers().length;

        onParsed?.(parsedMetadata, visState);
      },
      [onParsed]
    );

    // Set up LayoutOrchestrator when visualizationState and hydroscopeRef are available
    useEffect(() => {
      if (visualizationState && hydroscopeRef.current) {
        const orchestrator = new LayoutOrchestrator(
          visualizationState,
          {
            refreshLayout: (force?: boolean) =>
              hydroscopeRef.current?.refreshLayout(force) || Promise.resolve(),
          },
          {
            fitView: () => {
              if (hydroscopeRef.current?.fitView) {
                hydroscopeRef.current.fitView();
              }
            },
          }
        );

        setLayoutOrchestrator(orchestrator);
        hscopeLogger.log('orchestrator', 'LayoutOrchestrator created and configured');
      } else {
        setLayoutOrchestrator(null);
      }
    }, [visualizationState]);

    // Memoize collapsed containers to prevent infinite loops in search expansion
    // Use layoutRefreshCounter as dependency to update when layout changes occur
    const collapsedContainers = useMemo(() => {
      if (!visualizationState) return new Set<string>();
      return new Set(visualizationState.getCollapsedContainers().map(c => c.id));
    }, [visualizationState]);

    // Initialize graph data and edge style config when data first loads
    useEffect(() => {
      if (!data) {
        setHasParsedData(false);
        return;
      }

      let jsonData: any = null;
      if (typeof data === 'string') {
        const trimmed = data.trim();
        const looksLikeJSON = trimmed.startsWith('{') || trimmed.startsWith('[');
        const looksLikePath =
          !looksLikeJSON &&
          (/^\//.test(trimmed) || /^file:\/\//i.test(trimmed) || /\.json$/i.test(trimmed));

        if (looksLikePath) {
          // Browser cannot load arbitrary filesystem paths; show uploader with path hint
          console.info('📄 Detected file path string; waiting for user to drop/select file.');
          setHasParsedData(false);
          setGraphData(null);
          return;
        }

        try {
          jsonData = JSON.parse(data);
        } catch (e) {
          hscopeLogger.error('parse', 'Failed to parse JSON data', e);
          setHasParsedData(false);
          return;
        }
      } else if (data && typeof data === 'object') {
        jsonData = data;
      }

      if (jsonData) {
        const profiler = getProfiler();

        setGraphData(jsonData);
        setHasParsedData(true);

        // Only create edge style config on initial data load, not on grouping changes
        try {
          profiler?.start('Render Config Creation');
          const parsedData = parseGraphJSON(jsonData, grouping);
          const renderConfig = createRenderConfig(parsedData);
          setEdgeStyleConfig(renderConfig);
          profiler?.end('Render Config Creation');
        } catch (e) {
          profiler?.end('Render Config Creation');
          hscopeLogger.error('parse', 'Failed to create render config', e);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- grouping dependency would cause infinite loops
    }, [data]); // Only depend on data, NOT grouping

    // Default interactive node click handler
    const handleNodeClick = useCallback(
      async (event: any, node: any) => {
        if (!visualizationState) {
          console.warn('⚠️ No visualization state available for node click');
          return;
        }

        if (onNodeClick) {
          // User provided custom handler - use that instead
          onNodeClick(event, node, visualizationState);
          return;
        }

        // Check if this is a container first
        const container = visualizationState.getContainer(node.id);
        if (container && enableCollapse) {
          // Built-in container collapse/expand logic using LayoutOrchestrator
          try {
            setIsLayoutRunning(true);

            // Call callbacks for external listeners before state changes
            if (container.collapsed) {
              onContainerExpand?.(node.id, visualizationState);
            } else {
              onContainerCollapse?.(node.id, visualizationState);
            }

            // Use LayoutOrchestrator for coordinated container toggle
            if (layoutOrchestrator) {
              await layoutOrchestrator.toggleContainer(node.id);
              hscopeLogger.log('toggle', `container toggle via LayoutOrchestrator id=${node.id}`);
            } else {
              // Fallback to direct state manipulation if orchestrator not available
              if (container.collapsed) {
                visualizationState.expandContainer(node.id);
              } else {
                visualizationState.collapseContainer(node.id);
              }

              // Trigger layout refresh (refreshLayout already uses consolidatedOperationManager)
              if (hydroscopeRef.current?.refreshLayout) {
                await hydroscopeRef.current.refreshLayout();
              }
            }

            // Force re-computation of collapsed containers state for InfoPanel
            setLayoutRefreshCounter(prev => prev + 1);
          } catch (err) {
            hscopeLogger.error('toggle', 'Error toggling container', err);
          } finally {
            setIsLayoutRunning(false);
          }
          return; // Exit early after handling container
        }

        // Handle regular graph node label toggle
        const graphNode = visualizationState.getGraphNode(node.id);

        if (
          graphNode &&
          graphNode.fullLabel &&
          graphNode.shortLabel &&
          graphNode.fullLabel !== graphNode.shortLabel
        ) {
          // Toggle between short and full label (only if they're actually different)
          const currentLabel = graphNode.label || graphNode.shortLabel;
          const isShowingShort = currentLabel === graphNode.shortLabel;
          const newLabel = isShowingShort ? graphNode.fullLabel : graphNode.shortLabel;

          // Update the node's label field
          visualizationState.updateNode(node.id, { label: newLabel });

          // Trigger a refresh to update the display (refreshLayout already uses consolidatedOperationManager)
          try {
            if (hydroscopeRef.current?.refreshLayout) {
              // Use refreshLayout to force a re-conversion of the visualization state
              await hydroscopeRef.current.refreshLayout(false);
            }
          } catch (err) {
            hscopeLogger.error('toggle', 'Error refreshing after label toggle', err);
          }
        } else {
        }
      },
      [
        visualizationState,
        layoutOrchestrator,
        enableCollapse,
        onNodeClick,
        onContainerCollapse,
        onContainerExpand,
      ]
    );

    // Pack all containers (collapse all)
    const handlePackAll = useCallback(async () => {
      if (!layoutOrchestrator) return;

      try {
        setIsLayoutRunning(true);

        // Clear search state to prevent conflicts with bulk operations
        setSearchQuery('');
        setSearchMatches([]);
        setCurrentSearchMatchId(undefined);

        // Also clear the InfoPanel search
        if (infoPanelRef.current?.clearSearch) {
          infoPanelRef.current.clearSearch();
        }

        // Use LayoutOrchestrator for coordinated collapse all
        await layoutOrchestrator.collapseAll();

        hscopeLogger.log('pack', 'collapse all completed via LayoutOrchestrator');
      } catch (err) {
        hscopeLogger.error('pack', 'Error packing containers', err);
      } finally {
        setIsLayoutRunning(false);
      }
    }, [layoutOrchestrator]);

    // Unpack all containers (expand all)
    const handleUnpackAll = useCallback(async () => {
      if (!layoutOrchestrator) return;

      try {
        setIsLayoutRunning(true);

        // Clear search state to prevent conflicts with bulk operations
        setSearchQuery('');
        setSearchMatches([]);
        setCurrentSearchMatchId(undefined);

        // Also clear the InfoPanel search
        if (infoPanelRef.current?.clearSearch) {
          infoPanelRef.current.clearSearch();
        }

        // Use LayoutOrchestrator for coordinated expand all
        await layoutOrchestrator.expandAll();

        hscopeLogger.log('pack', 'expand all completed via LayoutOrchestrator');
      } catch (err) {
        hscopeLogger.error('pack', 'Error unpacking containers', err);
      } finally {
        setIsLayoutRunning(false);
      }
    }, [layoutOrchestrator]);

    // Handle grouping change
    const handleGroupingChange = useCallback(
      async (newGrouping: string | undefined) => {
        if (!graphData) return;

        // CRITICAL FIX: Queue grouping change as atomic operation through ConsolidatedOperationManager
        // This prevents unsafe interleaving of state changes with rendering operations
        const operationId = `grouping-change-${Date.now()}`;

        const success = await consolidatedOperationManager.queueLayoutOperation(
          operationId,
          async () => {
            // Set flag to prevent full collapse from undoing grouping changes
            if (typeof window !== 'undefined') {
              (window as any).__hydroRecentGroupingChange = Date.now();
            }

            // Perform the grouping change atomically
            setGrouping(newGrouping);

            try {
              const parsedData = parseGraphJSON(graphData, newGrouping);
              const renderConfig = createRenderConfig(parsedData);
              setEdgeStyleConfig(renderConfig);

              hscopeLogger.log('orchestrator', `Grouping changed to: ${newGrouping || 'none'}`);
            } catch (e) {
              hscopeLogger.error(
                'grouping',
                'Failed to update render config for grouping change',
                e
              );
              throw e; // Re-throw to mark operation as failed
            }
          },
          {
            priority: 'high',
            reason: `Grouping change to ${newGrouping || 'none'}`,
            triggerAutoFit: true, // Grouping changes should trigger autofit
            force: true,
          }
        );

        if (!success) {
          hscopeLogger.error('grouping', 'Failed to queue grouping change operation');
        }
      },
      [graphData]
    );

    // Handle load another file
    const handleLoadFile = useCallback(() => {
      // Clean URL: drop any hash and ?file param
      if (typeof window !== 'undefined') {
        try {
          const url = new URL(window.location.href);
          url.hash = '';
          url.searchParams.delete('file');
          window.history.replaceState(null, '', url.toString());
        } catch {}
      }
      // Reset to file drop zone
      setHasParsedData(false);
      setGraphData(null);
      setVisualizationState(null);
      setMetadata(null);
      // collapsedContainers will be automatically derived from visualizationState
      initialCollapsedCountRef.current = 0;
      // If we have a generated file path, restore it; else clear data
      const nextData = hydroscopeProps.generatedFilePath || null;
      setData(nextData as any);
      // Optional: notify and propagate config if needed
      message.info('Ready to load another file');
    }, [hydroscopeProps.generatedFilePath]);

    const layoutConfig = {
      algorithm: layoutAlgorithm as any,
      enableSmartCollapse: true,
    };

    const mainContentStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '600px',
      height: '100vh',
      width: '100%',
      overflow: 'hidden',
    };

    const graphAreaStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'row',
      flex: 1,
      minHeight: '500px',
      height: '100%',
      width: '100%',
      overflow: 'hidden',
      position: 'relative',
    };

    // Diagnostic: log props passed to InfoPanel and Hydroscope on each render

    return (
      <div style={mainContentStyle}>
        {/* File Upload Area: show when no parsed data is available */}
        {showFileUpload && !hasParsedData && (
          <Card style={{ flexShrink: 0 }}>
            <FileDropZone
              onFileUpload={handleFileUpload}
              acceptedTypes={['.json']}
              generatedFilePath={hydroscopeProps.generatedFilePath}
            />
          </Card>
        )}

        {/* Main Graph Area with horizontal layout like vis.js */}
        {hasParsedData && data && (
          <div style={graphAreaStyle}>
            {/* Info Panel - Right side */}
            {showInfoPanel && visualizationState && (
              <InfoPanel
                ref={infoPanelRef}
                visualizationState={visualizationState}
                legendData={graphData && graphData.legend ? graphData.legend : {}}
                edgeStyleConfig={
                  graphData && graphData.edgeStyleConfig ? graphData.edgeStyleConfig : undefined
                }
                hierarchyChoices={metadata?.availableGroupings || []}
                currentGrouping={grouping}
                onGroupingChange={handleGroupingChange}
                collapsedContainers={collapsedContainers}
                layoutOrchestrator={layoutOrchestrator}
                open={infoPanelOpen}
                onOpenChange={setInfoPanelOpen}
                onSearchUpdate={(q, matches, current) => {
                  setSearchQuery(q);
                  setSearchMatches(matches);
                  setCurrentSearchMatchId(current?.id);
                }}
                onToggleContainer={async containerId => {
                  // Check if there's an active search and what operation the user is doing
                  const hasActiveSearch =
                    searchQuery && searchQuery.trim() && searchMatches && searchMatches.length > 0;
                  const container = visualizationState?.getContainer(containerId);
                  const isCollapsing = container && !container.collapsed; // Will be collapsed after toggle

                  hscopeLogger.log(
                    'toggle',
                    `onToggleContainer(${containerId}) - hasActiveSearch: ${hasActiveSearch}, isCollapsing: ${isCollapsing}, searchQuery: "${searchQuery}", matches: ${searchMatches?.length || 0}`
                  );

                  // Clear search only for collapse operations during active search
                  // Keep search active for expand operations (user likely exploring search results)
                  if (hasActiveSearch && isCollapsing) {
                    hscopeLogger.log(
                      'search',
                      `🧹 Clearing search before container collapse: ${containerId}`
                    );
                    setSearchQuery('');
                    setSearchMatches([]);
                    setCurrentSearchMatchId(undefined);

                    // Also clear the InfoPanel search
                    if (infoPanelRef.current?.clearSearch) {
                      infoPanelRef.current.clearSearch();
                    }
                  } else if (hasActiveSearch && !isCollapsing) {
                    hscopeLogger.log(
                      'search',
                      `🔍 Keeping search active for container expand: ${containerId}`
                    );
                  }

                  // For non-search operations, use batching as before
                  if (!(window as any).__hydroToggleBatchRef) {
                    (window as any).__hydroToggleBatchRef = new Set<string>();
                    (window as any).__hydroToggleBatchScheduled = false;
                  }
                  const batch: Set<string> = (window as any).__hydroToggleBatchRef;
                  batch.add(containerId);

                  if (!(window as any).__hydroToggleBatchScheduled) {
                    (window as any).__hydroToggleBatchScheduled = true;
                    requestAnimationFrame(async () => {
                      const ids = Array.from(batch);
                      batch.clear();
                      (window as any).__hydroToggleBatchScheduled = false;
                      if (!visualizationState) return;
                      const start = performance.now();
                      hscopeLogger.log('toggle', `batch size=${ids.length}`);
                      try {
                        // Pause ResizeObserver callbacks during heavy container mutations
                        try {
                          ResizeObserverErrorHandler.getInstance().pause();
                          hscopeLogger.log('ro', 'pause during batch');
                        } catch {
                          /* ignore */
                        }
                        // Call callbacks for external listeners before state changes
                        for (const id of ids) {
                          const c = visualizationState.getContainer(id);
                          if (!c) continue;

                          if (c.collapsed) {
                            onContainerExpand?.(id, visualizationState);
                          } else {
                            onContainerCollapse?.(id, visualizationState);
                          }
                        }

                        // Use LayoutOrchestrator for coordinated container toggles
                        if (layoutOrchestrator) {
                          await layoutOrchestrator.toggleContainersBatch(ids);
                          hscopeLogger.log(
                            'toggle',
                            `batch processed via LayoutOrchestrator size=${ids.length}`
                          );
                        } else {
                          // Fallback to direct state manipulation if orchestrator not available
                          for (const id of ids) {
                            const c = visualizationState.getContainer(id);
                            if (!c) continue;
                            if (c.collapsed) {
                              visualizationState.expandContainer(id);
                            } else {
                              visualizationState.collapseContainer(id);
                            }
                          }
                          // Trigger layout refresh (refreshLayout already uses consolidatedOperationManager)
                          if (hydroscopeRef.current?.refreshLayout) {
                            const force = ids.length > 1; // multiple toggles need a full layout
                            await hydroscopeRef.current.refreshLayout(force);
                            if (force) {
                              hscopeLogger.log('layout', 'full after multi-toggle');
                            } else {
                              hscopeLogger.log('layout', 'single toggle layout');
                            }
                          }
                        }
                        setLayoutRefreshCounter(prev => prev + 1);
                        const dur = Math.round(performance.now() - start);
                        hscopeLogger.log('toggle', `batch done dur=${dur}ms`);
                        // Resume ResizeObserver now that DOM settled post-layout (before deferred auto-fit)
                        try {
                          ResizeObserverErrorHandler.getInstance().resume();
                          hscopeLogger.log('ro', 'resume after layout');
                        } catch {
                          /* ignore */
                        }
                        // Schedule a single deferred fitView after DOM settles
                        if (hydroscopeRef.current?.fitView) {
                          const fitFn = hydroscopeRef.current.fitView;
                          setTimeout(() => {
                            try {
                              consolidatedOperationManager.requestAutoFit(
                                fitFn,
                                undefined,
                                'batched-container-toggle'
                              );
                              hscopeLogger.log('fit', 'deferred auto-fit requested');
                            } catch (e) {
                              console.warn('⚠️ [Hydroscope] Deferred auto-fit request failed', e);
                            } finally {
                              try {
                                const inst = ResizeObserverErrorHandler.getInstance();
                                if (inst.getStats().paused) {
                                  inst.resume();
                                  hscopeLogger.log('ro', 'late resume after deferred batch');
                                }
                              } catch {
                                /* ignore */
                              }
                            }
                          }, 120); // shorter since requestAutoFit already delays
                        }
                      } catch (err) {
                        hscopeLogger.error(
                          'toggle',
                          'Error during batched container toggle processing',
                          err
                        );
                        try {
                          ResizeObserverErrorHandler.getInstance().resume();
                        } catch {
                          /* ignore */
                        }
                      }
                    });
                  }
                }}
                colorPalette={colorPalette}
              />
            )}

            {/* HydroscopeCore - Takes remaining space */}
            <HydroscopeCore
              ref={hydroscopeRef}
              data={data}
              grouping={grouping}
              config={renderConfig}
              layoutConfig={layoutConfig}
              onParsed={handleParsed}
              eventHandlers={{
                onNodeClick: handleNodeClick,
              }}
              fillViewport={false}
              reactFlowControlsScale={renderConfig.reactFlowControlsScale}
              style={{
                flex: 1,
                minHeight: '500px',
                height: '100%',
                width: '100%',
                minWidth: '400px',
              }}
              onCollapseAll={handlePackAll}
              onExpandAll={handleUnpackAll}
              onFitView={async () => {
                if (hydroscopeRef.current?.fitView) {
                  const fitFn = hydroscopeRef.current.fitView;
                  // Use consolidated system for manual fitView
                  consolidatedOperationManager.requestAutoFit(fitFn, undefined, 'manual-fitview');
                }
              }}
              autoFit={autoFitEnabled}
              onAutoFitToggle={enabled => {
                setAutoFitEnabled(enabled);
                setRenderConfig(prev => ({ ...prev, fitView: enabled }));
              }}
              onLoadFile={showFileUpload ? handleLoadFile : undefined}
              showLoadFile={showFileUpload}
              // search highlight props
              searchQuery={searchQuery}
              searchMatches={searchMatches}
              currentSearchMatchId={currentSearchMatchId}
            />

            {/* Floating Action Buttons */}
            {/* Control Buttons - Right side vertically stacked */}
            <div
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {/* Info Panel Button */}
              <div
                style={{
                  boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                  borderRadius: '1px',
                  background: '#fff',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Button
                  type="default"
                  icon={<InfoCircleOutlined style={{ color: '#222', fontSize: '20px' }} />}
                  onClick={() => setInfoPanelOpen(true)}
                  title="Show Info Panel"
                  size="small"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    width: '32px',
                    height: '32px',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
              </div>

              {/* Style Panel Button */}
              <div
                style={{
                  boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                  borderRadius: '1px',
                  background: '#fff',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Button
                  type="default"
                  icon={<SettingOutlined style={{ color: '#222', fontSize: '20px' }} />}
                  onClick={() => setStylePanelOpen(true)}
                  title="Show Style Panel"
                  size="small"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    width: '32px',
                    height: '32px',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
              </div>
            </div>

            {/* Style Tuner Panel - Drawer */}
            <StyleTunerPanel
              open={stylePanelOpen}
              onOpenChange={setStylePanelOpen}
              value={renderConfig}
              onChange={(newStyles: {
                edgeStyle?: 'bezier' | 'straight' | 'smoothstep';
                edgeWidth?: number;
                edgeDashed?: boolean;
                nodePadding?: number;
                nodeFontSize?: number;
                containerBorderWidth?: number;
                reactFlowControlsScale?: number;
              }) => {
                const newConfig = {
                  ...renderConfig,
                  ...newStyles,
                };
                setRenderConfig(newConfig);

                if (visualizationState) {
                  visualizationState.updateNodeDimensions(newConfig);

                  // Trigger layout refresh (refreshLayout already uses consolidatedOperationManager)
                  if (hydroscopeRef.current?.refreshLayout) {
                    hydroscopeRef.current.refreshLayout(true); // Force relayout
                  }
                }
              }}
              currentLayout={layoutAlgorithm}
              onLayoutChange={newLayout => {
                setLayoutAlgorithm(newLayout);
              }}
              colorPalette={colorPalette}
              onPaletteChange={newPalette => {
                setColorPalette(newPalette);
              }}
              onResetToDefaults={handleResetToDefaults}
            />

            {/* Performance Dashboard - Development Only */}
            {isDevelopment() && PerformanceDashboard && (
              <PerformanceDashboard
                visible={performancePanelOpen}
                onClose={() => setPerformancePanelOpen(false)}
                autoRefresh={true}
                refreshInterval={2000}
              />
            )}
          </div>
        )}
      </div>
    );
  }
);

Hydroscope.displayName = 'Hydroscope';

export default Hydroscope;
