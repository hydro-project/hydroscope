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
import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "../styles/dark-mode.css";
import {
  HydroscopeCore,
  type HydroscopeCoreProps,
  type HydroscopeCoreHandle,
} from "./HydroscopeCore.js";
import { FileUpload } from "./FileUpload.js";
import {
  InfoPanel,
  type InfoPanelRef,
  type SearchMatch,
} from "./panels/InfoPanel.js";
import {
  StyleTuner,
  type StyleConfig as StyleTunerConfig,
} from "./panels/StyleTuner.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { hscopeLogger } from "../utils/logger.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import type { HydroscopeData } from "../types/core.js";
import { DEFAULT_COLOR_PALETTE } from "../shared/config/styling.js";
import { DEFAULT_ELK_ALGORITHM } from "../shared/config/layout.js";
import {
  enableResizeObserverErrorSuppression,
  disableResizeObserverErrorSuppression,
  DebouncedOperationManager,
  withAsyncResizeObserverErrorSuppression,
} from "../utils/ResizeObserverErrorSuppression.js";
import { parseDataFromUrl } from "../utils/urlParser.js";
import { assertCollapsedSetConsistent } from "../core/invariantChecks.js";
import { resetAllBridges } from "../utils/bridgeResetUtils.js";

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
  /** Whether to show full node labels for all nodes */
  showFullNodeLabels?: boolean;
}
/**
 * Props interface for the Hydroscope component
 *
 * Extends HydroscopeCoreProps with enhanced UI features
 */
export interface HydroscopeProps extends Omit<HydroscopeCoreProps, "data"> {
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
  /** Generated file path to display for copying */
  generatedFilePath?: string;
  /** Enable URL parameter parsing (default: true in production, false in tests) */
  enableUrlParsing?: boolean;
  /** Scale factor for UI panels (default: 1.0, use 0.85 for IDE) */
  uiScale?: number;
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
  /** Sync tree and graph state */
  syncTreeAndGraph: boolean;
  /** Search state */
  searchQuery: string;
  searchMatches: SearchMatch[];
  currentSearchMatch: SearchMatch | undefined;
  /** Current visualization state from HydroscopeCore */
  currentVisualizationState: VisualizationState | null;
  /** File upload state */
  uploadedData: HydroscopeData | null;
  uploadedFilename: string | null;
  /** Error and loading state */
  error: Error | null;
  isLoading: boolean;
  /** Status message for e2e testing */
  statusMessage: string;
}
/**
 * Settings interface for localStorage persistence
 */
