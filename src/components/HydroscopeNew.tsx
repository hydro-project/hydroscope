/**
 * Hydroscope - Full-featured wrapper component with enhanced UI features
 * 
 * This component wraps HydroscopeCore and adds all UI enhancements including:
 * - FileDropZone for file upload functionality
 * - InfoPanel for search and hierarchy controls
 * - StyleTuner for appearance customization
 * - CustomControls for graph manipulation
 * - Configuration management and persistence
 * 
 * The component maintains all existing styling, fonts, icons, and positioning
 * while providing seamless integration between core and enhanced features.
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
} from "react";
import {
  ReactFlowProvider,
  ControlButton,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { HydroscopeCore, type HydroscopeCoreProps, type HydroscopeCoreHandle } from "./HydroscopeCoreNew.js";
import { FileUpload } from "./FileUpload.js";
import { InfoPanel, type InfoPanelRef, type SearchMatch } from "./panels/InfoPanel.js";
import { StyleTuner, type StyleConfig as StyleTunerConfig } from "./panels/StyleTuner.js";
import { ErrorBoundary } from "./ErrorBoundary.js";

import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import type { HydroscopeData } from "../types/core.js";

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Render configuration interface for styling the visualization
 */
export interface RenderConfig {
  /** Edge rendering style - affects how connections are drawn */
  edgeStyle?: "bezier" | "straight" | "smoothstep";
  /** Width of edge lines in pixels */
  edgeWidth?: number;
  /** Whether edges should be drawn with dashed lines */
  edgeDashed?: boolean;
  /** Internal padding for node content in pixels */
  nodePadding?: number;
  /** Font size for node labels in pixels */
  nodeFontSize?: number;
  /** Border width for container elements in pixels */
  containerBorderWidth?: number;
  /** Color palette name for node and edge coloring */
  colorPalette?: string;
  /** Whether to automatically fit view after layout changes */
  fitView?: boolean;
  /** Scale factor for ReactFlow controls */
  reactFlowControlsScale?: number;
}

/**
 * Props interface for the Hydroscope component
 * 
 * Extends HydroscopeCoreProps with enhanced UI features
 */
export interface HydroscopeProps extends Omit<HydroscopeCoreProps, 'data'> {
  /** JSON data to visualize (optional - can be uploaded via FileDropZone) */
  data?: HydroscopeData;
  
  /** Show file upload interface when no data provided */
  showFileUpload?: boolean;
  
  /** Show InfoPanel with search and hierarchy controls */
  showInfoPanel?: boolean;
  
  /** Show StyleTuner panel for customization */
  showStylePanel?: boolean;
  
  /** Enable responsive height calculation */
  responsive?: boolean;
  
  /** Callback when file is uploaded */
  onFileUpload?: (data: HydroscopeData, filename?: string) => void;
  
  /** Callback when configuration changes */
  onConfigChange?: (config: RenderConfig) => void;
}

/**
 * Internal state interface for the Hydroscope component
 */
interface HydroscopeState {
  /** Current data being visualized */
  data: HydroscopeData | null;
  
  /** Panel visibility */
  infoPanelOpen: boolean;
  stylePanelOpen: boolean;
  
  /** Configuration with persistence */
  colorPalette: string;
  layoutAlgorithm: string;
  renderConfig: RenderConfig;
  autoFitEnabled: boolean;
  
  /** Search state */
  searchQuery: string;
  searchMatches: SearchMatch[];
  currentSearchMatch: SearchMatch | undefined;
  
  /** File upload state */
  uploadedData: HydroscopeData | null;
  uploadedFilename: string | null;
  
  /** Error and loading state */
  error: Error | null;
  isLoading: boolean;
}

/**
 * Settings interface for localStorage persistence
 */
interface HydroscopeSettings {
  infoPanelOpen: boolean;
  stylePanelOpen: boolean;
  autoFitEnabled: boolean;
  colorPalette: string;
  layoutAlgorithm: string;
  renderConfig: RenderConfig;
}

// ============================================================================
// Settings Persistence Utilities
// ============================================================================

const STORAGE_KEY = "hydroscope-settings-v2";
const SETTINGS_VERSION = 2;

const DEFAULT_RENDER_CONFIG: RenderConfig = {
  edgeStyle: "bezier",
  edgeWidth: 2,
  edgeDashed: false,
  nodePadding: 8,
  nodeFontSize: 12,
  containerBorderWidth: 2,
  colorPalette: "Set2",
  fitView: true,
  reactFlowControlsScale: 1.3,
};

