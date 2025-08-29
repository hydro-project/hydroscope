import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { Card, Button, message } from 'antd';
import { InfoCircleOutlined, SettingOutlined } from '@ant-design/icons';
import { Hydroscope, type HydroscopeProps, type HydroscopeRef } from './Hydroscope';
import { FileDropZone } from './FileDropZone';
import { StyleTunerPanel } from './StyleTunerPanel';
import { InfoPanel } from './InfoPanel';
import type { VisualizationState } from '../core/VisualizationState';
import type { RenderConfig } from '../core/types';
import { parseGraphJSON, createRenderConfig } from '../core/JSONParser';
import {
  saveToStorage,
  loadFromStorage,
  clearHydroscopeStorage,
  STORAGE_KEYS,
  isStorageAvailable
} from '../utils/persistence';

export interface HydroscopeFullProps extends Omit<HydroscopeProps, 'eventHandlers' | 'onParsed'> {
  // Layout and styling
  showFileUpload?: boolean;        // Show file upload area (default: true)
  showInfoPanel?: boolean;         // Show control sidebar (default: true)
  showStylePanel?: boolean;        // Show styling sidebar (default: true)

  // Feature toggles
  enableCollapse?: boolean;        // Enable container interaction (default: true)
  autoFit?: boolean;              // Auto-fit after operations (default: true)

  // Initial state
  initialLayoutAlgorithm?: string; // Initial layout algorithm
  initialColorPalette?: string;    // Initial color palette

  // Large-file support: display a generated file path to load from disk
  generatedFilePath?: string;

  // Callbacks
  onFileUpload?: (data: any, filename: string) => void;
  onNodeClick?: (event: any, node: any, visualizationState: VisualizationState) => void;
  onContainerCollapse?: (containerId: string, visualizationState: VisualizationState) => void;
  onContainerExpand?: (containerId: string, visualizationState: VisualizationState) => void;
  onParsed?: (metadata: any, visualizationState: VisualizationState) => void;
  onConfigChange?: (config: RenderConfig) => void;
}

/**
 * HydroscopeFull: Complete graph visualization experience with full UI.
 * 
 * Features:
 * - File upload and drag-drop
 * - Layout algorithm controls  
 * - Style tuning panel with color palettes
 * - Interactive container collapse/expand
 * - Information panel with metadata
 * - Grouping controls
 * - Pack/Unpack all operations
 * 
 * This replicates the complete /vis experience in a single component.
 */
