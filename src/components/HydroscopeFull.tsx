  // ...existing code...
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Layout, Card, Button, message, Divider } from 'antd';
import { InfoCircleOutlined, SettingOutlined } from '@ant-design/icons';
import { Hydroscope, type HydroscopeProps, type HydroscopeRef } from './Hydroscope';
import { FileDropZone } from './FileDropZone';
import { LayoutControls } from './LayoutControls';
import { StyleTunerPanel } from './StyleTunerPanel';
import { InfoPanel } from './InfoPanel';
import { GroupingControls } from './GroupingControls';
import type { VisualizationState } from '../core/VisualizationState';
import type { RenderConfig } from '../core/types';
import { parseGraphJSON, createRenderConfig } from '../core/JSONParser';

const { Content } = Layout;

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
  const [collapsedContainers, setCollapsedContainers] = useState<Set<string>>(new Set());
  const [hasParsedData, setHasParsedData] = useState<boolean>(false);
  const initialCollapsedCountRef = useRef<number>(0);
  const smartCollapseToastShownRef = useRef<boolean>(false);

  // Drawer states
  const [infoPanelOpen, setInfoPanelOpen] = useState(false); // Start collapsed
  const [stylePanelOpen, setStylePanelOpen] = useState(false); // Start collapsed

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
  
  // Configuration state
  const [grouping, setGrouping] = useState<string | undefined>(hydroscopeProps.grouping);
  const [colorPalette, setColorPalette] = useState(initialColorPalette);
  const [layoutAlgorithm, setLayoutAlgorithm] = useState(initialLayoutAlgorithm);
  const [renderConfig, setRenderConfig] = useState<RenderConfig>({
    ...hydroscopeProps.config,
    edgeStyleConfig: (initialData && typeof initialData === 'object' && (initialData as any).edgeStyleConfig) || undefined
  });
  const [autoFitEnabled, setAutoFitEnabled] = useState<boolean>(autoFit);
  
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

  // Handle file upload
  const handleFileUpload = useCallback((uploadedData: any, filename: string) => {
    setData(uploadedData);
    onFileUpload?.(uploadedData, filename);
  }, [onFileUpload]);

  // Handle parsing to get access to visualization state
  const handleParsed = useCallback((parsedMetadata: any, visState: VisualizationState) => {
    setVisualizationState(visState);
    setMetadata(parsedMetadata);
    
    // Initialize collapsed containers state
  const initialCollapsedContainers = new Set(visState.visibleContainers
      .filter(container => container.collapsed)
      .map(container => container.id));
    setCollapsedContainers(initialCollapsedContainers);
  initialCollapsedCountRef.current = initialCollapsedContainers.size;
    
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
          // Keep InfoPanel in sync with actual collapsed state
          setCollapsedContainers(new Set(currentCollapsed));
          smartCollapseToastShownRef.current = true;
        }
      } catch {}
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

    if (!enableCollapse) return;

    // Built-in container collapse/expand logic
    const container = visualizationState.getContainer(node.id);
    if (container) {
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

  const layoutConfig = {
    algorithm: layoutAlgorithm as any,
  enableSmartCollapse: true,
  };

  const mainContentStyle: React.CSSProperties = {
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  };

  const contentStyle: React.CSSProperties = {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const graphContainerStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  };
  
  // Instrument the graph container size once to confirm parent-provided height
  const graphContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = graphContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    console.log(`[HydroscopeFull] graph container size: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
  }, []);

  // Diagnostic: log props passed to InfoPanel and Hydroscope on each render

  return (
    <Layout style={mainContentStyle}>
      <Content style={contentStyle}>
  {/* File Upload Area: show when no parsed data is available */}
  {showFileUpload && !hasParsedData && (
          <Card style={{ margin: '16px', flexShrink: 0 }}>
            <FileDropZone
              onFileUpload={handleFileUpload}
              acceptedTypes={['.json']}
      generatedFilePath={hydroscopeProps.generatedFilePath}
            />
          </Card>
        )}

        {/* Main Graph Area with horizontal layout like vis.js */}
        {hasParsedData && data && (
          <div ref={graphContainerRef} style={{ ...graphContainerStyle }}>
            {/* Layout Controls - Horizontal bar above graph like vis.js */}
            {visualizationState && (
              <div style={{ 
                marginBottom: '8px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '0 16px'
              }}>
                <LayoutControls
                  visualizationState={visualizationState}
                  currentLayout={layoutAlgorithm}
                  onLayoutChange={handleLayoutChange}
                  onCollapseAll={handlePackAll}
                  onExpandAll={handleUnpackAll}
                  autoFit={autoFitEnabled}
                  onAutoFitToggle={(enabled) => {
                    setAutoFitEnabled(enabled);
                    setRenderConfig(prev => ({ ...prev, fitView: enabled }));
                  }}
                  onFitView={() => hydroscopeRef.current?.fitView?.()}
                />
                {showFileUpload && (
                  <Button
                    onClick={() => {
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
                      setCollapsedContainers(new Set());
                      smartCollapseToastShownRef.current = false;
                      initialCollapsedCountRef.current = 0;
                      // If we have a generated file path, restore it; else clear data
                      const nextData = hydroscopeProps.generatedFilePath || null;
                      setData(nextData as any);
                      // Optional: notify and propagate config if needed
                      message.info('Ready to load another file');
                    }}
                  >
                    Load another file
                  </Button>
                )}
              </div>
            )}
            
            {/* Subtle divider below layout controls */}
            <div style={{ 
              height: '1px', 
              backgroundColor: '#f0f0f0', 
              margin: '8px 16px',
              borderRadius: '0.5px'
            }} />

            {/* Graph container with horizontal layout */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              flex: 1,
              minHeight: 0,
              height: '100%',
              overflow: 'hidden'
            }}>
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
                      try {
                        const container = visualizationState.getContainer(containerId);
                        if (container) {
                          if (container.collapsed) {
                            visualizationState.expandContainer(containerId);
                            onContainerExpand?.(containerId, visualizationState);
                          } else {
                            visualizationState.collapseContainer(containerId);
                            onContainerCollapse?.(containerId, visualizationState);
                          }
                          // Update collapsed containers state
                          const newCollapsedContainers = new Set(visualizationState.visibleContainers
                            .filter(container => container.collapsed)
                            .map(container => container.id));
                          setCollapsedContainers(newCollapsedContainers);
                          if (hydroscopeRef.current?.refreshLayout) {
                            await hydroscopeRef.current.refreshLayout();
                          }
                        }
                      } catch (err) {
                        console.error('❌ Error toggling container:', err);
                      }
                    }}
                    collapsedContainers={collapsedContainers}
                    colorPalette={colorPalette}
                  />
              )}
              
              {/* Flow Graph - Takes remaining space */}
              <div style={{ 
                flex: 1,
                minHeight: 0,
                height: '100%',
                position: 'relative',
                overflow: 'hidden'
              }}>
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
                    style={{ width: '100%', height: '100%' }}
                    {...hydroscopeProps}
                  />
                
                {/* Floating Action Buttons */}
                {/* Info Panel Button - Left */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  zIndex: 1000
                }}>
                  <Button
                    type="primary"
                    shape="circle"
                    icon={<InfoCircleOutlined />}
                    onClick={() => setInfoPanelOpen(true)}
                    title="Show Info Panel"
                    size="large"
                    style={{ 
                      backgroundColor: infoPanelOpen ? '#1890ff' : '#ffffff',
                      borderColor: '#1890ff',
                      color: infoPanelOpen ? '#ffffff' : '#1890ff',
                      width: '56px',
                      height: '56px',
                      fontSize: '20px'
                    }}
                  />
                </div>
                
                {/* Style Panel Button - Right */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  zIndex: 1000
                }}>
                  <Button
                    type="primary"
                    shape="circle"
                    icon={<SettingOutlined />}
                    onClick={() => setStylePanelOpen(true)}
                    title="Show Style Panel"
                    size="large"
                    style={{ 
                      backgroundColor: stylePanelOpen ? '#1890ff' : '#ffffff',
                      borderColor: '#1890ff',
                      color: stylePanelOpen ? '#ffffff' : '#1890ff',
                      width: '56px',
                      height: '56px',
                      fontSize: '20px'
                    }}
                  />
                </div>

                {/* Style Tuner Panel - Drawer */}
                <StyleTunerPanel
                  open={stylePanelOpen}
                  onOpenChange={setStylePanelOpen}
                  value={renderConfig}
                  onChange={(newStyles) => {
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
                  colorPalette={colorPalette}
                  onPaletteChange={setColorPalette}
                />
              </div>
            </div>
          </div>
        )}
      </Content>
    </Layout>
  );
}

export default HydroscopeFull;