const DEFAULT_SETTINGS: HydroscopeSettings = {
  infoPanelOpen: true,
  stylePanelOpen: false,
  autoFitEnabled: true,
  colorPalette: "Set2",
  layoutAlgorithm: "layered",
  renderConfig: DEFAULT_RENDER_CONFIG,
};

/**
 * Save settings to localStorage with error handling
 */
const saveSettings = (settings: HydroscopeSettings): void => {
  try {
    const settingsWithVersion = {
      ...settings,
      version: SETTINGS_VERSION,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsWithVersion));
  } catch (error) {
    console.error("Hydroscope: Failed to save settings:", error);
  }
};

/**
 * Load settings from localStorage with migration support
 */
const loadSettings = (): HydroscopeSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle missing properties
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        renderConfig: {
          ...DEFAULT_RENDER_CONFIG,
          ...parsed.renderConfig,
        },
      };
    }
  } catch (error) {
    console.error("Hydroscope: Failed to load settings:", error);
  }
  return DEFAULT_SETTINGS;
};

// ============================================================================
// SVG Icons for CustomControls
// ============================================================================

const PackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 512 512" fill="currentColor">
    <path d="M256 48C141.1 48 48 141.1 48 256s93.1 208 208 208 208-93.1 208-208S370.9 48 256 48zm90.5 230.5l-128 128C215.6 409.4 212.8 410 210 410s-5.6-.6-8.5-3.5c-5.9-5.9-5.9-15.4 0-21.4L329.4 256 201.5 127c-5.9-5.9-5.9-15.4 0-21.4s15.4-5.9 21.4 0l128 128c5.9 5.9 5.9 15.4 0 21.4z"/>
  </svg>
);

const UnpackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 512 512" fill="currentColor">
    <path d="M256 48C141.1 48 48 141.1 48 256s93.1 208 208 208 208-93.1 208-208S370.9 48 256 48zm90.5 230.5c-5.9 5.9-15.4 5.9-21.4 0L197.2 151.6c-5.9-5.9-5.9-15.4 0-21.4s15.4-5.9 21.4 0L346.5 258.1c5.9 5.9 5.9 15.4 0 21.4z"/>
  </svg>
);

const AutoFitIcon = () => (
  <svg width="16" height="16" viewBox="0 0 512 512" fill="currentColor">
    <path d="M200 200L56 56C42.7 42.7 21.3 42.7 8 56S-5.3 85.3 8 98.7l144 144c6.2 6.2 14.4 9.4 22.6 9.4s16.4-3.1 22.6-9.4c12.5-12.5 12.5-32.8 0-45.3zm312-144c-12.5-12.5-32.8-12.5-45.3 0L312 200c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l144-144c12.5-12.5 12.5-32.8 0-45.3zM200 312L56 456c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l144-144c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0zm312 144c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L312 256c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l144 144z"/>
  </svg>
);

const LoadFileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 512 512" fill="currentColor">
    <path d="M288 109.3V352c0 17.7-14.3 32-32 32s-32-14.3-32-32V109.3l-73.4 73.4c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l128-128c12.5-12.5 32.8-12.5 45.3 0l128 128c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L288 109.3zM64 352H192c0 35.3 28.7 64 64 64s64-28.7 64-64H448c35.3 0 64 28.7 64 64v32c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V416c0-35.3 28.7-64 64-64z"/>
  </svg>
);

// ============================================================================
// CustomControls Component
// ============================================================================

interface CustomControlsProps {
  visualizationState?: VisualizationState | null;
  asyncCoordinator?: AsyncCoordinator | null;
  onCollapseAll?: () => void;
  onExpandAll?: () => void;
  onAutoFitToggle?: () => void;
  onLoadFile?: () => void;
  showLoadFile?: boolean;
  reactFlowControlsScale?: number;
}

