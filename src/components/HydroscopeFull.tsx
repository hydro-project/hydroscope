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

const { Content, Sider } = Layout;

export interface HydroscopeFullProps extends Omit<HydroscopeProps, 'eventHandlers' | 'onParsed'> {
  // Layout and styling
  showFileUpload?: boolean;        // Show file upload area (default: true)
  showSidebar?: boolean;          // Show control sidebar (default: true)
  defaultSiderWidth?: number;     // Default sidebar width (default: 320)
  
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
  defaultSiderWidth = 320,
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
  const [isLayoutRunning, setIsLayoutRunning] = useState(false);
  const [siderCollapsed, setSiderCollapsed] = useState(false);
  
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
    onParsed?.(parsedMetadata, visState);
  }, [onParsed]);

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
    // Data will be re-parsed automatically due to grouping prop change
  }, []);

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

        {/* Main Graph Area */}
        {data && (
          <div style={graphContainerStyle}>
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
          </div>
        )}
      </Content>

      {/* Control Sidebar */}
      {showSidebar && (
        <Sider
          width={defaultSiderWidth}
          collapsible
          collapsed={siderCollapsed}
          onCollapse={setSiderCollapsed}
          style={{
            background: '#fff',
            borderLeft: '1px solid #d9d9d9',
            height: '100vh',
            overflow: 'auto',
          }}
        >
          <div style={{ padding: '16px' }}>
            {/* Grouping Controls */}
    {metadata?.availableGroupings && (
              <Card size="small" style={{ marginBottom: '16px' }}>
                <GroupingControls
      hierarchyChoices={metadata.availableGroupings}
      currentGrouping={grouping}
      onGroupingChange={(g) => handleGroupingChange(g)}
                />
              </Card>
            )}

            {/* Layout Controls */}
            <Card size="small" style={{ marginBottom: '16px' }}>
              <LayoutControls
                visualizationState={visualizationState}
                currentLayout={layoutAlgorithm}
                onLayoutChange={handleLayoutChange}
                onCollapseAll={handlePackAll}
                onExpandAll={handleUnpackAll}
                autoFit={autoFit}
                onFitView={() => hydroscopeRef.current?.fitView?.()}
              />
            </Card>

            {/* Style Tuning Panel */}
            <Card size="small" style={{ marginBottom: '16px' }}>
              <StyleTunerPanel
                value={{}}
                onChange={() => {}}
                colorPalette={colorPalette}
                onPaletteChange={setColorPalette}
              />
            </Card>

            {/* Info Panel */}
            {visualizationState && (
              <Card size="small">
                <InfoPanel
                  visualizationState={visualizationState}
                  hierarchyChoices={metadata?.availableGroupings}
                  currentGrouping={grouping}
                />
              </Card>
            )}
          </div>
        </Sider>
      )}
    </Layout>
  );
}

export default HydroscopeFull;