interface HydroscopeSettings {
  infoPanelOpen: boolean;
  stylePanelOpen: boolean;
  autoFitEnabled: boolean;
  syncTreeAndGraph: boolean;
  colorPalette: string;
  layoutAlgorithm: string;
  renderConfig: RenderConfig;
}
// ============================================================================
// Settings Persistence Utilities
// ============================================================================
const STORAGE_KEY = "hydroscope-settings";
const SETTINGS_VERSION = 2; // Incremented to trigger migration to mrtree default
const DEFAULT_RENDER_CONFIG: Required<RenderConfig> = {
  edgeStyle: "bezier",
  edgeWidth: 2,
  edgeDashed: false,
  nodePadding: 8,
  nodeFontSize: 12,
  containerBorderWidth: 2,
  colorPalette: DEFAULT_COLOR_PALETTE,
  fitView: true,
  showFullNodeLabels: false,
};
const DEFAULT_SETTINGS: HydroscopeSettings = {
  infoPanelOpen: true,
  stylePanelOpen: false,
  autoFitEnabled: true,
  syncTreeAndGraph: true,
  colorPalette: DEFAULT_COLOR_PALETTE,
  layoutAlgorithm: DEFAULT_ELK_ALGORITHM,
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
      // Merge with defaults to handle missing properties first
      const result = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        renderConfig: {
          ...DEFAULT_RENDER_CONFIG,
          ...parsed.renderConfig,
        },
      };
      // Migration: If no version or old version, update layoutAlgorithm default and save merged settings
      if (!parsed.version || parsed.version < SETTINGS_VERSION) {
        result.layoutAlgorithm = DEFAULT_ELK_ALGORITHM; // Update to new default
        result.version = SETTINGS_VERSION;
        // Save the complete migrated settings back to localStorage
        try {
          const settingsWithVersion = {
            ...result,
            version: SETTINGS_VERSION,
          };
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(settingsWithVersion),
          );
        } catch (saveError) {
          console.error(
            "Hydroscope: Failed to save migrated settings:",
            saveError,
          );
        }
      }
      return result;
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
  <svg
    id="Layer_1"
    xmlns="http://www.w3.org/2000/svg"
    version="1.1"
    viewBox="0 0 512 512"
  >
    <path
      fill="currentColor"
      d="M48.68,170.67c30.01-3,69.24,1.26,99.98,1.2l-.47,44.47c-31.79-.64-85.93-5.15-91.45,31.65-8.5,56.73,5.61,129.95.95,188.29,4.46,11.9,12.64,21.32,26.06,26.84,108.97,7.41,220.75,1.13,330.73,3.21,20.07-2.42,37.72-16.78,40.27-34.05,8.32-56.31-6.25-127.27,0-185.09-11.77-36.93-54.69-30.94-90.5-30.85l-.47-45.27c31.13,1.64,69.66-3.56,99.98-.4,23.16,2.42,42.04,19.44,45.01,38.86-7.67,83.32,10.23,180.25,0,262.01-2.57,20.51-19.89,36.92-44.07,40.46H46.78c-26.2-4.46-41.74-21.6-44.07-43.67-8.55-81.04,6.41-172.67,0-254.8,1.08-21.27,20.53-40.32,45.96-42.87h.01Z"
    />
    <path
      fill="currentColor"
      d="M258.31,429.8c-.72.25-4.19.29-4.81,0-5.19-2.36-56.57-122.05-66.1-135.93-3.69-24.83,25.3-7.28,33.65-15.32V11.79c1.18-4.89,3.41-9.69,6.81-10.85,3.66-1.26,53.37-1.27,56.89,0,.82.3,4.76,4.33,5.21,5.75l.8,271.87c9.31,8.06,42.87-10.94,32.05,20.42-5.44,15.77-52.12,113.24-60.09,125.08-1.07,1.58-3.09,5.29-4.41,5.75v-.02Z"
    />
  </svg>
);
const UnpackIcon = () => (
  <svg
    id="Layer_1"
    xmlns="http://www.w3.org/2000/svg"
    version="1.1"
    viewBox="0 0 512 512"
  >
    <path
      fill="currentColor"
      d="M48.68,170.67c30.01-3,69.24,1.26,99.98,1.2l-.47,44.47c-31.79-.64-85.93-5.15-91.45,31.65-8.5,56.73,5.61,129.95.95,188.29,4.46,11.9,12.64,21.32,26.06,26.84,108.97,7.41,220.75,1.13,330.73,3.21,20.07-2.42,37.72-16.78,40.27-34.05,8.32-56.31-6.25-127.27,0-185.09-11.77-36.93-54.69-30.94-90.5-30.85l-.47-45.27c31.13,1.64,69.66-3.56,99.98-.4,23.16,2.42,42.04,19.44,45.01,38.86-7.67,83.32,10.23,180.25,0,262.01-2.57,20.51-19.89,36.92-44.07,40.46H46.78c-26.2-4.46-41.74-21.6-44.07-43.67-8.55-81.04,6.41-172.67,0-254.8,1.08-21.27,20.53-40.32,45.96-42.87h.01Z"
    />
    <path
      fill="currentColor"
      d="M253.7.2c.72-.25,4.19-.29,4.81,0,5.19,2.36,56.57,122.05,66.1,135.93,3.69,24.83-25.3,7.28-33.65,15.32v266.76c-1.18,4.89-3.41,9.69-6.81,10.85-3.66,1.26-53.37,1.27-56.89,0-.82-.3-4.76-4.33-5.21-5.75l-.8-271.87c-9.31-8.06-42.87,10.94-32.05-20.42,5.44-15.77,52.12-113.24,60.09-125.08,1.07-1.58,3.09-5.29,4.41-5.75v.02Z"
    />
  </svg>
);
const AutoFitIcon = ({ enabled }: { enabled?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    {/* Outer frame */}
    <rect
      x="1"
      y="1"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      rx="2"
    />
    {/* Inner content - changes based on enabled state */}
    {enabled ? (
      // Enabled: filled center with arrows pointing outward
      <>
        <rect x="4" y="4" width="8" height="8" fill="currentColor" rx="1" />
        <path
          d="M2 2l2 2M14 2l-2 2M2 14l2-2M14 14l-2-2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </>
    ) : (
      // Disabled: just the arrows pointing inward
      <path
        d="M4 4l2 2M12 4l-2 2M4 12l2-2M12 12l-2-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    )}
  </svg>
);
const SaveIcon = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3.5 3.5a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L7.5 9.293V2a2 2 0 0 1 2-2H14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h2.5a.5.5 0 0 1 0 1H2z" />
  </svg>
);
const LoadFileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
    <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9zM2.5 3a.5.5 0 0 0-.5.5v1.0.0h12v-.5a.5.5 0 0 0-.5-.5H9c-.964 0-1.71-.629-2.174-1.154C6.374 3.334 5.82 3 5.264 3H2.5zM14 7H2v5.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V7z" />
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
  onSave?: () => void;
  showLoadFile?: boolean;
  showSaveFile?: boolean;
  autoFitEnabled?: boolean;
  currentData?: HydroscopeData | null;
}
const CustomControls = memo(
  ({
    visualizationState,
    onCollapseAll,
    onExpandAll,
    onAutoFitToggle,
    onLoadFile,
    onSave,
    showLoadFile = false,
    showSaveFile = false,
    autoFitEnabled = true, // Default to true to match the component's default behavior
    currentData,
  }: CustomControlsProps) => {
    // Check if there are any containers that can be collapsed/expanded
    const hasContainers =
      (visualizationState?.visibleContainers?.length ?? 0) > 0;
    // Calculate if we have any custom controls to show
    const hasCustomControls =
      hasContainers || onAutoFitToggle || showLoadFile || showSaveFile;
    return (
      <>
        {/* Custom Controls - positioned dynamically above standard controls */}
        {hasCustomControls && (
          <div
            style={{
              position: "absolute",
              bottom: "125px", // ReactFlow controls height (104px) + ReactFlow bottom (10px) + gap (10px)
              left: "15px", // Exact same as ReactFlow controls
              zIndex: 5, // Just above ReactFlow's z-index: 4
              display: "flex",
              flexDirection: "column",
              boxShadow: "rgba(0, 0, 0, 0.1) 0px 2px 4px", // Exact same as ReactFlow
              borderRadius: "2px", // Exact same as ReactFlow
              backgroundColor: "white",
              width: "26px", // Exact same width as ReactFlow controls
            }}
          >
            {/* Auto Fit Toggle Button - always show when callback provided */}
            {onAutoFitToggle && (
              <button
                onClick={() => {
                  onAutoFitToggle();
                }}
                title={`Toggle Auto-Fit (currently ${autoFitEnabled ? "ON" : "OFF"})`}
                className="react-flow__controls-button"
                style={{
                  alignItems: "center",
                  background: autoFitEnabled
                    ? "rgba(59, 130, 246, 0.2)"
                    : "#fefefe",
                  border: "none",
                  borderBottom: "1px solid #b1b1b7",
                  color: "#555",
                  cursor: "pointer",
                  display: "flex",
                  height: "26px",
                  justifyContent: "center",
                  padding: "4px",
                  userSelect: "none",
                  width: "26px",
                  fontSize: "12px",
                  margin: "0",
                  borderRadius: "0",
                }}
              >
                <AutoFitIcon enabled={autoFitEnabled} />
              </button>
            )}

            {/* Save File Button - at the top when enabled */}
            {showSaveFile && onSave && currentData && (
              <button
                onClick={onSave}
                title="Save visualization"
                className="react-flow__controls-button"
                style={{
                  alignItems: "center",
                  background: "#fefefe",
                  border: "none",
                  borderBottom: "1px solid #b1b1b7",
                  color: "#555",
                  cursor: "pointer",
                  display: "flex",
                  height: "26px",
                  justifyContent: "center",
                  padding: "4px",
                  userSelect: "none",
                  width: "26px",
                  fontSize: "12px",
                  margin: "0",
                  borderRadius: "0",
                }}
              >
                <SaveIcon />
              </button>
            )}

            {/* Load File Button - below save when enabled */}
            {showLoadFile && onLoadFile && (
              <button
                onClick={onLoadFile}
                title="Load another file"
                className="react-flow__controls-button"
                style={{
                  alignItems: "center",
                  background: "#fefefe",
                  border: "none",
                  borderBottom: "1px solid #b1b1b7",
                  color: "#555",
                  cursor: "pointer",
                  display: "flex",
                  height: "26px",
                  justifyContent: "center",
                  padding: "4px",
                  userSelect: "none",
                  width: "26px",
                  fontSize: "12px",
                  margin: "0",
                  borderRadius: "0",
                }}
              >
                <LoadFileIcon />
              </button>
            )}
            {/* Pack/Unpack buttons - always show */}
            <>
              {/* Pack All (Collapse All) Button */}
              <button
                onClick={onCollapseAll}
                data-testid="collapse-all-button"
                title="Collapse All Containers"
                className="react-flow__controls-button"
                style={{
                  alignItems: "center",
                  background: "#fefefe",
                  border: "none",
                  borderBottom: "1px solid #b1b1b7",
                  color: "#555",
                  cursor: "pointer",
                  display: "flex",
                  height: "26px",
                  justifyContent: "center",
                  padding: "4px",
                  userSelect: "none",
                  width: "26px",
                  fontSize: "12px",
                  margin: "0",
                  borderRadius: "0",
                  opacity: 1,
                }}
              >
                <PackIcon />
              </button>
              {/* Unpack All (Expand All) Button */}
              <button
                onClick={onExpandAll}
                data-testid="expand-all-button"
                title="Expand All Containers"
                className="react-flow__controls-button"
                style={{
                  alignItems: "center",
                  background: "#fefefe",
                  border: "none",
                  borderBottom: "none", // Last button has no bottom border
                  color: "#555",
                  cursor: "pointer",
                  display: "flex",
                  height: "26px",
                  justifyContent: "center",
                  padding: "4px",
                  userSelect: "none",
                  width: "26px",
                  fontSize: "12px",
                  margin: "0",
                  borderRadius: "0",
                  opacity: 1,
                }}
              >
                <UnpackIcon />
              </button>
            </>
          </div>
        )}
      </>
    );
  },
);
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
export const Hydroscope = memo<HydroscopeProps>(
  ({
    data,
    height = "100%",
    width = "100%",
    showControls: _showControls = true,
    showMiniMap = true,
    showBackground = true,
    showFileUpload = true,
    showInfoPanel = true,
    showStylePanel = true,
    enableCollapse = true,
    initialLayoutAlgorithm = DEFAULT_ELK_ALGORITHM,
    initialColorPalette = DEFAULT_COLOR_PALETTE,
    responsive: _responsive = false,
    onFileUpload,
    onNodeClick,
    onContainerCollapse,
    onContainerExpand,
    onConfigChange,
    onError,
    className,
    style,
    generatedFilePath,
    enableUrlParsing = typeof process !== "undefined" &&
    process.env.NODE_ENV === "test"
      ? false
      : true,
    uiScale = 1.0,
  }) => {
    // Load initial settings
    const [settings, setSettings] = useState<HydroscopeSettings>(() =>
      loadSettings(),
    );

    // URL parameter handling
    const [urlData, setUrlData] = useState<HydroscopeData | null>(null);
    const [urlFilePath, setUrlFilePath] = useState<string | null>(null);
    const [urlError, setUrlError] = useState<string | null>(null);

    // Parse URL parameters on mount (only if enabled and URL parameters exist)
    useEffect(() => {
      const parseUrlParams = async () => {
        try {
          // Skip URL parsing if disabled or in unsuitable environment
          if (
            !enableUrlParsing ||
            typeof window === "undefined" ||
            typeof window.location === "undefined"
          ) {
            return;
          }

          const urlParams = new URLSearchParams(window.location.search);
          const hashParams = new URLSearchParams(window.location.hash.slice(1));

          // Check for data parameters (both in search and hash)
          const dataParam = urlParams.get("data") || hashParams.get("data");
          const compressedParam =
            urlParams.get("compressed") || hashParams.get("compressed");
          const fileParam = urlParams.get("file") || hashParams.get("file");

          // Only proceed if we actually have URL parameters to parse
          if (!dataParam && !compressedParam && !fileParam) {
            return;
          }

          if (dataParam || compressedParam) {
            hscopeLogger.log(
              "orchestrator",
              "🔄 Parsing data from URL parameters...",
            );
            const parsedData = await parseDataFromUrl(
              dataParam,
              compressedParam,
            );
            if (parsedData) {
              hscopeLogger.log(
                "orchestrator",
                "✅ Successfully parsed data from URL",
              );
              setUrlData(parsedData);
              setUrlError(null);
            }
          } else if (fileParam) {
            // Handle file path parameter
            hscopeLogger.log(
              "orchestrator",
              "📄 File path detected in URL:",
              fileParam,
            );
            setUrlFilePath(decodeURIComponent(fileParam));
            setUrlError(null);
          }
        } catch (error) {
          console.error("❌ Error parsing URL parameters:", error);
          setUrlError(
            error instanceof Error
              ? error.message
              : "Unknown error parsing URL",
          );
        }
      };

      parseUrlParams();
    }, [enableUrlParsing]);
    // Component state
    const [state, setState] = useState<HydroscopeState>({
      data: data || null,
      infoPanelOpen: settings.infoPanelOpen,
      stylePanelOpen: settings.stylePanelOpen,
      colorPalette: settings.colorPalette || initialColorPalette,
      layoutAlgorithm: settings.layoutAlgorithm || initialLayoutAlgorithm,
      renderConfig: settings.renderConfig,
      autoFitEnabled: true, // Always start with autoFit enabled, regardless of saved settings
      syncTreeAndGraph: settings.syncTreeAndGraph ?? true, // Default to true (linked)
      searchQuery: "",
      searchMatches: [],
      currentSearchMatch: undefined,
      currentVisualizationState: null,
      uploadedData: null,
      uploadedFilename: null,
      error: null,
      isLoading: false,
      statusMessage: "",
    });

    // Store AsyncCoordinator in state for stable reference to child components
    const [asyncCoordinator, setAsyncCoordinator] =
      useState<AsyncCoordinator | null>(null);

    // Track current grouping (can be changed by user)
    const [selectedGrouping, setSelectedGrouping] = useState<string | null>(
      null,
    );
    const currentGrouping = useMemo(() => {
      // Use selected grouping if available, otherwise default to first hierarchy choice
      return selectedGrouping || data?.hierarchyChoices?.[0]?.id;
    }, [selectedGrouping, data]);
    // Refs for component instances
    const hydroscopeCoreRef = useRef<HydroscopeCoreHandle>(null);
    const infoPanelRef = useRef<InfoPanelRef>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const elkBridgeRef = useRef<ELKBridge | null>(null);

    // Capture AsyncCoordinator when HydroscopeCore mounts
    useEffect(() => {
      if (hydroscopeCoreRef.current) {
        const coordinator = hydroscopeCoreRef.current.getAsyncCoordinator();
        if (coordinator && coordinator !== asyncCoordinator) {
          setAsyncCoordinator(coordinator);
        }
      }
      // Note: It's normal for hydroscopeCoreRef.current to be null during initial render
      // The ref will be set after HydroscopeCore mounts, and this effect will run again
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.data, state.currentVisualizationState]); // Re-check when data or visualizationState changes
    // Refs for cleanup
    const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef(true);
    // ResizeObserver error suppression
    const debouncedOperationManagerRef =
      useRef<DebouncedOperationManager | null>(null);
    // Initialize ResizeObserver error suppression and debounced operation manager
    useEffect(() => {
      // Enable ResizeObserver error suppression
      enableResizeObserverErrorSuppression();

      // Create debounced operation manager
      debouncedOperationManagerRef.current = new DebouncedOperationManager(150);

      // Initialize ELK bridge
      elkBridgeRef.current = new ELKBridge({
        algorithm: state.layoutAlgorithm,
      });

      // Create complete settings from current state to ensure all properties are included
      const completeSettings: HydroscopeSettings = {
        infoPanelOpen: state.infoPanelOpen,
        stylePanelOpen: state.stylePanelOpen,
        autoFitEnabled: state.autoFitEnabled,
        syncTreeAndGraph: state.syncTreeAndGraph,
        colorPalette: state.colorPalette,
        layoutAlgorithm: state.layoutAlgorithm,
        renderConfig: state.renderConfig,
      };
      saveSettings(completeSettings);
    }, [
      state.infoPanelOpen,
      state.stylePanelOpen,
      state.autoFitEnabled,
      state.syncTreeAndGraph,
      state.colorPalette,
      state.layoutAlgorithm,
      state.renderConfig,
    ]);
    // Listen for info button clicks
    useEffect(() => {
      const handleShowPopup = (e: Event) => {
        const customEvent = e as CustomEvent<{ nodeId: string }>;
        const nodeId = customEvent.detail.nodeId;
        hscopeLogger.log(
          "orchestrator",
          `ℹ️ [Hydroscope] Received showPopup event for node ${nodeId}`,
        );
        if (hydroscopeCoreRef.current?.showNodePopup) {
          hydroscopeCoreRef.current.showNodePopup(nodeId);
        }
      };

      window.addEventListener("hydroscope:showPopup", handleShowPopup);
      return () => {
        window.removeEventListener("hydroscope:showPopup", handleShowPopup);
      };
    }, []);

    // Cleanup timeouts and error suppression on unmount
    useEffect(() => {
      return () => {
        isMountedRef.current = false;
        if (statusTimeoutRef.current) {
          clearTimeout(statusTimeoutRef.current);
        }
        // Cleanup debounced operations
        if (debouncedOperationManagerRef.current) {
          debouncedOperationManagerRef.current.destroy();
          debouncedOperationManagerRef.current = null;
        }
        // Disable ResizeObserver error suppression
        disableResizeObserverErrorSuppression();
      };
    }, []);
    // Update data when prop changes
    // Removed: This useEffect was causing double parsing during hierarchy changes
    // by reverting state.data back to the original prop after AsyncCoordinator updates it
    // Save settings when they change
    useEffect(() => {
      const newSettings: HydroscopeSettings = {
        infoPanelOpen: state.infoPanelOpen,
        stylePanelOpen: state.stylePanelOpen,
        autoFitEnabled: state.autoFitEnabled,
        syncTreeAndGraph: state.syncTreeAndGraph,
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
      state.syncTreeAndGraph,
      state.colorPalette,
      state.layoutAlgorithm,
      state.renderConfig,
    ]);

    // Update state when URL data is loaded (only if we have URL data and no existing data)
    useEffect(() => {
      if (urlData && !data) {
        setState((prev) => ({
          ...prev,
          data: urlData,
          uploadedData: urlData,
          uploadedFilename: "URL Data",
          error: null,
        }));
      }
    }, [urlData, data]);

    // Handle URL errors (only if we don't have existing data)
    useEffect(() => {
      if (urlError && !data) {
        setState((prev) => ({
          ...prev,
          error: new Error(`URL parsing error: ${urlError}`),
        }));
      }
    }, [urlError, data]);
    // Handle file upload
    const handleFileUpload = useCallback(
      (uploadedData: HydroscopeData, filename?: string) => {
        setState((prev) => ({
          ...prev,
          data: uploadedData,
          uploadedData,
          uploadedFilename: filename || null,
          error: null,
        }));
        // Reset grouping selection to default (first hierarchy choice) for new data
        setSelectedGrouping(null);
        onFileUpload?.(uploadedData, filename);
      },
      [onFileUpload],
    );
    // Handle configuration changes
    const handleConfigChange = useCallback(
      (config: RenderConfig) => {
        setState((prev) => ({
          ...prev,
          renderConfig: { ...prev.renderConfig, ...config },
        }));
        onConfigChange?.(config);
      },
      [onConfigChange],
    );
    // Handle edge style changes - use HydroscopeCore's updateRenderConfig method
    const handleEdgeStyleChange = useCallback(
      async (edgeStyle: "bezier" | "straight" | "smoothstep") => {
        try {
          // Update local state first to keep UI in sync
          setState((prev) => ({
            ...prev,
            renderConfig: { ...prev.renderConfig, edgeStyle },
          }));
          // Update render config through HydroscopeCore's AsyncCoordinator
          await hydroscopeCoreRef.current?.updateRenderConfig({ edgeStyle });
        } catch (error) {
          console.error(
            "[Hydroscope] ❌ Error handling edge style change:",
            error,
          );
          onError?.(error as Error);
        }
      },
      [onError],
    );
    // Handle style tuner changes (for non-edge style changes)
    const handleStyleChange = useCallback(
      (styleConfig: StyleTunerConfig) => {
        const renderConfig: RenderConfig = {
          edgeStyle: styleConfig.edgeStyle,
          edgeWidth: styleConfig.edgeWidth,
          edgeDashed: styleConfig.edgeDashed,
          nodePadding: styleConfig.nodePadding,
          nodeFontSize: styleConfig.nodeFontSize,
          containerBorderWidth: styleConfig.containerBorderWidth,
          colorPalette: state.colorPalette,
          fitView: state.autoFitEnabled,
          showFullNodeLabels: styleConfig.showFullNodeLabels,
        };
        handleConfigChange(renderConfig);
      },
      [state.colorPalette, state.autoFitEnabled, handleConfigChange],
    );
    // Handle palette changes - use HydroscopeCore's updateRenderConfig method
    const handlePaletteChange = useCallback(
      async (palette: string) => {
        try {
          // Update local state first to keep UI in sync
          setState((prev) => ({ ...prev, colorPalette: palette }));
          // Update color palette through HydroscopeCore's AsyncCoordinator
          await hydroscopeCoreRef.current?.updateRenderConfig({
            colorPalette: palette,
          });
        } catch (error) {
          console.error(
            "[Hydroscope] ❌ Error handling color palette change:",
            error,
          );
          onError?.(error as Error);
        }
      },
      [onError],
    );
    // Handle layout changes - use HydroscopeCore's updateRenderConfig method
    const handleLayoutChange = useCallback(
      async (layout: string) => {
        try {
          // Update local state first to keep UI in sync
          setState((prev) => ({ ...prev, layoutAlgorithm: layout }));
          // Update layout algorithm through HydroscopeCore's AsyncCoordinator
          await hydroscopeCoreRef.current?.updateRenderConfig({
            layoutAlgorithm: layout,
          });
        } catch (error) {
          console.error("[Hydroscope] ❌ Error handling layout change:", error);
          onError?.(error as Error);
        }
      },
      [onError],
    );
    // Handle bulk operations with ResizeObserver error suppression
    const handleCollapseAll = useCallback(async () => {
      if (!debouncedOperationManagerRef.current) return;

      const debouncedCollapseAll =
        debouncedOperationManagerRef.current.debounce(
          "collapseContainers",
          withAsyncResizeObserverErrorSuppression(async () => {
            try {
              await hydroscopeCoreRef.current?.collapseContainers();
              // Update status message for e2e testing
              setState((prev) => ({
                ...prev,
                statusMessage: "All containers collapsed",
              }));
              // Clear status message after a delay
              if (statusTimeoutRef.current) {
                clearTimeout(statusTimeoutRef.current);
              }
              statusTimeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                  setState((prev) => ({ ...prev, statusMessage: "" }));
                }
                statusTimeoutRef.current = null;
              }, 2000);
            } catch (error) {
              console.error("Failed to collapse all containers:", error);
              if (isMountedRef.current) {
                setState((prev) => ({
                  ...prev,
                  statusMessage: "Failed to collapse containers",
                }));
              }
              onError?.(error as Error);
            }
          }),
          200, // Longer delay for bulk operations
        );

      debouncedCollapseAll();
    }, [onError]);

    const handleExpandAll = useCallback(async () => {
      if (!debouncedOperationManagerRef.current) return;

      const debouncedExpandAll = debouncedOperationManagerRef.current.debounce(
        "expandContainers",
        withAsyncResizeObserverErrorSuppression(async () => {
          try {
            await hydroscopeCoreRef.current?.expandContainers();
            // Update status message for e2e testing
            setState((prev) => ({
              ...prev,
              statusMessage: "All containers expanded",
            }));
            // Clear status message after a delay
            if (statusTimeoutRef.current) {
              clearTimeout(statusTimeoutRef.current);
            }
            statusTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current) {
                setState((prev) => ({ ...prev, statusMessage: "" }));
              }
              statusTimeoutRef.current = null;
            }, 2000);
          } catch (error) {
            console.error("Failed to expand all containers:", error);
            if (isMountedRef.current) {
              setState((prev) => ({
                ...prev,
                statusMessage: "Failed to expand containers",
              }));
            }
            onError?.(error as Error);
          }
        }),
        200, // Longer delay for bulk operations
      );

      debouncedExpandAll();
    }, [onError]);
    // Handle sync tree and graph toggle
    const handleSyncTreeAndGraphToggle = useCallback((enabled: boolean) => {
      setState((prev) => ({
        ...prev,
        syncTreeAndGraph: enabled,
      }));
      // When enabling sync, sync the tree to match the graph (preserve ReactFlow state)
      // This is handled automatically by the tree component responding to collapsedContainers prop
    }, []);
    // Handle auto-fit toggle
    const handleAutoFitToggle = useCallback(() => {
      setState((prev) => {
        const newAutoFitEnabled = !prev.autoFitEnabled;
        // If we're enabling auto-fit, trigger a fit view immediately
        if (newAutoFitEnabled && hydroscopeCoreRef.current) {
          hydroscopeCoreRef.current.fitView();
        }
        return { ...prev, autoFitEnabled: newAutoFitEnabled };
      });
    }, []);
    // Handle load file button
    const handleLoadFile = useCallback(() => {
      fileInputRef.current?.click();
    }, []);

    // Handle save file button
    const handleSave = useCallback(() => {
      if (!state.data) return;

      const filename = state.uploadedFilename || "hydroscope-export";
      const baseFilename = filename.replace(/\.(json|png)$/i, "");

      // Create a simple modal using native browser APIs
      const modal = document.createElement("div");
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      const dialog = document.createElement("div");
      dialog.style.cssText = `
        background: white;
        padding: 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        min-width: 300px;
      `;

      dialog.innerHTML = `
        <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Export Visualization</h3>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; font-size: 14px;">Choose format:</label>
          <select id="format-select" style="width: 100%; padding: 8px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 14px;">
            <option value="png">PNG (Image)</option>
            <option value="json">JSON (Data)</option>
          </select>
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button id="cancel-btn" style="padding: 8px 16px; border: 1px solid #d9d9d9; border-radius: 4px; background: white; cursor: pointer; font-size: 14px;">Cancel</button>
          <button id="save-btn" style="padding: 8px 16px; border: none; border-radius: 4px; background: #1890ff; color: white; cursor: pointer; font-size: 14px;">Save</button>
        </div>
      `;

      modal.appendChild(dialog);
      document.body.appendChild(modal);

      const formatSelect = dialog.querySelector(
        "#format-select",
      ) as HTMLSelectElement;
      const cancelBtn = dialog.querySelector(
        "#cancel-btn",
      ) as HTMLButtonElement;
      const saveBtn = dialog.querySelector("#save-btn") as HTMLButtonElement;

      const cleanup = () => {
        document.body.removeChild(modal);
      };

      cancelBtn.onclick = cleanup;
      modal.onclick = (e) => {
        if (e.target === modal) cleanup();
      };

      saveBtn.onclick = () => {
        const format = formatSelect.value;
        cleanup();

        if (format === "png") {
          // Export as PNG using the ReactFlow wrapper
          const reactFlowWrapper = document.querySelector(".react-flow");
          if (!reactFlowWrapper) {
            alert("Unable to export: visualization not found");
            return;
          }

          // Use modern browser APIs to capture the element
          // This approach works without external dependencies
          const rect = reactFlowWrapper.getBoundingClientRect();
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            alert("Unable to create canvas context");
            return;
          }

          // Set canvas size to match the element
          canvas.width = rect.width * 2; // 2x for better quality
          canvas.height = rect.height * 2;
          ctx.scale(2, 2);

          // Fill with white background
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, rect.width, rect.height);

          // Get all SVG elements and draw them
          const svgElements =
            reactFlowWrapper.querySelectorAll<SVGSVGElement>("svg");

          if (svgElements.length === 0) {
            alert("No content found to export");
            return;
          }

          // For a simple implementation, we'll serialize the SVG and use it
          // This is a basic approach that works for most cases
          const serializer = new XMLSerializer();
          let svgString = "";

          svgElements.forEach((svg) => {
            svgString += serializer.serializeToString(svg);
          });

          // Create a data URL from the SVG
          const svgBlob = new Blob([svgString], {
            type: "image/svg+xml;charset=utf-8",
          });
          const svgUrl = URL.createObjectURL(svgBlob);

          // Load the SVG as an image and draw to canvas
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, rect.width, rect.height);
            URL.revokeObjectURL(svgUrl);

            // Convert canvas to blob and download
            canvas.toBlob((blob) => {
              if (!blob) {
                alert("Failed to create image");
                return;
              }
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.download = `${baseFilename}.png`;
              link.href = url;
              link.style.display = "none";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              // Delay cleanup to ensure download starts
              setTimeout(() => URL.revokeObjectURL(url), 100);
            });
          };

          img.onerror = () => {
            URL.revokeObjectURL(svgUrl);
            alert(
              "Failed to export PNG. Please try JSON export or take a screenshot.",
            );
          };

          img.src = svgUrl;
        } else if (format === "json") {
          // Export as JSON
          const dataStr = JSON.stringify(state.data, null, 2);
          const blob = new Blob([dataStr], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = `${baseFilename}.json`;
          link.href = url;
          link.style.display = "none";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          // Delay cleanup to ensure download starts
          setTimeout(() => URL.revokeObjectURL(url), 100);
        }
      };
    }, [state.data, state.uploadedFilename]);
    // Handle search updates from InfoPanel
    const handleSearchUpdate = useCallback(
      async (query: string, matches: SearchMatch[], current?: SearchMatch) => {
        setState((prev) => {
          // When user initiates a search (non-empty query), disable autofit to prevent
          // losing focus while navigating through search results
          const shouldDisableAutoFit =
            query.trim().length > 0 && prev.autoFitEnabled;

          return {
            ...prev,
            searchQuery: query,
            searchMatches: matches,
            currentSearchMatch: current,
            // Disable autofit when starting a search to maintain focus during navigation
            autoFitEnabled: shouldDisableAutoFit ? false : prev.autoFitEnabled,
          };
        });
        // Use consolidated search operation to prevent race conditions and ResizeObserver errors
        if (hydroscopeCoreRef.current) {
          try {
            const asyncCoordinator =
              hydroscopeCoreRef.current.getAsyncCoordinator();
            const currentVisualizationState =
              hydroscopeCoreRef.current.getVisualizationState();

            if (asyncCoordinator && currentVisualizationState) {
              // Use the consolidated updateSearchResults method
              // This handles: search → expand → highlight → render
              // All in a single queued operation to prevent race conditions
              await asyncCoordinator.updateSearchResults(
                query,
                currentVisualizationState,
                {
                  expandContainers: true, // Expand containers to show search results
                  fitView: true, // Fit view to show search results
                  fitViewOptions: {
                    padding: 0.2,
                    duration: 300,
                  },
                },
              );
            }
          } catch (_error) {
            // Handle search errors silently
          }
        }
      },
      [],
    );
    // Handle navigation from tree hierarchy to graph
    const handleElementNavigation = useCallback(
      async (elementId: string, elementType: "node" | "container") => {
        try {
          // Use HydroscopeCore's navigateToElement method which handles:
          // 1. Automatic container expansion if element is not visible
          // 2. Navigation state update in VisualizationState
          // 3. Viewport focusing in ReactFlow graph
          await hydroscopeCoreRef.current?.navigateToElement(elementId);
        } catch (error) {
          console.error(
            `[Hydroscope] Error navigating to ${elementType} ${elementId}:`,
            error,
          );
        }
      },
      [],
    );
    // Track visualization state changes with a counter (since VisualizationState is mutable)
    const [visualizationStateVersion, setVisualizationStateVersion] =
      useState(0);

    // Handle visualization state changes from HydroscopeCore
    const handleVisualizationStateChange = useCallback(
      (visualizationState: VisualizationState) => {
        hscopeLogger.log(
          "orchestrator",
          "🔄 [Hydroscope] handleVisualizationStateChange called, visualizationState:",
          !!visualizationState,
        );
        setState((prev) => ({
          ...prev,
          currentVisualizationState: visualizationState,
        }));
        // Increment version to trigger recalculation of derived state
        setVisualizationStateVersion((v) => v + 1);
      },
      [],
    );

    // Derive collapsed containers from VisualizationState for InfoPanel
    // Note: visualizationStateVersion is used as a trigger to recalculate when state changes
    // (VisualizationState is mutable, so we need a separate trigger)
    const collapsedContainers = useMemo(() => {
      // Force recalculation when version changes (intentional dependency)
      void visualizationStateVersion;

      if (!state.currentVisualizationState) return new Set<string>();

      const collapsed = new Set<string>();
      const allContainers = state.currentVisualizationState.getAllContainers();

      for (const container of allContainers) {
        if (container.collapsed) {
          collapsed.add(container.id);
        }
      }

      return collapsed;
    }, [state.currentVisualizationState, visualizationStateVersion]);

    // DEV MODE: Validate sync invariant after deriving collapsedContainers
    // Run in useEffect to ensure state updates have settled (e.g., after async expandAll)
    useEffect(() => {
      if (
        process.env.NODE_ENV !== "production" &&
        state.currentVisualizationState
      ) {
        try {
          // Use aggressive invariant checking
          assertCollapsedSetConsistent(collapsedContainers, () =>
            state.currentVisualizationState!.getAllContainers(),
          );
        } catch (error) {
          console.error("Error validating sync invariant:", error);
        }
      }
    }, [collapsedContainers, state.currentVisualizationState]);

    // Handle container toggle from InfoPanel (when sync is enabled)
    const handleToggleContainerFromInfoPanel = useCallback(
      async (containerId: string) => {
        if (!hydroscopeCoreRef.current) {
          console.warn("[Hydroscope] HydroscopeCore ref not available");
          return;
        }

        // Use HydroscopeCore's imperative toggle method
        // This will trigger the same logic as clicking a container in the graph
        try {
          await hydroscopeCoreRef.current.toggle(containerId);
        } catch (error) {
          console.error(
            `[Hydroscope] Error toggling container ${containerId}:`,
            error,
          );
        }
      },
      [],
    );

    // Handle batch container expansion (for search results)
    const handleBatchExpandContainers = useCallback(
      async (containerIds: string[]) => {
        if (!hydroscopeCoreRef.current) {
          console.warn("[Hydroscope] HydroscopeCore ref not available");
          return;
        }

        try {
          await hydroscopeCoreRef.current.expandContainers(containerIds);
        } catch (error) {
          console.error(`[Hydroscope] Error expanding containers:`, error);
        }
      },
      [],
    );

    // Apply persisted showFullNodeLabels setting when VisualizationState becomes available
    // Note: This only runs on initial mount to restore persisted settings
    useEffect(() => {
      const visualizationState =
        hydroscopeCoreRef.current?.getVisualizationState?.();
      if (!visualizationState) return;

      // Only apply on initial mount when we have a persisted setting
      const enabled = state.renderConfig.showFullNodeLabels;
      if (!enabled) return; // Only need to apply if it was persisted as true

      hscopeLogger.log(
        "orchestrator",
        "🔄 [Hydroscope] Applying persisted showFullNodeLabels=true on mount",
      );

      visualizationState.expandAllNodeLabelsToLong();
      visualizationState.updateNodeDimensionsForFullLabels(true);

      // Trigger a re-layout to apply the new dimensions
      const asyncCoordinator =
        hydroscopeCoreRef.current?.getAsyncCoordinator?.();
      if (asyncCoordinator) {
        asyncCoordinator
          .executeLayoutAndRenderPipeline(visualizationState, {
            relayoutEntities: undefined, // Full layout
            fitView: false,
          })
          .catch((error: Error) => {
            console.error(
              "[Hydroscope] Failed to apply persisted showFullNodeLabels:",
              error,
            );
          });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.currentVisualizationState]); // Only run when visualization state becomes available

    // Reallocate bridges and instances for hard reset
    const reallocateBridges = useCallback(() => {
      hscopeLogger.log(
        "orchestrator",
        "🔄 [Hydroscope] Reallocating bridges for hard reset",
      );

      // Get AsyncCoordinator
      const asyncCoordinator =
        hydroscopeCoreRef.current?.getAsyncCoordinator?.();
      if (!asyncCoordinator) {
        console.error("❌ [Hydroscope] AsyncCoordinator not available");
        return null;
      }

      // Use utility function to reset all bridges and components
      // This performs a complete reallocation of:
      // 1. ELK bridge → creates new ELK instance
      // 2. ReactFlow bridge
      // 3. ELK instance (inside ELK bridge)
      // 4. ReactFlow component (via remount)
      const result = resetAllBridges({
        algorithm: state.layoutAlgorithm,
        asyncCoordinator,
        elkBridgeRef,
        reactFlowBridgeRef: { current: null }, // Not tracked in Hydroscope, only in HydroscopeCore
        hydroscopeCoreRef,
      });

      if (result) {
        hscopeLogger.log(
          "orchestrator",
          "✅ [Hydroscope] Bridge reallocation complete",
        );
        return {
          asyncCoordinator: result.asyncCoordinator,
          visualizationState: result.visualizationState,
          forceRemount: result.forceRemount,
        };
      }

      return null;
    }, [state.layoutAlgorithm]);

    // Handle node clicks - default behavior is to toggle label, but allow override
    const handleNodeClick = useCallback(
      async (
        event: React.MouseEvent,
        node: any,
        visualizationState?: VisualizationState,
      ) => {
        // If user provided a custom handler, use that instead
        if (onNodeClick) {
          onNodeClick(event, node, visualizationState);
          return;
        }

        // Skip label toggling for container nodes - they don't support label toggling
        if (node.data?.nodeType === "container") {
          return;
        }

        // Default behavior: Toggle individual node label and adjust dimensions
        const currentVisualizationState =
          visualizationState ||
          hydroscopeCoreRef.current?.getVisualizationState?.();
        const asyncCoordinator =
          hydroscopeCoreRef.current?.getAsyncCoordinator?.();

        if (!currentVisualizationState || !asyncCoordinator) {
          console.warn(
            "[Hydroscope] Cannot toggle node label - missing instances",
          );
          return;
        }

        const graphNode = currentVisualizationState.getGraphNode(node.id);
        if (!graphNode) {
          console.warn(
            `[Hydroscope] Cannot toggle node label - node ${node.id} not found`,
          );
          return;
        }

        hscopeLogger.log(
          "orchestrator",
          `🏷️ [Hydroscope] Toggling label for node ${node.id}, current state: ${graphNode.showingLongLabel}`,
        );

        // Toggle the node's label
        const wasShowingLong = graphNode.showingLongLabel;
        if (wasShowingLong) {
          currentVisualizationState.resetNodeLabelToShort(node.id);

          // If we're toggling to short label, disable "Show full node labels" globally
          // Update both the UI state and AsyncCoordinator render options
          setState((prev) => ({
            ...prev,
            renderConfig: {
              ...prev.renderConfig,
              showFullNodeLabels: false,
            },
          }));

          // Update AsyncCoordinator render options
          if (asyncCoordinator.setRenderOptions) {
            asyncCoordinator.setRenderOptions({
              showFullNodeLabels: false,
            });
          }
        } else {
          currentVisualizationState.expandNodeLabelToLong(node.id);
        }

        // Update dimensions for this specific node
        currentVisualizationState.updateNodeDimensionsForLabel(node.id);

        // Only relayout the specific node, not its parent containers
        // This keeps container positions fixed and prevents the graph from moving around
        const relayoutEntities: string[] = [node.id];

        hscopeLogger.log(
          "orchestrator",
          `🎯 [Hydroscope] Constrained layout for node ${node.id} only (keeping containers fixed)`,
        );

        // Use AsyncCoordinator to manage the layout with constrained relayout
        await asyncCoordinator.executeLayoutAndRenderPipeline(
          currentVisualizationState,
          {
            relayoutEntities, // Only re-layout the changed node and its parent containers
            fitView: false, // Don't auto-fit on manual interactions
          },
        );
      },
      [onNodeClick],
    );

    // Container dimensions
    const containerStyle = useMemo(
      () => ({
        height: typeof height === "number" ? `${height}px` : height,
        width: typeof width === "number" ? `${width}px` : width,
        position: "relative" as const,
        display: "flex" as const,
        ...style,
      }),
      [height, width, style],
    );
    // Show file upload if no data and file upload is enabled
    const shouldShowFileUpload = showFileUpload && !state.data;
    return (
      <ErrorBoundary
        fallback={(_error, _errorInfo, retry) => (
          <div
            style={containerStyle}
            className={`hydroscope ${className || ""}`}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "#d32f2f",
                backgroundColor: "#ffeaea",
                border: "1px solid #ffcdd2",
                borderRadius: "4px",
                padding: "20px",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <h3 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>
                  Component Error
                </h3>
                <p style={{ margin: "0 0 15px 0", fontSize: "14px" }}>
                  An unexpected error occurred in the Hydroscope component.
                </p>
                <button
                  onClick={retry}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#1976d2",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}
      >
        <div style={containerStyle} className={`hydroscope ${className || ""}`}>
          {shouldShowFileUpload ? (
            // File upload interface
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                width: "100%",
              }}
            >
              <FileUpload
                onFileLoaded={handleFileUpload}
                onParseError={(error, filename) => {
                  console.error(`Failed to parse ${filename}:`, error);
                  setState((prev) => ({
                    ...prev,
                    error: new Error(
                      `Failed to parse ${filename}: ${error.message}`,
                    ),
                  }));
                }}
                onValidationError={(errors, filename) => {
                  console.error(`Validation errors in ${filename}:`, errors);
                  setState((prev) => ({
                    ...prev,
                    error: new Error(`Validation errors in ${filename}`),
                  }));
                }}
                generatedFilePath={urlFilePath || generatedFilePath}
              />
            </div>
          ) : (
            // Main visualization interface
            <ReactFlowProvider>
              <div
                style={{ position: "relative", height: "100%", width: "100%" }}
              >
                {/* Core visualization */}
                <HydroscopeCore
                  ref={hydroscopeCoreRef}
                  data={state.data!}
                  height="100%"
                  width="100%"
                  showControls={true} // Enable standard ReactFlow controls in HydroscopeCore
                  showMiniMap={showMiniMap}
                  showBackground={showBackground}
                  enableCollapse={enableCollapse}
                  initialLayoutAlgorithm={state.layoutAlgorithm}
                  initialColorPalette={state.colorPalette}
                  initialEdgeStyle={state.renderConfig.edgeStyle}
                  initialEdgeWidth={state.renderConfig.edgeWidth}
                  initialEdgeDashed={state.renderConfig.edgeDashed}
                  initialNodePadding={state.renderConfig.nodePadding}
                  initialNodeFontSize={state.renderConfig.nodeFontSize}
                  initialContainerBorderWidth={
                    state.renderConfig.containerBorderWidth
                  }
                  uiScale={uiScale}
                  autoFitEnabled={state.autoFitEnabled}
                  onNodeClick={onNodeClick || handleNodeClick}
                  onContainerCollapse={onContainerCollapse}
                  onContainerExpand={onContainerExpand}
                  onVisualizationStateChange={handleVisualizationStateChange}
                  onError={onError}
                />

                {/* Custom Controls */}
                <div style={{ zoom: uiScale }}>
                  <CustomControls
                    visualizationState={state.currentVisualizationState}
                    onCollapseAll={handleCollapseAll}
                    onExpandAll={handleExpandAll}
                    onAutoFitToggle={handleAutoFitToggle}
                    onLoadFile={handleLoadFile}
                    onSave={handleSave}
                    showLoadFile={true}
                    showSaveFile={true}
                    autoFitEnabled={state.autoFitEnabled}
                    currentData={state.data}
                  />
                </div>

                {/* Status display for e2e testing */}
                {state.statusMessage && (
                  <div
                    data-testid="status"
                    style={{
                      position: "absolute",
                      top: "10px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "rgba(0, 0, 0, 0.8)",
                      color: "white",
                      padding: "8px 16px",
                      borderRadius: "4px",
                      fontSize: "14px",
                      zIndex: 1000,
                      pointerEvents: "none",
                    }}
                  >
                    {state.statusMessage}
                  </div>
                )}

                {/* InfoPanel */}
                {showInfoPanel && (
                  <div style={{ zoom: uiScale }}>
                    <InfoPanel
                      ref={infoPanelRef}
                      open={state.infoPanelOpen}
                      onOpenChange={(open) =>
                        setState((prev) => ({ ...prev, infoPanelOpen: open }))
                      }
                      onSearchUpdate={handleSearchUpdate}
                      visualizationState={state.currentVisualizationState}
                      hierarchyChoices={state.data?.hierarchyChoices || []}
                      currentGrouping={currentGrouping}
                      onGroupingChange={(groupingId) => {
                        setSelectedGrouping(groupingId);
                        // Use AsyncCoordinator to queue hierarchy change
                        if (data && groupingId && hydroscopeCoreRef.current) {
                          setState((prev) => ({
                            ...prev,
                            isLoading: true,
                            error: null,
                          }));
                          const asyncCoordinator =
                            hydroscopeCoreRef.current.getAsyncCoordinator();
                          if (asyncCoordinator) {
                            asyncCoordinator
                              .queueHierarchyChange(
                                groupingId,
                                data,
                                (updatedData) => {
                                  setState((prev) => ({
                                    ...prev,
                                    data: updatedData,
                                    isLoading: false,
                                  }));
                                },
                              )
                              .catch((error) => {
                                console.error(
                                  "Hierarchy change failed:",
                                  error,
                                );
                                setState((prev) => ({
                                  ...prev,
                                  isLoading: false,
                                  error:
                                    error instanceof Error
                                      ? error
                                      : new Error("Hierarchy change failed"),
                                }));
                              });
                          } else {
                            console.warn(
                              "AsyncCoordinator not available for hierarchy change",
                            );
                            // Fallback to direct state update
                            const updatedData = { ...data };
                            if (updatedData.hierarchyChoices) {
                              const selectedChoice =
                                updatedData.hierarchyChoices.find(
                                  (choice) => choice.id === groupingId,
                                );
                              const otherChoices =
                                updatedData.hierarchyChoices.filter(
                                  (choice) => choice.id !== groupingId,
                                );
                              if (selectedChoice) {
                                updatedData.hierarchyChoices = [
                                  selectedChoice,
                                  ...otherChoices,
                                ];
                              }
                            }
                            setState((prev) => ({
                              ...prev,
                              data: updatedData,
                              isLoading: false,
                            }));
                          }
                        }
                      }}
                      collapsedContainers={collapsedContainers}
                      onToggleContainer={handleToggleContainerFromInfoPanel}
                      onTreeExpansion={handleBatchExpandContainers}
                      onElementNavigation={handleElementNavigation}
                      colorPalette={state.colorPalette}
                      legendData={
                        state.data?.legend
                          ? {
                              title: state.data.legend.title || "Legend",
                              items: state.data.legend.items,
                            }
                          : undefined
                      }
                      edgeStyleConfig={state.data?.edgeStyleConfig as any}
                      nodeTypeConfig={state.data?.nodeTypeConfig}
                      asyncCoordinator={asyncCoordinator}
                      syncTreeAndGraph={state.syncTreeAndGraph}
                      onSyncTreeAndGraphChange={handleSyncTreeAndGraphToggle}
                    />
                  </div>
                )}

                {/* StyleTuner */}
                {showStylePanel && (
                  <div style={{ zoom: uiScale }}>
                    <StyleTuner
                      value={state.renderConfig}
                      onChange={handleStyleChange}
                      colorPalette={state.colorPalette}
                      onPaletteChange={handlePaletteChange}
                      currentLayout={state.layoutAlgorithm}
                      onLayoutChange={handleLayoutChange}
                      onEdgeStyleChange={handleEdgeStyleChange}
                      onResetToDefaults={async () => {
                        try {
                          // Clear localStorage to ensure we get true defaults
                          localStorage.removeItem(STORAGE_KEY);
                          // Update local state with hardcoded defaults
                          setState((prev) => ({
                            ...prev,
                            renderConfig: DEFAULT_RENDER_CONFIG,
                            colorPalette: DEFAULT_COLOR_PALETTE,
                            layoutAlgorithm: DEFAULT_ELK_ALGORITHM, // Use hardcoded default
                          }));
                          // Apply the defaults to the visualization through the same handlers
                          // Reset color palette
                          await handlePaletteChange(DEFAULT_COLOR_PALETTE);
                          // Reset layout algorithm - use hardcoded default
                          await handleLayoutChange(DEFAULT_ELK_ALGORITHM);
                          // Reset edge style (part of render config)
                          await handleEdgeStyleChange(
                            DEFAULT_RENDER_CONFIG.edgeStyle,
                          );
                        } catch (error) {
                          console.error(
                            "[Hydroscope] ❌ Error resetting to defaults:",
                            error,
                          );
                          onError?.(error as Error);
                        }
                      }}
                      open={state.stylePanelOpen}
                      onOpenChange={(open) =>
                        setState((prev) => ({ ...prev, stylePanelOpen: open }))
                      }
                      visualizationState={
                        hydroscopeCoreRef.current?.getVisualizationState?.() ||
                        null
                      }
                      asyncCoordinator={
                        hydroscopeCoreRef.current?.getAsyncCoordinator?.() ||
                        null
                      }
                      onFullNodeLabelsChange={(_enabled) => {
                        // The StyleTuner handles the implementation through AsyncCoordinator and VisualizationState
                        // This callback is mainly for external integrations if needed
                      }}
                      onReallocateBridges={reallocateBridges}
                    />
                  </div>
                )}

                {/* Panel Toggle Buttons (upper right corner) */}
                {(showInfoPanel || showStylePanel) && (
                  <div
                    style={{
                      position: "absolute",
                      top: "20px",
                      right: "20px",
                      zIndex: 1001,
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      zoom: uiScale,
                      pointerEvents: "none", // Let clicks pass through container
                    }}
                  >
                    {showInfoPanel && (
                      <button
                        onClick={() =>
                          setState((prev) => ({
                            ...prev,
                            infoPanelOpen: !prev.infoPanelOpen,
                          }))
                        }
                        style={{
                          width: "40px",
                          height: "40px",
                          backgroundColor: state.infoPanelOpen
                            ? "#4caf50"
                            : "rgba(255, 255, 255, 0.9)",
                          color: "#222",
                          border: "1px solid #ddd",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "20px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                          transition: "all 0.2s ease",
                          pointerEvents: "auto", // Enable clicks on button
                        }}
                        title="Toggle Info Panel"
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 1024 1024"
                          fill="currentColor"
                        >
                          <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z" />
                          <path d="M464 336a48 48 0 1 0 96 0 48 48 0 1 0-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z" />
                        </svg>
                      </button>
                    )}
                    {showStylePanel && (
                      <button
                        onClick={() =>
                          setState((prev) => ({
                            ...prev,
                            stylePanelOpen: !prev.stylePanelOpen,
                          }))
                        }
                        style={{
                          width: "40px",
                          height: "40px",
                          backgroundColor: state.stylePanelOpen
                            ? "#4caf50"
                            : "rgba(255, 255, 255, 0.9)",
                          color: "#222",
                          border: "1px solid #ddd",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "20px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                          transition: "all 0.2s ease",
                          pointerEvents: "auto", // Enable clicks on button
                        }}
                        title="Toggle Style Panel"
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 1024 1024"
                          fill="currentColor"
                        >
                          <path d="M924.8 625.7l-65.5-56c3.1-19 4.7-38.4 4.7-57.8s-1.6-38.8-4.7-57.8l65.5-56a32.03 32.03 0 0 0 9.3-35.2l-.9-2.6a443.74 443.74 0 0 0-79.7-137.9l-1.8-2.1a32.12 32.12 0 0 0-35.1-9.5l-81.3 28.9c-30-24.6-63.5-44-99.7-57.6l-15.7-85a32.05 32.05 0 0 0-25.8-25.7l-2.7-.5c-52.1-9.4-106.9-9.4-159 0l-2.7.5a32.05 32.05 0 0 0-25.8 25.7l-15.8 85.4a351.86 351.86 0 0 0-99 57.4l-81.9-29.1a32 32 0 0 0-35.1 9.5l-1.8 2.1a446.02 446.02 0 0 0-79.7 137.9l-.9 2.6c-4.5 12.5-.8 26.5 9.3 35.2l66.3 56.6c-3.1 18.8-4.6 38-4.6 57.1 0 19.2 1.5 38.4 4.6 57.1L99 625.5a32.03 32.03 0 0 0-9.3 35.2l.9 2.6c18.1 50.4 44.9 96.9 79.7 137.9l1.8 2.1a32.12 32.12 0 0 0 35.1 9.5l81.9-29.1c29.8 24.5 63.1 43.9 99 57.4l15.8 85.4a32.05 32.05 0 0 0 25.8 25.7l2.7.5a449.4 449.4 0 0 0 159 0l2.7-.5a32.05 32.05 0 0 0 25.8-25.7l15.7-85a350 350 0 0 0 99.7-57.6l81.3 28.9a32 32 0 0 0 35.1-9.5l1.8-2.1c34.8-41.1 61.6-87.5 79.7-137.9l.9-2.6c4.5-12.3.8-26.3-9.3-35zM512 701c-104.9 0-190-85.1-190-190s85.1-190 190-190 190 85.1 190 190-85.1 190-190 190z" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}

                {/* Hidden file input for load file button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        try {
                          const data = JSON.parse(
                            event.target?.result as string,
                          );
                          handleFileUpload(data, file.name);
                        } catch (error) {
                          console.error("Failed to parse file:", error);
                          setState((prev) => ({
                            ...prev,
                            error: new Error(
                              `Failed to parse file: ${(error as Error).message}`,
                            ),
                          }));
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
  },
);
Hydroscope.displayName = "Hydroscope";