const CustomControls = memo<CustomControlsProps>(({
  visualizationState,
  onCollapseAll,
  onExpandAll,
  onAutoFitToggle,
  onLoadFile,
  showLoadFile = false,
  reactFlowControlsScale = 1.3,
}) => {
  const standardControlsRef = useRef<HTMLDivElement>(null);
  const [standardControlsHeight, setStandardControlsHeight] = useState(40);

  // Check if we have containers to show pack/unpack controls
  const hasContainers = useMemo(() => {
    if (!visualizationState) return false;
    return visualizationState.visibleContainers.length > 0;
  }, [visualizationState]);

  // Calculate if we have any custom controls to show
  const hasCustomControls = hasContainers || onAutoFitToggle || showLoadFile;

  // Dynamically measure the standard controls height
  useEffect(() => {
    const measureControls = () => {
      if (standardControlsRef.current) {
        const rect = standardControlsRef.current.getBoundingClientRect();
        const height = rect.height || 40;
        setStandardControlsHeight(height);
      }
    };

    if (hasCustomControls) {
      measureControls();
      // Re-measure after a short delay to account for dynamic content
      const timer = setTimeout(measureControls, 100);
      return () => clearTimeout(timer);
    }
  }, [hasCustomControls, reactFlowControlsScale]);

  if (!hasCustomControls) {
    return null;
  }

  return (
    <>
      {/* Custom Controls - positioned dynamically above standard controls */}
      <div
        style={{
          position: "absolute",
          bottom: `${standardControlsHeight + 10}px`,
          left: "10px",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          transform: `scale(${reactFlowControlsScale})`,
          transformOrigin: "bottom left",
        }}
      >
        {hasContainers && (
          <>
            <ControlButton
              onClick={onCollapseAll}
              title="Collapse All Containers"
              style={{
                backgroundColor: "white",
                border: "1px solid #ccc",
                borderRadius: "4px",
                padding: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: "500",
                color: "#333",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <PackIcon />
            </ControlButton>
            <ControlButton
              onClick={onExpandAll}
              title="Expand All Containers"
              style={{
                backgroundColor: "white",
                border: "1px solid #ccc",
                borderRadius: "4px",
                padding: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: "500",
                color: "#333",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <UnpackIcon />
            </ControlButton>
          </>
        )}
        {onAutoFitToggle && (
          <ControlButton
            onClick={onAutoFitToggle}
            title="Toggle Auto-Fit"
            style={{
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              fontWeight: "500",
              color: "#333",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            <AutoFitIcon />
          </ControlButton>
        )}
        {showLoadFile && onLoadFile && (
          <ControlButton
            onClick={onLoadFile}
            title="Load File"
            style={{
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              fontWeight: "500",
              color: "#333",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            <LoadFileIcon />
          </ControlButton>
        )}
      </div>

      {/* Hidden div to measure standard controls height */}
      <div
        ref={standardControlsRef}
        style={{
          position: "absolute",
          bottom: "10px",
          left: "10px",
          visibility: "hidden",
          pointerEvents: "none",
          transform: `scale(${reactFlowControlsScale})`,
          transformOrigin: "bottom left",
        }}
      >
        {/* Simulate standard controls structure for measurement */}
        <div style={{ height: "40px", width: "40px" }} />
      </div>
    </>
  );
});

CustomControls.displayName = "CustomControls";

// ============================================================================
// Main Hydroscope Component
// ============================================================================

/**
 * Hydroscope - Full-featured wrapper component with enhanced UI features
 * 
 * Wraps HydroscopeCore and adds FileDropZone, InfoPanel, StyleTuner, and CustomControls
 * while maintaining all existing styling and functionality.
 */
export const Hydroscope = memo<HydroscopeProps>(({
  data,
  height = "100%",
  width = "100%",
  showControls = true,
  showMiniMap = true,
  showBackground = true,
  showFileUpload = true,
  showInfoPanel = true,
  showStylePanel = true,
  enableCollapse = true,
  initialLayoutAlgorithm = "layered",
  initialColorPalette = "Set2",
  responsive: _responsive = false,
  onFileUpload,
  onNodeClick,
  onContainerCollapse,
  onContainerExpand,
  onConfigChange,
  onError,
  className,
  style,
}) => {
  // Load initial settings
  const [settings, setSettings] = useState<HydroscopeSettings>(() => loadSettings());
  
  // Component state
  const [state, setState] = useState<HydroscopeState>({
    data: data || null,
    infoPanelOpen: settings.infoPanelOpen,
    stylePanelOpen: settings.stylePanelOpen,
    colorPalette: initialColorPalette || settings.colorPalette,
    layoutAlgorithm: initialLayoutAlgorithm || settings.layoutAlgorithm,
    renderConfig: settings.renderConfig,
    autoFitEnabled: settings.autoFitEnabled,
    searchQuery: "",
    searchMatches: [],
    currentSearchMatch: undefined,
    uploadedData: null,
    uploadedFilename: null,
    error: null,
    isLoading: false,
  });

  // Refs for component instances
  const hydroscopeCoreRef = useRef<HydroscopeCoreHandle>(null);
  const infoPanelRef = useRef<InfoPanelRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update data when prop changes
  useEffect(() => {
    if (data !== state.data) {
      setState(prev => ({ ...prev, data: data || null }));
    }
  }, [data, state.data]);

  // Save settings when they change
  useEffect(() => {
    const newSettings: HydroscopeSettings = {
      infoPanelOpen: state.infoPanelOpen,
      stylePanelOpen: state.stylePanelOpen,
      autoFitEnabled: state.autoFitEnabled,
      colorPalette: state.colorPalette,
      layoutAlgorithm: state.layoutAlgorithm,
      renderConfig: state.renderConfig,
    };
    
    setSettings(newSettings);
    saveSettings(newSettings);
  }, [
    state.infoPanelOpen,
    state.stylePanelOpen,
    state.autoFitEnabled,
    state.colorPalette,
    state.layoutAlgorithm,
    state.renderConfig,
  ]);

  // Handle file upload
  const handleFileUpload = useCallback((uploadedData: HydroscopeData, filename?: string) => {
    setState(prev => ({
      ...prev,
      data: uploadedData,
      uploadedData,
      uploadedFilename: filename || null,
      error: null,
    }));
    
    onFileUpload?.(uploadedData, filename);
  }, [onFileUpload]);

  // Handle configuration changes
  const handleConfigChange = useCallback((config: RenderConfig) => {
    setState(prev => ({
      ...prev,
      renderConfig: { ...prev.renderConfig, ...config },
    }));
    
    onConfigChange?.(config);
  }, [onConfigChange]);

  // Handle style tuner changes
  const handleStyleChange = useCallback((styleConfig: StyleTunerConfig) => {
    const renderConfig: RenderConfig = {
      edgeStyle: styleConfig.edgeStyle,
      edgeWidth: styleConfig.edgeWidth,
      edgeDashed: styleConfig.edgeDashed,
      nodePadding: styleConfig.nodePadding,
      nodeFontSize: styleConfig.nodeFontSize,
      containerBorderWidth: styleConfig.containerBorderWidth,
      reactFlowControlsScale: styleConfig.reactFlowControlsScale,
      colorPalette: state.colorPalette,
      fitView: state.autoFitEnabled,
    };
    
    handleConfigChange(renderConfig);
  }, [state.colorPalette, state.autoFitEnabled, handleConfigChange]);

  // Handle palette changes
  const handlePaletteChange = useCallback((palette: string) => {
    setState(prev => ({ ...prev, colorPalette: palette }));
    
    const renderConfig: RenderConfig = {
      ...state.renderConfig,
      colorPalette: palette,
    };
    
    handleConfigChange(renderConfig);
  }, [state.renderConfig, handleConfigChange]);

  // Handle layout changes
  const handleLayoutChange = useCallback((layout: string) => {
    setState(prev => ({ ...prev, layoutAlgorithm: layout }));
  }, []);

  // Handle bulk operations
  const handleCollapseAll = useCallback(async () => {
    try {
      await hydroscopeCoreRef.current?.collapseAll();
    } catch (error) {
      console.error("Failed to collapse all containers:", error);
      onError?.(error as Error);
    }
  }, [onError]);

  const handleExpandAll = useCallback(async () => {
    try {
      await hydroscopeCoreRef.current?.expandAll();
    } catch (error) {
      console.error("Failed to expand all containers:", error);
      onError?.(error as Error);
    }
  }, [onError]);

  // Handle auto-fit toggle
  const handleAutoFitToggle = useCallback(() => {
    setState(prev => ({ ...prev, autoFitEnabled: !prev.autoFitEnabled }));
  }, []);

  // Handle load file button
  const handleLoadFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle search updates from InfoPanel
  const handleSearchUpdate = useCallback((
    query: string,
    matches: SearchMatch[],
    current?: SearchMatch,
  ) => {
    setState(prev => ({
      ...prev,
      searchQuery: query,
      searchMatches: matches,
      currentSearchMatch: current,
    }));
  }, []);

  // Container dimensions
  const containerStyle = useMemo(() => ({
    height: typeof height === 'number' ? `${height}px` : height,
    width: typeof width === 'number' ? `${width}px` : width,
    position: 'relative' as const,
    display: 'flex' as const,
    ...style,
  }), [height, width, style]);

  // Show file upload if no data and file upload is enabled
  const shouldShowFileUpload = showFileUpload && !state.data;

  return (
    <ErrorBoundary
      fallback={(_error, _errorInfo, retry) => (
        <div style={containerStyle} className={className}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
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
                An unexpected error occurred in the Hydroscope component.
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
        </div>
      )}
    >
      <div style={containerStyle} className={className}>
        {shouldShowFileUpload ? (
          // File upload interface
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%',
          }}>
            <FileUpload
              onFileLoaded={handleFileUpload}
              onParseError={(error, filename) => {
                console.error(`Failed to parse ${filename}:`, error);
                setState(prev => ({ ...prev, error: new Error(`Failed to parse ${filename}: ${error.message}`) }));
              }}
              onValidationError={(errors, filename) => {
                console.error(`Validation errors in ${filename}:`, errors);
                setState(prev => ({ ...prev, error: new Error(`Validation errors in ${filename}`) }));
              }}
            />
          </div>
        ) : (
          // Main visualization interface
          <ReactFlowProvider>
            <div style={{ position: 'relative', height: '100%', width: '100%' }}>
              {/* Core visualization */}
              <HydroscopeCore
                ref={hydroscopeCoreRef}
                data={state.data!}
                height="100%"
                width="100%"
                showControls={showControls}
                showMiniMap={showMiniMap}
                showBackground={showBackground}
                enableCollapse={enableCollapse}
                initialLayoutAlgorithm={state.layoutAlgorithm}
                initialColorPalette={state.colorPalette}
                onNodeClick={onNodeClick}
                onContainerCollapse={onContainerCollapse}
                onContainerExpand={onContainerExpand}
                onError={onError}
              />

              {/* Custom Controls */}
              <CustomControls
                visualizationState={null} // Will be updated when we get access to it from HydroscopeCore
                onCollapseAll={handleCollapseAll}
                onExpandAll={handleExpandAll}
                onAutoFitToggle={handleAutoFitToggle}
                onLoadFile={handleLoadFile}
                showLoadFile={showFileUpload}
                reactFlowControlsScale={state.renderConfig.reactFlowControlsScale}
              />

              {/* InfoPanel */}
              {showInfoPanel && (
                <InfoPanel
                  ref={infoPanelRef}
                  open={state.infoPanelOpen}
                  onOpenChange={(open) => setState(prev => ({ ...prev, infoPanelOpen: open }))}
                  onSearchUpdate={handleSearchUpdate}
                  visualizationState={null} // Will be passed from HydroscopeCore via callback
                  hierarchyChoices={state.data?.hierarchyChoices || []}
                  currentGrouping={state.data?.nodeAssignments ? Object.keys(state.data.nodeAssignments)[0] : undefined}
                  onGroupingChange={(groupingId) => {
                    console.log('Grouping changed to:', groupingId);
                    // Handle grouping change if needed
                  }}
                  collapsedContainers={new Set()}
                  onToggleContainer={(containerId) => {
                    console.log('Toggle container:', containerId);
                    // This will be handled by HydroscopeCore
                  }}
                  colorPalette={state.colorPalette}
                  legendData={state.data?.legend ? {
                    title: state.data.legend.title || "Legend",
                    items: state.data.legend.items
                  } : undefined}
                  edgeStyleConfig={state.data?.edgeStyleConfig}
                  nodeTypeConfig={state.data?.nodeTypeConfig}
                />
              )}

              {/* StyleTuner */}
              {showStylePanel && (
                <StyleTuner
                  value={state.renderConfig}
                  onChange={handleStyleChange}
                  colorPalette={state.colorPalette}
                  onPaletteChange={handlePaletteChange}
                  currentLayout={state.layoutAlgorithm}
                  onLayoutChange={handleLayoutChange}
                  onControlsScaleChange={(scale) => {
                    const renderConfig: RenderConfig = {
                      ...state.renderConfig,
                      reactFlowControlsScale: scale,
                    };
                    handleConfigChange(renderConfig);
                  }}
                  onResetToDefaults={() => {
                    setState(prev => ({
                      ...prev,
                      renderConfig: DEFAULT_RENDER_CONFIG,
                      colorPalette: DEFAULT_SETTINGS.colorPalette,
                      layoutAlgorithm: DEFAULT_SETTINGS.layoutAlgorithm,
                    }));
                  }}
                  open={state.stylePanelOpen}
                  onOpenChange={(open) => setState(prev => ({ ...prev, stylePanelOpen: open }))}
                />
              )}

              {/* Hidden file input for load file button */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const data = JSON.parse(event.target?.result as string);
                        handleFileUpload(data, file.name);
                      } catch (error) {
                        console.error("Failed to parse file:", error);
                        setState(prev => ({ ...prev, error: new Error(`Failed to parse file: ${(error as Error).message}`) }));
                      }
                    };
                    reader.readAsText(file);
                  }
                }}
              />
            </div>
          </ReactFlowProvider>
        )}
      </div>
    </ErrorBoundary>
  );
});

Hydroscope.displayName = 'Hydroscope';