export function HydroscopeFull({
  data: initialData,
  showFileUpload = true,
  showInfoPanel = true,
  showStylePanel = true,
  enableCollapse = true,
  autoFit = true,
  initialLayoutAlgorithm = 'mrtree',
  initialColorPalette = 'Set3',
  onFileUpload,
  onNodeClick,
  onContainerCollapse,
  onContainerExpand,
  onParsed,
  onConfigChange,
  style,
  ...hydroscopeProps
}: HydroscopeFullProps) {
  // All hooks and effects go here, inside the function body
  const [data, setData] = useState(initialData);
  const [visualizationState, setVisualizationState] = useState<VisualizationState | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [graphData, setGraphData] = useState<any>(null); // Raw parsed JSON data like vis.js
  const [edgeStyleConfig, setEdgeStyleConfig] = useState<any>(null); // Processed edge style config
  const [isLayoutRunning, setIsLayoutRunning] = useState(false);
  // Derive collapsed containers from visualization state instead of maintaining separate state
  // Force re-computation when any layout refresh happens
  const [layoutRefreshCounter, setLayoutRefreshCounter] = useState(0);
  const collapsedContainersFromState = useMemo(() => {
    if (!visualizationState) return new Set<string>();
    const collapsedSet = new Set(visualizationState.visibleContainers
      .filter(container => container.collapsed)
      .map(container => container.id));
    
    console.log('🏗️ HydroscopeFull: collapsedContainersFromState recalculated', {
      refreshCounter: layoutRefreshCounter,
      allContainers: visualizationState.visibleContainers.map(c => ({ 
        id: c.id, 
        collapsed: c.collapsed,
        label: c.label || c.id
      })),
      collapsedSet: Array.from(collapsedSet)
    });
    
    return collapsedSet;
  }, [visualizationState, layoutRefreshCounter]);
  const [hasParsedData, setHasParsedData] = useState<boolean>(false);
  const initialCollapsedCountRef = useRef<number>(0);
  const smartCollapseToastShownRef = useRef<boolean>(false);

  // Drawer states
  const [infoPanelOpen, setInfoPanelOpen] = useState(false); // Start collapsed
  const [stylePanelOpen, setStylePanelOpen] = useState(false); // Start collapsed

  // Default values for reset functionality
  const defaultRenderConfig = {
    ...hydroscopeProps.config,
    edgeStyleConfig: (initialData && typeof initialData === 'object' && (initialData as any).edgeStyleConfig) || undefined
  };
  const defaultColorPalette = initialColorPalette;
  const defaultLayoutAlgorithm = initialLayoutAlgorithm;
  const defaultAutoFit = autoFit;

  // Load persisted settings with graceful fallback
  const storageAvailable = isStorageAvailable();
  const persistedRenderConfig = storageAvailable ? loadFromStorage(STORAGE_KEYS.RENDER_CONFIG, defaultRenderConfig) : defaultRenderConfig;
  const persistedColorPalette = storageAvailable ? loadFromStorage(STORAGE_KEYS.COLOR_PALETTE, defaultColorPalette) : defaultColorPalette;
  const persistedLayoutAlgorithm = storageAvailable ? loadFromStorage(STORAGE_KEYS.LAYOUT_ALGORITHM, defaultLayoutAlgorithm) : defaultLayoutAlgorithm;
  const persistedAutoFit = storageAvailable ? loadFromStorage(STORAGE_KEYS.AUTO_FIT, defaultAutoFit) : defaultAutoFit;

  // Ensure renderConfig.edgeStyleConfig is always in sync with graphData.edgeStyleConfig
  useEffect(() => {
    if (graphData && graphData.edgeStyleConfig) {
      setRenderConfig(prev => ({
        ...prev,
        edgeStyleConfig: graphData.edgeStyleConfig
      }));
    }
  }, [graphData]);

  // Sync internal data state with prop changes
  useEffect(() => {
    // Sync internal data only when the prop changes; do not override local resets
    setData(initialData);
  }, [initialData]);

  // Configuration state with persistence
  const [grouping, setGrouping] = useState<string | undefined>(hydroscopeProps.grouping);
  const [colorPalette, setColorPalette] = useState(persistedColorPalette);
  const [layoutAlgorithm, setLayoutAlgorithm] = useState(persistedLayoutAlgorithm);
  const [renderConfig, setRenderConfig] = useState<RenderConfig>(persistedRenderConfig);
  const [autoFitEnabled, setAutoFitEnabled] = useState<boolean>(persistedAutoFit);

  const hydroscopeRef = useRef<HydroscopeRef>(null);

  // Update render config when settings change
  useEffect(() => {
    // Keep renderConfig in sync with palette and auto-fit preference
    setRenderConfig(prev => {
      const next = {
        ...prev,
        colorPalette,
        fitView: autoFitEnabled,
        edgeStyleConfig: (graphData && graphData.edgeStyleConfig) || prev.edgeStyleConfig
      } as RenderConfig;
      onConfigChange?.(next);
      return next;
    });
  }, [colorPalette, autoFitEnabled, onConfigChange]);

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
  }, [defaultRenderConfig, defaultColorPalette, defaultLayoutAlgorithm, defaultAutoFit, storageAvailable]);

  // Handle file upload
  const handleFileUpload = useCallback((uploadedData: any, filename: string) => {
    setData(uploadedData);
    onFileUpload?.(uploadedData, filename);
  }, [onFileUpload]);

  // Handle parsing to get access to visualization state
  const handleParsed = useCallback((parsedMetadata: any, visState: VisualizationState) => {
    setVisualizationState(visState);
    setMetadata(parsedMetadata);

    // Initialize collapsed containers are handled automatically by VisualizationState
    // No need to manually track them here
    initialCollapsedCountRef.current = visState.visibleContainers.filter(c => c.collapsed).length;

    onParsed?.(parsedMetadata, visState);
  }, [onParsed]);

  // Show a small toast once if Smart Collapse collapsed any containers on initial layout
  useEffect(() => {
    if (!visualizationState || smartCollapseToastShownRef.current) return;
    const t = setTimeout(() => {
      try {
        const currentCollapsed = visualizationState.visibleContainers
          .filter(c => c.collapsed)
          .map(c => c.id);
        const collapsedCount = currentCollapsed.length;
        if (collapsedCount > initialCollapsedCountRef.current) {
          message.success(`Smart Collapse applied: ${collapsedCount} containers collapsed`);
          // No need to manually sync - collapsedContainersFromState will automatically update
          smartCollapseToastShownRef.current = true;
        }
      } catch { }
    }, 900);
    return () => clearTimeout(t);
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
      const looksLikePath = !looksLikeJSON && (/^\//.test(trimmed) || /^file:\/\//i.test(trimmed) || /\.json$/i.test(trimmed));

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
        console.error('Failed to parse JSON data:', e);
        setHasParsedData(false);
        return;
      }
    } else if (data && typeof data === 'object') {
      jsonData = data;
    }

    if (jsonData) {
      setGraphData(jsonData);
      setHasParsedData(true);

      // Only create edge style config on initial data load, not on grouping changes
      try {
        const parsedData = parseGraphJSON(jsonData, grouping);
        const renderConfig = createRenderConfig(parsedData);
        setEdgeStyleConfig(renderConfig);
      } catch (e) {
        console.error('Failed to create render config:', e);
      }
    }
  }, [data]); // Only depend on data, NOT grouping

  // Default interactive node click handler
  const handleNodeClick = useCallback(async (event: any, node: any) => {
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
      // Built-in container collapse/expand logic
      try {
        setIsLayoutRunning(true);

        if (container.collapsed) {
          visualizationState.expandContainer(node.id);
          onContainerExpand?.(node.id, visualizationState);
        } else {
          visualizationState.collapseContainer(node.id);
          onContainerCollapse?.(node.id, visualizationState);
        }

        // Trigger layout refresh
        if (hydroscopeRef.current?.refreshLayout) {
          await hydroscopeRef.current.refreshLayout();
        }

        // Force re-computation of collapsed containers state for InfoPanel
        setLayoutRefreshCounter(prev => prev + 1);

        // Auto-fit after layout completes
        if (autoFitEnabled && hydroscopeRef.current?.fitView) {
          setTimeout(() => {
            hydroscopeRef.current?.fitView();
          }, 300);
        }
      } catch (err) {
        console.error('❌ Error toggling container:', err);
      } finally {
        setIsLayoutRunning(false);
      }
      return; // Exit early after handling container
    }

    // Handle regular graph node label toggle
    const graphNode = visualizationState.getGraphNode(node.id);
    
    if (graphNode && graphNode.fullLabel && graphNode.shortLabel && graphNode.fullLabel !== graphNode.shortLabel) {
      // Toggle between short and full label (only if they're actually different)
      const currentLabel = graphNode.label || graphNode.shortLabel;
      const isShowingShort = currentLabel === graphNode.shortLabel;
      const newLabel = isShowingShort ? graphNode.fullLabel : graphNode.shortLabel;
      
      // Update the node's label field
      visualizationState.updateNode(node.id, { label: newLabel });
      
      // Trigger a refresh to update the display
      try {
        if (hydroscopeRef.current?.refreshLayout) {
          // Use refreshLayout to force a re-conversion of the visualization state
          await hydroscopeRef.current.refreshLayout(false);
        }
      } catch (err) {
        console.error('❌ Error refreshing after label toggle:', err);
      }
    } else {
    }
  }, [visualizationState, enableCollapse, autoFitEnabled, onNodeClick, onContainerCollapse, onContainerExpand]);

  // Pack all containers (collapse all)
  const handlePackAll = useCallback(async () => {
    if (!visualizationState) return;

    try {
      setIsLayoutRunning(true);
      visualizationState.collapseAllContainers();

      // Trigger layout refresh
      if (hydroscopeRef.current?.refreshLayout) {
        await hydroscopeRef.current.refreshLayout();
      }

      // Auto-fit after packing
      if (autoFitEnabled && hydroscopeRef.current?.fitView) {
        setTimeout(() => {
          hydroscopeRef.current?.fitView();
        }, 500);
      }
    } catch (err) {
      console.error('❌ Error packing containers:', err);
    } finally {
      setIsLayoutRunning(false);
    }
  }, [visualizationState, autoFitEnabled]);

  // Unpack all containers (expand all)
  const handleUnpackAll = useCallback(async () => {
    if (!visualizationState) return;

    try {
      setIsLayoutRunning(true);
      visualizationState.expandAllContainers();

      // Trigger layout refresh
      if (hydroscopeRef.current?.refreshLayout) {
        await hydroscopeRef.current.refreshLayout();
      }

      // Auto-fit after unpacking
      if (autoFitEnabled && hydroscopeRef.current?.fitView) {
        setTimeout(() => {
          hydroscopeRef.current?.fitView();
        }, 500);
      }
    } catch (err) {
      console.error('❌ Error unpacking containers:', err);
    } finally {
      setIsLayoutRunning(false);
    }
  }, [visualizationState, autoFitEnabled]);

  // Handle layout algorithm change
  const handleLayoutChange = useCallback(async (algorithm: string) => {
    setLayoutAlgorithm(algorithm);
    if (hydroscopeRef.current?.refreshLayout) {
      setIsLayoutRunning(true);
      try {
        await hydroscopeRef.current.refreshLayout();
      } finally {
        setIsLayoutRunning(false);
      }
    }
  }, []);

  // Handle grouping change
  const handleGroupingChange = useCallback((newGrouping: string | undefined) => {

    setGrouping(newGrouping);

    // Re-create edge style config with new grouping, like vis.js handleGroupingChange
    if (graphData) {
      try {
        const parsedData = parseGraphJSON(graphData, newGrouping);

        const renderConfig = createRenderConfig(parsedData);

        setEdgeStyleConfig(renderConfig);
      } catch (e) {
        console.error('Failed to update render config for grouping change:', e);
      }
    }

  }, [graphData]);

  // Handle load another file
  const handleLoadFile = useCallback(() => {
    // Clean URL: drop any hash and ?file param
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.hash = '';
        url.searchParams.delete('file');
        window.history.replaceState(null, '', url.toString());
      } catch { }
    }
    // Reset to file drop zone
    setHasParsedData(false);
    setGraphData(null);
    setVisualizationState(null);
    setMetadata(null);
    // collapsedContainers will be automatically derived from visualizationState
    smartCollapseToastShownRef.current = false;
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
    position: 'relative'
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
          {/* Info Panel - Left side */}
          {showInfoPanel && visualizationState && (
            <InfoPanel
              visualizationState={visualizationState}
              legendData={graphData && graphData.legend ? graphData.legend : {}}
              edgeStyleConfig={graphData && graphData.edgeStyleConfig ? graphData.edgeStyleConfig : undefined}
              hierarchyChoices={metadata?.availableGroupings || []}
              currentGrouping={grouping}
              onGroupingChange={handleGroupingChange}
              open={infoPanelOpen}
              onOpenChange={setInfoPanelOpen}
              onToggleContainer={async (containerId) => {
                console.log('🏗️ HydroscopeFull: onToggleContainer called with', containerId);
                try {
                  const container = visualizationState.getContainer(containerId);
                  console.log('🏗️ HydroscopeFull: container found', { containerId, collapsed: container?.collapsed });
                  if (container) {
                    if (container.collapsed) {
                      console.log('🏗️ HydroscopeFull: expanding container', containerId);
                      visualizationState.expandContainer(containerId);
                      onContainerExpand?.(containerId, visualizationState);
                    } else {
                      console.log('🏗️ HydroscopeFull: collapsing container', containerId);
                      visualizationState.collapseContainer(containerId);
                      onContainerCollapse?.(containerId, visualizationState);
                    }
                    // No need to manually update collapsed containers - it's derived from visualizationState
                    if (hydroscopeRef.current?.refreshLayout) {
                      await hydroscopeRef.current.refreshLayout();
                    }
                    // Force re-computation of collapsed containers state for InfoPanel
                    setLayoutRefreshCounter(prev => prev + 1);
                  }
                } catch (err) {
                  console.error('❌ Error toggling container:', err);
                }
              }}
              collapsedContainers={collapsedContainersFromState}
              colorPalette={colorPalette}
            />
          )}

          {/* Hydroscope - Takes remaining space */}
          <Hydroscope
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
            style={{ 
              flex: 1,
              minHeight: '500px',
              height: '100%',
              width: '100%',
              minWidth: '400px'
            }}
            onCollapseAll={handlePackAll}
            onExpandAll={handleUnpackAll}
            onFitView={() => hydroscopeRef.current?.fitView?.()}
            autoFit={autoFitEnabled}
            onAutoFitToggle={(enabled) => {
              setAutoFitEnabled(enabled);
              setRenderConfig(prev => ({ ...prev, fitView: enabled }));
            }}
            onLoadFile={showFileUpload ? handleLoadFile : undefined}
            showLoadFile={showFileUpload}
            {...hydroscopeProps}
          />

          {/* Floating Action Buttons */}
          {/* Info Panel Button - Left */}
          <div style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            zIndex: 100,
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            borderRadius: '1px',
            background: '#fff',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // border: '0px solid #444'
          }}>
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
                justifyContent: 'center'
              }}
            />
          </div>

          {/* Style Panel Button - Right */}
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            zIndex: 100,
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            borderRadius: '1px',
            background: '#fff',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // border: '1px solid #444'
          }}>
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
                justifyContent: 'center'
              }}
            />
          </div>

          {/* Style Tuner Panel - Drawer */}
          <StyleTunerPanel
            open={stylePanelOpen}
            onOpenChange={setStylePanelOpen}
            value={renderConfig}
            onChange={(newStyles: {
              edgeStyle?: "bezier" | "straight" | "smoothstep";
              edgeWidth?: number;
              edgeDashed?: boolean;
              nodePadding?: number;
              nodeFontSize?: number;
              containerBorderWidth?: number;
            }) => {
              const newConfig = {
                ...renderConfig,
                ...newStyles,
              };
              setRenderConfig(newConfig);

              if (visualizationState) {
                visualizationState.updateNodeDimensions(newConfig);
                hydroscopeRef.current?.refreshLayout(true); // Force relayout
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
