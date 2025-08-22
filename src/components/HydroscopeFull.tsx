import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Layout, Card } from 'antd';
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
  showSidebar?: boolean;          // Show control sidebar (default: true)
  
  // Feature toggles
  enableCollapse?: boolean;        // Enable container interaction (default: true)
  autoFit?: boolean;              // Auto-fit after operations (default: true)
  
  // Initial state
  initialLayoutAlgorithm?: string; // Initial layout algorithm
  initialColorPalette?: string;    // Initial color palette
  
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
  showSidebar = true,
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
  ...hydroscopeProps
}: HydroscopeFullProps) {
  const [data, setData] = useState(initialData);
  const [visualizationState, setVisualizationState] = useState<VisualizationState | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [graphData, setGraphData] = useState<any>(null); // Raw parsed JSON data like vis.js
  const [edgeStyleConfig, setEdgeStyleConfig] = useState<any>(null); // Processed edge style config
  const [isLayoutRunning, setIsLayoutRunning] = useState(false);
  const [collapsedContainers, setCollapsedContainers] = useState<Set<string>>(new Set());
  
  // Sync internal data state with prop changes
  useEffect(() => {
    if (initialData !== data) {
      setData(initialData);
    }
  }, [initialData, data]);
  
  // Configuration state
  const [grouping, setGrouping] = useState<string | undefined>(hydroscopeProps.grouping);
  const [colorPalette, setColorPalette] = useState(initialColorPalette);
  const [layoutAlgorithm, setLayoutAlgorithm] = useState(initialLayoutAlgorithm);
  const [renderConfig, setRenderConfig] = useState<RenderConfig>(hydroscopeProps.config || {});
  
  const hydroscopeRef = useRef<HydroscopeRef>(null);

  // Update render config when settings change
  useEffect(() => {
    const newConfig: RenderConfig = {
      ...renderConfig,
      colorPalette,
      fitView: autoFit,
    };
    setRenderConfig(newConfig);
    onConfigChange?.(newConfig);
  }, [colorPalette, autoFit, onConfigChange]);

  // Handle file upload
  const handleFileUpload = useCallback((uploadedData: any, filename: string) => {
    console.log(`📁 File uploaded: ${filename}`);
    setData(uploadedData);
    onFileUpload?.(uploadedData, filename);
  }, [onFileUpload]);

  // Handle parsing to get access to visualization state
  const handleParsed = useCallback((parsedMetadata: any, visState: VisualizationState) => {
    console.log('🎯 HydroscopeFull: Received visualization state');
    setVisualizationState(visState);
    setMetadata(parsedMetadata);
    
    // Initialize collapsed containers state
    const initialCollapsedContainers = new Set(visState.visibleContainers
      .filter(container => container.collapsed)
      .map(container => container.id));
    setCollapsedContainers(initialCollapsedContainers);
    
    onParsed?.(parsedMetadata, visState);
  }, [onParsed]);

  // Initialize graph data and edge style config when data first loads
  useEffect(() => {
    if (!data) return;
    
    let jsonData = null;
    if (typeof data === 'string') {
      try {
        jsonData = JSON.parse(data);
      } catch (e) {
        console.error('Failed to parse JSON data:', e);
        return;
      }
    } else if (data && typeof data === 'object') {
      jsonData = data;
    }
    
    if (jsonData) {
      setGraphData(jsonData);
      
      // Only create edge style config on initial data load, not on grouping changes
      try {
        const parsedData = parseGraphJSON(jsonData, grouping);
        const renderConfig = createRenderConfig(parsedData);
        setEdgeStyleConfig(renderConfig);
        console.log('🎯 Created edge style config:', renderConfig);
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
          console.log(`🔄 Expanding container: ${node.id}`);
          visualizationState.expandContainer(node.id);
          onContainerExpand?.(node.id, visualizationState);
        } else {
          console.log(`🔄 Collapsing container: ${node.id}`);
          visualizationState.collapseContainer(node.id);
          onContainerCollapse?.(node.id, visualizationState);
        }

        // Trigger layout refresh
        if (hydroscopeRef.current?.refreshLayout) {
          await hydroscopeRef.current.refreshLayout();
        }

        // Auto-fit after layout completes
        if (autoFit && hydroscopeRef.current?.fitView) {
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
  }, [visualizationState, enableCollapse, autoFit, onNodeClick, onContainerCollapse, onContainerExpand]);

  // Pack all containers (collapse all)
  const handlePackAll = useCallback(async () => {
    if (!visualizationState) return;
    
    try {
      setIsLayoutRunning(true);
      console.log('📦 Packing all containers...');
      
      visualizationState.collapseAllContainers();
      
      // Trigger layout refresh
      if (hydroscopeRef.current?.refreshLayout) {
        await hydroscopeRef.current.refreshLayout();
      }

      // Auto-fit after packing
      if (autoFit && hydroscopeRef.current?.fitView) {
        setTimeout(() => {
          hydroscopeRef.current?.fitView();
        }, 500);
      }
    } catch (err) {
      console.error('❌ Error packing containers:', err);
    } finally {
      setIsLayoutRunning(false);
    }
  }, [visualizationState, autoFit]);

  // Unpack all containers (expand all)
  const handleUnpackAll = useCallback(async () => {
    if (!visualizationState) return;
    
    try {
      setIsLayoutRunning(true);
      console.log('📂 Unpacking all containers...');
      
      visualizationState.expandAllContainers();
      
      // Trigger layout refresh
      if (hydroscopeRef.current?.refreshLayout) {
        await hydroscopeRef.current.refreshLayout();
      }

      // Auto-fit after unpacking
      if (autoFit && hydroscopeRef.current?.fitView) {
        setTimeout(() => {
          hydroscopeRef.current?.fitView();
        }, 500);
      }
    } catch (err) {
      console.error('❌ Error unpacking containers:', err);
    } finally {
      setIsLayoutRunning(false);
    }
  }, [visualizationState, autoFit]);

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
        console.log('🎯 Updated edge style config for grouping change:', renderConfig);
      } catch (e) {
        console.error('Failed to update render config for grouping change:', e);
      }
    }
    
  }, [graphData]);

  const layoutConfig = {
    algorithm: layoutAlgorithm as any,
  };

  const mainContentStyle: React.CSSProperties = {
    height: '100vh',
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
    minHeight: 0, // Important for flex child to shrink
  };

  return (
    <Layout style={mainContentStyle}>
      <Content style={contentStyle}>
        {/* File Upload Area */}
        {showFileUpload && !data && (
          <Card style={{ margin: '16px', flexShrink: 0 }}>
            <FileDropZone
              onFileUpload={handleFileUpload}
              acceptedTypes={['.json']}
            />
          </Card>
        )}

        {/* Main Graph Area with horizontal layout like vis.js */}
        {data && (
          <div style={{ ...graphContainerStyle }}>
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
                  autoFit={autoFit}
                  onAutoFitToggle={(enabled) => {
                    // Update the render config to include fitView
                    const newConfig = { ...renderConfig, fitView: enabled };
                    setRenderConfig(newConfig);
                  }}
                  onFitView={() => hydroscopeRef.current?.fitView?.()}
                />
              </div>
            )}

            {/* Graph container with horizontal layout */}
            <div style={{
              display: 'flex',
              flexDirection: 'row', // Horizontal layout
              height: '600px', // Set explicit height
              border: '1px solid #ddd',
              borderRadius: '8px',
              backgroundColor: 'white',
              overflow: 'hidden'
            }}>
              {/* Info Panel - Left sidebar (matches vis.js layout) */}
              {showSidebar && visualizationState && (
                <div style={{
                  width: '300px',
                  height: '100%',
                  borderRight: '1px solid #eee',
                  overflow: 'auto',
                  flexShrink: 0,
                  background: '#fff',
                }}>
                  <InfoPanel
                    visualizationState={visualizationState}
                    legendData={graphData && graphData.legend ? graphData.legend : {}}
                    edgeStyleConfig={edgeStyleConfig}
                    hierarchyChoices={metadata?.availableGroupings || []}
                    currentGrouping={grouping}
                    onGroupingChange={handleGroupingChange}
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
                </div>
              )}
              
              {/* Flow Graph - Takes remaining space */}
              <div style={{ 
                flex: 1,
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
                  fillViewport={true}
                  {...hydroscopeProps}
                />
                
                {/* Style Tuner Panel - Absolute positioned like vis.js */}
                <div style={{ 
                  position: 'absolute', 
                  top: '12px', 
                  right: '12px', 
                  zIndex: 1500, 
                  width: '320px' 
                }}>
                  <Card size="small">
                    <StyleTunerPanel
                      value={{}}
                      onChange={() => {}}
                      colorPalette={colorPalette}
                      onPaletteChange={setColorPalette}
                    />
                  </Card>
                </div>
              </div>
            </div>
          </div>
        )}
      </Content>
    </Layout>
  );
}

export default HydroscopeFull;
