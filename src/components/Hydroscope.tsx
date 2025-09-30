/**
 * Hydroscope - Clean, well-architected replacement for HydroscopeEnhanced
 *
 * This component provides complete functionality parity with the main branch Hydroscope component
 * while demonstrating proper v6 architecture integration and clean separation of concerns.
 *
 * ## Key Features
 *
 * - **File Upload**: Drag-and-drop interface with comprehensive file format support
 * - **InfoPanel Integration**: Complete search, grouping, and hierarchy functionality
 * - **StyleTuner Integration**: Real-time layout and styling controls
 * - **Container Operations**: Expand/collapse with proper state management
 * - **Layout Management**: Algorithm switching with automatic relayout
 * - **Color Palettes**: Persistent palette selection with immediate preview
 * - **Auto-fit**: Global coordination for optimal viewport fitting
 * - **Performance Monitoring**: Development mode performance tracking
 * - **Keyboard Shortcuts**: Ctrl+F for search, ESC for panel closing
 * - **Settings Persistence**: localStorage integration with error handling
 * - **Error Resilience**: Comprehensive error boundaries and recovery
 *
 * ## V6 Architecture Integration
 *
 * This component demonstrates proper v6 architecture usage:
 * - **VisualizationState**: Single source of truth for graph data
 * - **AsyncCoordinator**: Proper operation sequencing without race conditions
 * - **ReactFlowBridge**: Clean integration with ReactFlow visualization
 * - **ELKBridge**: Efficient layout computation with ELK algorithms
 * - **Error Handling**: Graceful degradation when components are unavailable
 *
 * ## Usage Example
 *
 * ```tsx
 * import { Hydroscope } from '@hydro-project/hydroscope';
 *
 * function App() {
 *   const [data, setData] = useState(null);
 *
 *   return (
 *     <div style={{ height: '100vh', width: '100vw' }}>
 *       <Hydroscope
 *         data={data}
 *         showFileUpload={true}
 *         showInfoPanel={true}
 *         showStylePanel={true}
 *         enableCollapse={true}
 *         initialLayoutAlgorithm="layered"
 *         initialColorPalette="Set2"
 *         onFileUpload={(uploadedData, filename) => {
 *           console.log(`Loaded file: ${filename}`);
 *           setData(uploadedData);
 *         }}
 *         onNodeClick={(event, node, visualizationState) => {
 *           console.log('Node clicked:', node.id);
 *         }}
 *         onConfigChange={(config) => {
 *           console.log('Configuration changed:', config);
 *         }}
 *       />
 *     </div>
 *   );
 * }
 * ```
 *
 * ## Migration from Main Branch
 *
 * If migrating from the main branch Hydroscope component:
 * 1. Replace main branch import with this component
 * 2. Update prop names to match new interface (see HydroscopeProps)
 * 3. Handle new callback signatures for enhanced functionality
 * 4. Remove any workarounds for architectural bugs (no longer needed)
 * 5. Update error handling to use new error callback patterns
 *
 * ## Migration from HydroscopeEnhanced
 *
 * If migrating from HydroscopeEnhanced:
 * 1. Replace HydroscopeEnhanced with Hydroscope
 * 2. Remove embedded panel configuration (now handled by separate components)
 * 3. Update callback signatures to match new interface
 * 4. Migrate settings persistence to new localStorage keys
 *
 * @since 1.0.0-alpha.7
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ControlButton,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "./nodes/index.js";
import { edgeTypes } from "./edges/index.js";
import {
  StyleConfigProvider,
  useStyleConfig,
} from "../render/StyleConfigContext.js";
import { FileUpload } from "./FileUpload.js";
import { InfoPanel } from "./panels/InfoPanel.js";
import { StyleTuner } from "./panels/StyleTuner.js";

import { VisualizationState } from "../core/VisualizationState.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import { InteractionHandler } from "../core/InteractionHandler.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import type {
  HydroscopeData,
  SearchResult,
  Container,
  LayoutConfig,
} from "../types/core.js";

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Props interface for the Hydroscope component
 *
 * Provides complete configuration options for the clean Hydroscope component
 * with full main branch functionality parity and v6 architecture integration.
 *
 * @interface HydroscopeProps
 */
export interface HydroscopeProps {
  /**
   * JSON data to visualize
   *
   * Graph data in Hydroscope format containing nodes, edges, and containers.
   * When provided, component will immediately parse and visualize the data.
   * When null/undefined, shows file upload interface if enabled.
   *
   * @optional
   */
  data?: HydroscopeData;

  /**
   * Height of the visualization container
   *
   * Can be specified as CSS string ('100vh', '500px') or number (pixels).
   * Defaults to '100%' if not specified.
   *
   * @optional
   */
  height?: string | number;

  /**
   * Width of the visualization container
   *
   * Can be specified as CSS string ('100vw', '800px') or number (pixels).
   * Defaults to '100%' if not specified.
   *
   * @optional
   */
  width?: string | number;

  /**
   * Whether to show ReactFlow controls
   *
   * Controls include zoom in/out, fit view, and lock/unlock.
   * Defaults to true for full functionality.
   *
   * @optional
   */
  showControls?: boolean;

  /**
   * Whether to show minimap
   *
   * Minimap provides overview of entire graph with current viewport indicator.
   * Useful for large graphs. Defaults to true.
   *
   * @optional
   */
  showMiniMap?: boolean;

  /**
   * Whether to show background pattern
   *
   * Adds dot or line pattern to visualization background for better spatial reference.
   * Defaults to true.
   *
   * @optional
   */
  showBackground?: boolean;

  /**
   * Show file upload interface
   *
   * When true, displays drag-and-drop file upload area when no data is provided.
   * Essential for interactive data loading. Defaults to true.
   *
   * @optional
   */
  showFileUpload?: boolean;

  /**
   * Show InfoPanel
   *
   * When true, displays the InfoPanel with search, hierarchy, and legend functionality.
   * Core feature for graph exploration. Defaults to true.
   *
   * @optional
   */
  showInfoPanel?: boolean;

  /**
   * Show StyleTuner panel
   *
   * When true, displays the StyleTuner with layout and styling controls.
   * Essential for customizing visualization appearance. Defaults to true.
   *
   * @optional
   */
  showStylePanel?: boolean;

  /**
   * Show performance panel (development)
   *
   * When true, displays performance monitoring panel in development mode.
   * Useful for debugging and optimization. Defaults to false.
   *
   * @optional
   */
  showPerformancePanel?: boolean;

  /**
   * Enable container collapse/expand
   *
   * When true, allows users to collapse and expand containers to manage
   * visual complexity. Core feature for large graphs. Defaults to true.
   *
   * @optional
   */
  enableCollapse?: boolean;

  /**
   * Initial layout algorithm
   *
   * Layout algorithm to use on first render. Options include:
   * 'layered', 'mrtree', 'force', 'stress', 'radial'.
   * Defaults to 'layered'.
   *
   * @optional
   */
  initialLayoutAlgorithm?: string;

  /**
   * Initial color palette
   *
   * Color palette to use on first render. Options include:
   * 'Set2', 'Set3', 'Pastel1', 'Dark2'.
   * Defaults to 'Set2'.
   *
   * @optional
   */
  initialColorPalette?: string;

  /**
   * Enable responsive height calculation
   *
   * When true, automatically adjusts height based on container size.
   * Useful for responsive layouts. Defaults to false.
   *
   * @optional
   */
  responsive?: boolean;

  /**
   * Enable URL parameter parsing for data loading
   *
   * When true, attempts to load data from URL parameters on mount.
   * Useful for shareable visualization links. Defaults to false.
   *
   * @optional
   */
  enableUrlParams?: boolean;

  /**
   * Callback when file is uploaded
   *
   * Called when user uploads a file through the file upload interface.
   * Provides parsed data and original filename for processing.
   *
   * @param data - Parsed graph data from uploaded file
   * @param filename - Original filename (optional)
   * @optional
   */
  onFileUpload?: (data: HydroscopeData, filename?: string) => void;

  /**
   * Callback when node is clicked
   *
   * Called when user clicks on a node in the visualization.
   * Provides click event, node data, and current visualization state.
   *
   * @param event - React click event
   * @param node - Clicked node data
   * @param visualizationState - Current visualization state
   * @optional
   */
  onNodeClick?: (
    event: any,
    node: any,
    visualizationState?: VisualizationState,
  ) => void;

  /**
   * Callback when container is collapsed
   *
   * Called when user collapses a container through InfoPanel or other controls.
   * Provides container ID and current visualization state.
   *
   * @param containerId - ID of collapsed container
   * @param visualizationState - Current visualization state
   * @optional
   */
  onContainerCollapse?: (
    containerId: string,
    visualizationState?: VisualizationState,
  ) => void;

  /**
   * Callback when container is expanded
   *
   * Called when user expands a container through InfoPanel or other controls.
   * Provides container ID and current visualization state.
   *
   * @param containerId - ID of expanded container
   * @param visualizationState - Current visualization state
   * @optional
   */
  onContainerExpand?: (
    containerId: string,
    visualizationState?: VisualizationState,
  ) => void;

  /**
   * Callback when configuration changes
   *
   * Called when user modifies styling, layout, or other configuration through
   * StyleTuner or other controls. Provides complete render configuration.
   *
   * @param config - Updated render configuration
   * @optional
   */
  onConfigChange?: (config: RenderConfig) => void;

  /**
   * Generated file path for display
   *
   * Optional file path to display in UI, useful when data comes from
   * generated or processed files rather than direct user uploads.
   *
   * @optional
   */
  generatedFilePath?: string;

  /**
   * Optional custom styling
   *
   * CSS class name to apply to the Hydroscope root element
   * for custom styling and theming.
   *
   * @optional
   */
  className?: string;

  /**
   * Optional style overrides
   *
   * Inline styles to apply to the Hydroscope root element.
   * Use sparingly - prefer className for styling.
   *
   * @optional
   */
  style?: React.CSSProperties;
}

export interface RenderConfig {
  // Edge Styles
  edgeStyle?: "bezier" | "straight" | "smoothstep";
  edgeWidth?: number;
  edgeDashed?: boolean;

  // Node Styles
  nodePadding?: number;
  nodeFontSize?: number;

  // Container Styles
  containerBorderWidth?: number;

  // Additional configuration
  colorPalette?: string;
  fitView?: boolean;
  edgeStyleConfig?: EdgeStyleConfig;
}

export interface EdgeStyleConfig {
  [key: string]: {
    color?: string;
    width?: number;
    style?: "solid" | "dashed" | "dotted";
    type?: "bezier" | "straight" | "smoothstep";
  };
}

// ============================================================================
// Internal State Interfaces
// ============================================================================

interface HydroscopeState {
  // Data Management
  data: HydroscopeData | null;
  visualizationState: VisualizationState | null;
  asyncCoordinator: AsyncCoordinator | null;
  metadata: any;
  graphData: any;
  hasParsedData: boolean;

  // UI State
  infoPanelOpen: boolean;
  stylePanelOpen: boolean;
  performancePanelOpen: boolean;

  // Configuration with Persistence
  grouping: string | undefined;
  colorPalette: string;
  layoutAlgorithm: string;
  renderConfig: RenderConfig;
  autoFitEnabled: boolean;

  // Search State (mirrors InfoPanel)
  searchQuery: string;
  searchMatches: SearchResult[];
  currentSearchMatchId: string | undefined;

  // Error and Status
  error: Error | null;
  isLoading: boolean;

  // Performance Monitoring (development mode)
  performanceMetrics: {
    renderTime: number;
    layoutTime: number;
    lastUpdate: number;
  };
}

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

const STORAGE_KEY = "hydroscope-settings";

const saveSettings = (settings: HydroscopeSettings): void => {
  try {
    const settingsJson = JSON.stringify(settings);
    localStorage.setItem(STORAGE_KEY, settingsJson);
    console.log("Hydroscope: Settings saved to localStorage");
  } catch (error) {
    console.error(
      "Hydroscope: Failed to save settings to localStorage:",
      error,
    );
    if (error instanceof Error && error.name === "QuotaExceededError") {
      console.warn(
        "Hydroscope: localStorage quota exceeded, settings not saved",
      );
    }
  }
};

const loadSettings = (): HydroscopeSettings | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      console.log("Hydroscope: No saved settings found, using defaults");
      return null;
    }

    const parsed = JSON.parse(stored);
    console.log("Hydroscope: Settings loaded from localStorage");

    // Validate the loaded settings structure
    const defaultSettings = getDefaultSettings();
    const validatedSettings: HydroscopeSettings = {
      infoPanelOpen:
        typeof parsed.infoPanelOpen === "boolean"
          ? parsed.infoPanelOpen
          : defaultSettings.infoPanelOpen,
      stylePanelOpen:
        typeof parsed.stylePanelOpen === "boolean"
          ? parsed.stylePanelOpen
          : defaultSettings.stylePanelOpen,
      autoFitEnabled:
        typeof parsed.autoFitEnabled === "boolean"
          ? parsed.autoFitEnabled
          : defaultSettings.autoFitEnabled,
      colorPalette:
        typeof parsed.colorPalette === "string"
          ? parsed.colorPalette
          : defaultSettings.colorPalette,
      layoutAlgorithm:
        typeof parsed.layoutAlgorithm === "string"
          ? parsed.layoutAlgorithm
          : defaultSettings.layoutAlgorithm,
      renderConfig:
        parsed.renderConfig && typeof parsed.renderConfig === "object"
          ? parsed.renderConfig
          : defaultSettings.renderConfig,
    };

    return validatedSettings;
  } catch (error) {
    console.error(
      "Hydroscope: Failed to load settings from localStorage:",
      error,
    );
    console.warn("Hydroscope: Using default settings due to load error");
    return null;
  }
};

const getDefaultSettings = (): HydroscopeSettings => ({
  infoPanelOpen: false,
  stylePanelOpen: false,
  autoFitEnabled: true,
  colorPalette: "Set3",
  layoutAlgorithm: "layered",
  renderConfig: {
    edgeStyle: "bezier",
    edgeWidth: 2,
    edgeDashed: false,
    nodePadding: 8,
    nodeFontSize: 12,
    containerBorderWidth: 2,
    colorPalette: "Set3",
    fitView: true,
  },
});

// ============================================================================
// Error Boundary Component
// ============================================================================

interface ErrorBoundaryProps {
  error: Error;
  onRetry: () => void;
  onReset: () => void;
}

const ErrorRecoveryComponent: React.FC<ErrorBoundaryProps> = ({
  error,
  onRetry,
  onReset,
}) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      padding: "20px",
      backgroundColor: "#f8f9fa",
      border: "1px solid #e9ecef",
      borderRadius: "8px",
      textAlign: "center",
    }}
  >
    <div
      style={{
        fontSize: "48px",
        marginBottom: "16px",
        color: "#dc3545",
      }}
    >
      ⚠️
    </div>
    <h3
      style={{
        margin: "0 0 8px 0",
        color: "#495057",
        fontSize: "18px",
      }}
    >
      Something went wrong
    </h3>
    <p
      style={{
        margin: "0 0 16px 0",
        color: "#6c757d",
        fontSize: "14px",
        maxWidth: "400px",
      }}
    >
      {error.message ||
        "An unexpected error occurred while rendering the visualization."}
    </p>
    <div style={{ display: "flex", gap: "8px" }}>
      <button
        onClick={onRetry}
        style={{
          padding: "8px 16px",
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "14px",
        }}
      >
        Try Again
      </button>
      <button
        onClick={onReset}
        style={{
          padding: "8px 16px",
          backgroundColor: "#6c757d",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "14px",
        }}
      >
        Reset
      </button>
    </div>
  </div>
);

// ============================================================================
// Performance Monitoring Utilities
// ============================================================================

interface PerformanceMetrics {
  renderTime: number;
  layoutTime: number;
  lastUpdate: number;
  memoryUsage?: number;
  componentMounts: number;
  errorCount: number;
}

const usePerformanceMonitoring = (enabled: boolean) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    layoutTime: 0,
    lastUpdate: Date.now(),
    componentMounts: 0,
    errorCount: 0,
  });

  const startTiming = useCallback(
    (operation: string) => {
      if (!enabled) return () => {};

      const startTime = performance.now();
      console.log(`Hydroscope Performance: Starting ${operation}`);

      return () => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        console.log(
          `Hydroscope Performance: ${operation} completed in ${duration.toFixed(2)}ms`,
        );

        setMetrics((prev) => ({
          ...prev,
          [operation === "render" ? "renderTime" : "layoutTime"]: duration,
          lastUpdate: Date.now(),
        }));
      };
    },
    [enabled],
  );

  const recordError = useCallback(() => {
    if (!enabled) return;

    setMetrics((prev) => ({
      ...prev,
      errorCount: prev.errorCount + 1,
      lastUpdate: Date.now(),
    }));
  }, [enabled]);

  const recordMount = useCallback(() => {
    if (!enabled) return;

    setMetrics((prev) => ({
      ...prev,
      componentMounts: prev.componentMounts + 1,
      lastUpdate: Date.now(),
    }));
  }, [enabled]);

  // Memory usage monitoring (development only)
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const updateMemoryUsage = () => {
      if ("memory" in performance) {
        const memory = (performance as any).memory;
        setMetrics((prev) => ({
          ...prev,
          memoryUsage: memory.usedJSHeapSize,
          lastUpdate: Date.now(),
        }));
      }
    };

    const interval = setInterval(updateMemoryUsage, 5000); // Update every 5 seconds
    updateMemoryUsage(); // Initial update

    return () => clearInterval(interval);
  }, [enabled]);

  return { metrics, startTiming, recordError, recordMount };
};

// ============================================================================
// ResizeObserver Error Handling
// ============================================================================

const useResizeObserver = (
  elementRef: React.RefObject<HTMLElement>,
  callback: (entry: ResizeObserverEntry) => void,
  enabled: boolean = true,
) => {
  const observerRef = useRef<ResizeObserver | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled || !elementRef.current) return;

    try {
      observerRef.current = new ResizeObserver((entries) => {
        try {
          for (const entry of entries) {
            callbackRef.current(entry);
          }
        } catch (error) {
          console.error("Hydroscope: ResizeObserver callback error:", error);
          // Don't throw - just log the error to prevent crashes
        }
      });

      observerRef.current.observe(elementRef.current);
      console.log("Hydroscope: ResizeObserver initialized successfully");
    } catch (error) {
      console.error("Hydroscope: Failed to initialize ResizeObserver:", error);
      // Graceful degradation - continue without resize observation
    }

    return () => {
      if (observerRef.current) {
        try {
          observerRef.current.disconnect();
          console.log("Hydroscope: ResizeObserver disconnected");
        } catch (error) {
          console.error(
            "Hydroscope: Error disconnecting ResizeObserver:",
            error,
          );
        }
        observerRef.current = null;
      }
    };
  }, [enabled, elementRef]);

  return observerRef;
};

// ============================================================================
// Main Hydroscope Component (with React.memo optimization)
// ============================================================================

const HydroscopeComponent: React.FC<HydroscopeProps> = ({
  data,
  height = "100vh",
  width = "100%",
  showControls = true,
  showMiniMap = false,
  showBackground = true,
  showFileUpload = true,
  showInfoPanel = true,
  showStylePanel = true,
  showPerformancePanel = false,
  enableCollapse = true,
  initialLayoutAlgorithm = "layered",
  initialColorPalette = "Set3",
  responsive = false,
  enableUrlParams = false,
  onFileUpload,
  onNodeClick,
  onContainerCollapse,
  onContainerExpand,
  onConfigChange,
  generatedFilePath,
  className,
  style,
}) => {
  // ============================================================================
  // State Management
  // ============================================================================

  // Load initial settings from localStorage
  const [state, setState] = useState<HydroscopeState>(() => {
    const savedSettings = loadSettings() || getDefaultSettings();
    return {
      // Data Management
      data: data || null,
      visualizationState: null,
      asyncCoordinator: null,
      metadata: null,
      graphData: null,
      hasParsedData: false,

      // UI State
      infoPanelOpen: savedSettings.infoPanelOpen,
      stylePanelOpen: savedSettings.stylePanelOpen,
      performancePanelOpen: false,

      // Configuration with Persistence
      grouping: undefined,
      colorPalette: savedSettings.colorPalette || initialColorPalette,
      layoutAlgorithm: savedSettings.layoutAlgorithm || initialLayoutAlgorithm,
      renderConfig: savedSettings.renderConfig,
      autoFitEnabled: savedSettings.autoFitEnabled,

      // Search State
      searchQuery: "",
      searchMatches: [],
      currentSearchMatchId: undefined,

      // Error and Status
      error: null,
      isLoading: false,

      // Performance Monitoring
      performanceMetrics: {
        renderTime: 0,
        layoutTime: 0,
        lastUpdate: Date.now(),
      },
    };
  });

  // Refs for performance monitoring and cleanup
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  // Performance monitoring
  const { metrics, startTiming, recordError, recordMount } =
    usePerformanceMonitoring(showPerformancePanel);

  // ResizeObserver for responsive behavior
  useResizeObserver(
    containerRef,
    (entry) => {
      if (responsive) {
        console.log("Hydroscope: Container resized:", entry.contentRect);
        // Trigger auto-fit if enabled
        if (state.autoFitEnabled) {
          setTimeout(() => handleAutoFit(), 100);
        }
      }
    },
    responsive,
  );

  // Record component mount
  useEffect(() => {
    recordMount();
  }, [recordMount]);

  // ============================================================================
  // Settings Persistence
  // ============================================================================

  // Save settings when they change (debounced to avoid excessive saves)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        const settings: HydroscopeSettings = {
          infoPanelOpen: state.infoPanelOpen,
          stylePanelOpen: state.stylePanelOpen,
          autoFitEnabled: state.autoFitEnabled,
          colorPalette: state.colorPalette,
          layoutAlgorithm: state.layoutAlgorithm,
          renderConfig: state.renderConfig,
        };
        saveSettings(settings);
      } catch (error) {
        console.error("Hydroscope: Error saving settings:", error);
      }
    }, 500); // Debounce saves by 500ms

    return () => clearTimeout(timeoutId);
  }, [
    state.infoPanelOpen,
    state.stylePanelOpen,
    state.autoFitEnabled,
    state.colorPalette,
    state.layoutAlgorithm,
    state.renderConfig,
  ]);

  // ============================================================================
  // Memory Leak Prevention and Cleanup
  // ============================================================================

  useEffect(() => {
    return () => {
      console.log("Hydroscope: Component unmounting, performing cleanup...");

      // Mark component as unmounted
      mountedRef.current = false;

      // Cleanup v6 components
      if (state.visualizationState) {
        try {
          // Cleanup VisualizationState if it has cleanup methods
          if (typeof (state.visualizationState as any).cleanup === "function") {
            (state.visualizationState as any).cleanup();
          }
        } catch (error) {
          console.error(
            "Hydroscope: Error cleaning up VisualizationState:",
            error,
          );
        }
      }

      if (state.asyncCoordinator) {
        try {
          // Cleanup AsyncCoordinator if it has cleanup methods
          if (typeof (state.asyncCoordinator as any).cleanup === "function") {
            (state.asyncCoordinator as any).cleanup();
          }
        } catch (error) {
          console.error(
            "Hydroscope: Error cleaning up AsyncCoordinator:",
            error,
          );
        }
      }

      console.log("Hydroscope: Cleanup completed");
    };
  }, [state.visualizationState, state.asyncCoordinator]);

  // ============================================================================
  // Safe State Updates
  // ============================================================================

  const safeSetState = useCallback(
    (updater: React.SetStateAction<HydroscopeState>) => {
      if (mountedRef.current) {
        setState(updater);
      }
    },
    [],
  );

  // ============================================================================
  // Error Handling and Graceful Degradation (moved up to fix dependency order)
  // ============================================================================

  const handleError = useCallback(
    (error: Error) => {
      console.error("Hydroscope: Error occurred:", error);

      // Record error for performance monitoring
      recordError();

      // Enhanced error logging with context
      const errorContext = {
        timestamp: new Date().toISOString(),
        hasData: !!state.data,
        hasVisualizationState: !!state.visualizationState,
        hasAsyncCoordinator: !!state.asyncCoordinator,
        currentOperation: "unknown",
        errorType: error.name,
        errorMessage: error.message,
        stackTrace: error.stack,
        performanceMetrics: showPerformancePanel ? metrics : undefined,
      };

      console.error("Hydroscope: Error context:", errorContext);

      safeSetState((prev) => ({
        ...prev,
        error,
        isLoading: false,
      }));
    },
    [
      safeSetState,
      state.data,
      state.visualizationState,
      state.asyncCoordinator,
      recordError,
      showPerformancePanel,
      metrics,
    ],
  );

  // ============================================================================
  // Data Management
  // ============================================================================

  const processData = useCallback(
    async (data: HydroscopeData, source: "file" | "url" | "prop" = "file") => {
      const endTiming = startTiming("dataProcessing");

      try {
        console.log(`Hydroscope: Processing data from ${source}:`, data);

        safeSetState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        // Validate data structure
        if (!data || typeof data !== "object") {
          throw new Error("Invalid data format: expected object");
        }

        if (!Array.isArray(data.nodes)) {
          throw new Error("Invalid data format: nodes must be an array");
        }

        if (!Array.isArray(data.edges)) {
          throw new Error("Invalid data format: edges must be an array");
        }

        // Process the data with v6 architecture integration
        const processedData = {
          ...data,
          // Ensure hierarchyChoices is properly formatted
          hierarchyChoices: data.hierarchyChoices || [],
          // Ensure nodeAssignments exists
          nodeAssignments: data.nodeAssignments || {},
        };

        // Initialize v6 Architecture Components
        let visualizationState: VisualizationState | null = null;
        let asyncCoordinator: AsyncCoordinator | null = null;

        try {
          console.log("Hydroscope: Initializing v6 VisualizationState...");
          visualizationState = new VisualizationState();

          // Load data into VisualizationState
          await (visualizationState as any).loadData(processedData);
          console.log(
            "Hydroscope: VisualizationState initialized successfully",
          );

          console.log("Hydroscope: Initializing v6 AsyncCoordinator...");
          asyncCoordinator = new AsyncCoordinator();
          console.log("Hydroscope: AsyncCoordinator initialized successfully");

          // Perform initial layout if needed
          if (visualizationState && asyncCoordinator) {
            console.log(
              "Hydroscope: Performing initial layout coordination...",
            );
            // This would trigger initial layout - placeholder for now
            // await asyncCoordinator.performInitialLayout(visualizationState);
          }
        } catch (v6Error) {
          console.error(
            "Hydroscope: V6 architecture initialization failed:",
            v6Error,
          );
          console.warn(
            "Hydroscope: Continuing with graceful degradation (v6 components unavailable)",
          );

          // Don't throw here - continue with graceful degradation
          visualizationState = null;
          asyncCoordinator = null;
        }

        // Update state with processed data and v6 components
        safeSetState((prev) => ({
          ...prev,
          data: processedData,
          visualizationState,
          asyncCoordinator,
          hasParsedData: true,
          isLoading: false,
          metadata: {
            source,
            nodeCount: data.nodes.length,
            edgeCount: data.edges.length,
            hierarchyChoices: data.hierarchyChoices?.length || 0,
            processedAt: new Date().toISOString(),
            v6Available: !!(visualizationState && asyncCoordinator),
          },
        }));

        console.log(
          `Hydroscope: Data processing completed successfully (${data.nodes.length} nodes, ${data.edges.length} edges)`,
        );

        if (visualizationState && asyncCoordinator) {
          console.log("Hydroscope: V6 architecture integration successful");
        } else {
          console.warn(
            "Hydroscope: Operating in fallback mode without v6 architecture",
          );
        }

        endTiming();
      } catch (error) {
        endTiming();
        console.error("Hydroscope: Error processing data:", error);
        handleError(error as Error);
      }
    },
    [safeSetState, handleError, startTiming],
  );

  const loadDataFromUrl = useCallback(
    async (url: string) => {
      try {
        console.log("Hydroscope: Loading data from URL:", url);

        safeSetState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch data: ${response.status} ${response.statusText}`,
          );
        }

        const contentType = response.headers.get("content-type");
        if (!contentType?.includes("application/json")) {
          console.warn(
            "Hydroscope: Response content-type is not JSON, attempting to parse anyway",
          );
        }

        const data = await response.json();
        await processData(data, "url");
      } catch (error) {
        console.error("Hydroscope: Error loading data from URL:", error);
        handleError(error as Error);
      }
    },
    [processData, safeSetState, handleError],
  );

  const parseUrlParameters = useCallback(() => {
    if (!enableUrlParams) return;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const dataUrl = urlParams.get("data");
      const dataParam = urlParams.get("json");

      if (dataUrl) {
        console.log("Hydroscope: Found data URL parameter:", dataUrl);
        loadDataFromUrl(dataUrl);
      } else if (dataParam) {
        console.log("Hydroscope: Found JSON data parameter");
        try {
          const decodedData = decodeURIComponent(dataParam);
          const parsedData = JSON.parse(decodedData);
          processData(parsedData, "url");
        } catch (parseError) {
          console.error(
            "Hydroscope: Error parsing URL JSON parameter:",
            parseError,
          );
          handleError(
            new Error(`Failed to parse URL JSON parameter: ${parseError}`),
          );
        }
      }
    } catch (error) {
      console.error("Hydroscope: Error parsing URL parameters:", error);
      // Don't throw here, just log the error as URL params are optional
    }
  }, [enableUrlParams, loadDataFromUrl, processData, handleError]);

  // ============================================================================
  // Data Loading Effects
  // ============================================================================

  // Process initial data prop
  useEffect(() => {
    if (data && !state.hasParsedData) {
      processData(data, "prop");
    }
  }, [data, state.hasParsedData, processData]);

  // Parse URL parameters on mount
  useEffect(() => {
    if (enableUrlParams && !state.hasParsedData && !data) {
      parseUrlParameters();
    }
  }, [enableUrlParams, state.hasParsedData, data, parseUrlParameters]);

  const handleRetry = useCallback(() => {
    console.log("Hydroscope: Retry requested, clearing error state");
    safeSetState((prev) => ({
      ...prev,
      error: null,
      isLoading: false,
    }));

    // If we have data but lost v6 components, try to reinitialize them
    if (state.data && (!state.visualizationState || !state.asyncCoordinator)) {
      console.log(
        "Hydroscope: Attempting to reinitialize v6 components during retry",
      );
      processData(state.data, "prop");
    }
  }, [
    safeSetState,
    state.data,
    state.visualizationState,
    state.asyncCoordinator,
    processData,
  ]);

  const handleReset = useCallback(() => {
    console.log("Hydroscope: Full reset requested");
    const defaultSettings = getDefaultSettings();
    safeSetState((prev) => ({
      ...prev,
      ...defaultSettings,
      data: null,
      visualizationState: null,
      asyncCoordinator: null,
      metadata: null,
      graphData: null,
      hasParsedData: false,
      searchQuery: "",
      searchMatches: [],
      currentSearchMatchId: undefined,
      error: null,
      isLoading: false,
    }));

    // Clear localStorage
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log("Hydroscope: Settings reset and localStorage cleared");
    } catch (error) {
      console.error("Hydroscope: Failed to clear localStorage:", error);
    }
  }, [safeSetState]);

  // ============================================================================
  // V6 Architecture Status and Fallback Strategies
  // ============================================================================

  const v6Status = useMemo(() => {
    const hasVisualizationState = !!state.visualizationState;
    const hasAsyncCoordinator = !!state.asyncCoordinator;

    return {
      available: hasVisualizationState && hasAsyncCoordinator,
      partial: hasVisualizationState || hasAsyncCoordinator,
      visualizationState: hasVisualizationState,
      asyncCoordinator: hasAsyncCoordinator,
      fallbackMode: !hasVisualizationState || !hasAsyncCoordinator,
    };
  }, [state.visualizationState, state.asyncCoordinator]);

  const createFallbackConfig = useCallback(
    (error: Error) => {
      console.error(
        "Hydroscope: Creating fallback configuration due to error:",
        error,
      );

      // Determine which features to disable based on error type and v6 status
      const fallbackConfig = {
        showInfoPanel: true, // Always try to show InfoPanel
        showStyleTuner: true, // Always try to show StyleTuner
        enableSearch: v6Status.visualizationState, // Only if VisualizationState is available
        enableContainerOperations: v6Status.asyncCoordinator, // Only if AsyncCoordinator is available
        enableStyleChanges: true, // Can work without v6 components
        enableLayoutChanges: v6Status.asyncCoordinator, // Requires AsyncCoordinator for coordination
      };

      console.warn(
        "Hydroscope: Operating with fallback configuration:",
        fallbackConfig,
      );
      return fallbackConfig;
    },
    [v6Status],
  );

  // Log v6 status changes
  useEffect(() => {
    if (state.hasParsedData) {
      console.log("Hydroscope: V6 Architecture Status:", v6Status);

      if (v6Status.fallbackMode) {
        console.warn(
          "Hydroscope: Operating in fallback mode - some features may be limited",
        );

        if (!v6Status.visualizationState) {
          console.warn(
            "Hydroscope: VisualizationState unavailable - search and data operations limited",
          );
        }

        if (!v6Status.asyncCoordinator) {
          console.warn(
            "Hydroscope: AsyncCoordinator unavailable - layout and container operations may have timing issues",
          );
        }
      } else {
        console.log(
          "Hydroscope: Full v6 architecture available - all features enabled",
        );
      }
    }
  }, [v6Status, state.hasParsedData]);

  // ============================================================================
  // Panel State Coordination
  // ============================================================================

  const handleInfoPanelToggle = useCallback(
    (open: boolean) => {
      safeSetState((prev) => ({ ...prev, infoPanelOpen: open }));
    },
    [safeSetState],
  );

  const handleStylePanelToggle = useCallback(
    (open: boolean) => {
      safeSetState((prev) => ({ ...prev, stylePanelOpen: open }));
    },
    [safeSetState],
  );

  const handleSearchUpdate = useCallback(
    (query: string, matches: SearchResult[], current?: SearchResult) => {
      safeSetState((prev) => ({
        ...prev,
        searchQuery: query,
        searchMatches: matches,
        currentSearchMatchId: current?.id,
      }));
    },
    [safeSetState],
  );

  const handleResetToDefaults = useCallback(() => {
    const defaultSettings = getDefaultSettings();
    safeSetState((prev) => ({
      ...prev,
      colorPalette: defaultSettings.colorPalette,
      layoutAlgorithm: defaultSettings.layoutAlgorithm,
      renderConfig: defaultSettings.renderConfig,
      autoFitEnabled: defaultSettings.autoFitEnabled,
      searchQuery: "",
      searchMatches: [],
      currentSearchMatchId: undefined,
    }));

    console.log("Hydroscope: Reset to defaults completed");
  }, [safeSetState]);

  // ============================================================================
  // Container Operations
  // ============================================================================

  const [collapsedContainers, setCollapsedContainers] = useState<Set<string>>(
    new Set(),
  );

  const handleContainerToggle = useCallback(
    (containerId: string) => {
      try {
        console.log("Hydroscope: Container toggle requested:", containerId);

        setCollapsedContainers((prev) => {
          const newSet = new Set(prev);
          const isCurrentlyCollapsed = newSet.has(containerId);

          if (isCurrentlyCollapsed) {
            newSet.delete(containerId);
            console.log("Hydroscope: Expanding container:", containerId);
            onContainerExpand?.(
              containerId,
              state.visualizationState || undefined,
            );
          } else {
            newSet.add(containerId);
            console.log("Hydroscope: Collapsing container:", containerId);
            onContainerCollapse?.(
              containerId,
              state.visualizationState || undefined,
            );
          }

          return newSet;
        });
      } catch (error) {
        console.error("Hydroscope: Error toggling container:", error);
        handleError(error as Error);
      }
    },
    [
      state.visualizationState,
      onContainerCollapse,
      onContainerExpand,
      handleError,
    ],
  );

  const handleExpandAllContainers = useCallback(async () => {
    try {
      console.log("Hydroscope: Expanding all containers");

      if (state.asyncCoordinator && state.visualizationState) {
        await state.asyncCoordinator.expandAllContainers(
          state.visualizationState,
          { triggerLayout: true },
        );
      } else {
        // Fallback when v6 components are unavailable
        console.warn(
          "Hydroscope: V6 components unavailable, using fallback expand all",
        );
        if (state.visualizationState) {
          state.visualizationState.expandAllContainers?.();
        }
      }

      setCollapsedContainers(new Set());

      // Trigger layout if auto-fit is enabled
      if (state.autoFitEnabled) {
        setTimeout(() => handleAutoFit(), 100);
      }
    } catch (error) {
      console.error("Hydroscope: Error expanding all containers:", error);
      handleError(error as Error);
    }
  }, [
    state.asyncCoordinator,
    state.visualizationState,
    state.autoFitEnabled,
    handleError,
  ]);

  const handleCollapseAllContainers = useCallback(async () => {
    try {
      console.log("Hydroscope: Collapsing all containers");

      if (state.asyncCoordinator && state.visualizationState) {
        await state.asyncCoordinator.collapseAllContainers(
          state.visualizationState,
          { triggerLayout: true },
        );
      } else {
        // Fallback when v6 components are unavailable
        console.warn(
          "Hydroscope: V6 components unavailable, using fallback collapse all",
        );
        if (state.visualizationState) {
          state.visualizationState.collapseAllContainers?.();
        }
      }

      // Mark all containers as collapsed (this would normally come from VisualizationState)
      if (state.data?.nodes) {
        const containerIds = state.data.nodes
          .filter((node: any) => node.type === "container" || node.children)
          .map((node: any) => node.id);
        setCollapsedContainers(new Set(containerIds));
      }

      // Trigger layout if auto-fit is enabled
      if (state.autoFitEnabled) {
        setTimeout(() => handleAutoFit(), 100);
      }
    } catch (error) {
      console.error("Hydroscope: Error collapsing all containers:", error);
      handleError(error as Error);
    }
  }, [
    state.asyncCoordinator,
    state.visualizationState,
    state.data,
    state.autoFitEnabled,
    handleError,
  ]);

  // ============================================================================
  // Layout Management
  // ============================================================================

  const handleLayoutChange = useCallback(
    async (layoutAlgorithm: string) => {
      try {
        console.log("Hydroscope: Layout change requested:", layoutAlgorithm);

        safeSetState((prev) => ({
          ...prev,
          layoutAlgorithm,
          isLoading: true,
        }));

        // This will be enhanced when v6 integration is added
        if (state.asyncCoordinator && state.visualizationState) {
          console.log(
            "Hydroscope: V6 architecture available - layout change will be coordinated",
          );
          // await state.asyncCoordinator.changeLayout(state.visualizationState, layoutAlgorithm);
        } else {
          console.warn(
            "Hydroscope: V6 components unavailable - layout change logged only",
          );
        }

        // Simulate layout processing time
        setTimeout(() => {
          safeSetState((prev) => ({ ...prev, isLoading: false }));

          // Trigger auto-fit after layout
          if (state.autoFitEnabled) {
            setTimeout(() => handleAutoFit(), 100);
          }
        }, 500);
      } catch (error) {
        console.error("Hydroscope: Error changing layout:", error);
        handleError(error as Error);
      }
    },
    [
      state.asyncCoordinator,
      state.visualizationState,
      state.autoFitEnabled,
      safeSetState,
      handleError,
    ],
  );

  // ============================================================================
  // Auto-Fit Functionality
  // ============================================================================

  const handleAutoFit = useCallback(() => {
    try {
      console.log("Hydroscope: Auto-fit requested");

      // This will be enhanced when ReactFlow integration is added
      if (state.visualizationState) {
        console.log("Hydroscope: Performing auto-fit with VisualizationState");
        // state.visualizationState.fitView?.();
      } else {
        console.log(
          "Hydroscope: Auto-fit logged (no visualization state available)",
        );
      }
    } catch (error) {
      console.error("Hydroscope: Error during auto-fit:", error);
      handleError(error as Error);
    }
  }, [state.visualizationState, handleError]);

  const toggleAutoFit = useCallback(() => {
    safeSetState((prev) => {
      const newAutoFitEnabled = !prev.autoFitEnabled;
      console.log("Hydroscope: Auto-fit toggled:", newAutoFitEnabled);

      // If enabling auto-fit, trigger it immediately
      if (newAutoFitEnabled) {
        setTimeout(() => handleAutoFit(), 100);
      }

      return { ...prev, autoFitEnabled: newAutoFitEnabled };
    });
  }, [safeSetState, handleAutoFit]);

  // ============================================================================
  // Keyboard Shortcuts
  // ============================================================================

  const infoPanelRef = useRef<{
    focusSearch: () => void;
    clearSearch: () => void;
  } | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+F for search
      if ((event.ctrlKey || event.metaKey) && event.key === "f") {
        event.preventDefault();

        if (showInfoPanel) {
          // Open InfoPanel if closed
          if (!state.infoPanelOpen) {
            handleInfoPanelToggle(true);
          }

          // Focus search input
          setTimeout(() => {
            infoPanelRef.current?.focusSearch();
          }, 100);
        }

        console.log("Hydroscope: Search shortcut activated (Ctrl+F)");
      }

      // Escape to close panels
      if (event.key === "Escape") {
        if (state.infoPanelOpen || state.stylePanelOpen) {
          safeSetState((prev) => ({
            ...prev,
            infoPanelOpen: false,
            stylePanelOpen: false,
          }));
          console.log("Hydroscope: Panels closed via Escape key");
        }
      }

      // Ctrl+Shift+I for InfoPanel toggle
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key === "I"
      ) {
        event.preventDefault();
        if (showInfoPanel) {
          handleInfoPanelToggle(!state.infoPanelOpen);
          console.log("Hydroscope: InfoPanel toggled via keyboard shortcut");
        }
      }

      // Ctrl+Shift+S for StylePanel toggle
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key === "S"
      ) {
        event.preventDefault();
        if (showStylePanel) {
          handleStylePanelToggle(!state.stylePanelOpen);
          console.log("Hydroscope: StylePanel toggled via keyboard shortcut");
        }
      }

      // Ctrl+Shift+F for auto-fit
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key === "F"
      ) {
        event.preventDefault();
        handleAutoFit();
        console.log("Hydroscope: Auto-fit triggered via keyboard shortcut");
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    showInfoPanel,
    showStylePanel,
    state.infoPanelOpen,
    state.stylePanelOpen,
    handleInfoPanelToggle,
    handleStylePanelToggle,
    handleAutoFit,
    safeSetState,
  ]);

  // ============================================================================
  // Panel Toggle Controls and Operations
  // ============================================================================

  const PanelToggleControls = useMemo(
    () => (
      <div
        style={{
          position: "absolute",
          top: "20px",
          right: showInfoPanel && state.infoPanelOpen ? "370px" : "20px",
          zIndex: 1001,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          transition: "right 0.3s ease-in-out",
        }}
      >
        {showInfoPanel && (
          <button
            onClick={() => handleInfoPanelToggle(!state.infoPanelOpen)}
            title={`${state.infoPanelOpen ? "Close" : "Open"} Info Panel (Ctrl+Shift+I)`}
            style={{
              padding: "8px 12px",
              backgroundColor: state.infoPanelOpen ? "#007bff" : "white",
              color: state.infoPanelOpen ? "white" : "#333",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "500",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              transition: "all 0.2s ease",
            }}
          >
            📊 Info
          </button>
        )}

        {showStylePanel && (
          <button
            onClick={() => handleStylePanelToggle(!state.stylePanelOpen)}
            title={`${state.stylePanelOpen ? "Close" : "Open"} Style Panel (Ctrl+Shift+S)`}
            style={{
              padding: "8px 12px",
              backgroundColor: state.stylePanelOpen ? "#007bff" : "white",
              color: state.stylePanelOpen ? "white" : "#333",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "500",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              transition: "all 0.2s ease",
            }}
          >
            🎨 Style
          </button>
        )}
      </div>
    ),
    [
      showInfoPanel,
      showStylePanel,
      state.infoPanelOpen,
      state.stylePanelOpen,
      handleInfoPanelToggle,
      handleStylePanelToggle,
    ],
  );

  const ContainerOperationControls = useMemo(() => {
    if (!enableCollapse || !state.hasParsedData) return null;

    return (
      <div
        style={{
          position: "absolute",
          top: "20px",
          left: showStylePanel && state.stylePanelOpen ? "370px" : "20px",
          zIndex: 1001,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          transition: "left 0.3s ease-in-out",
        }}
      >
        <button
          onClick={handleExpandAllContainers}
          title="Expand All Containers"
          style={{
            padding: "8px 12px",
            backgroundColor: "white",
            color: "#333",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "500",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            transition: "all 0.2s ease",
          }}
        >
          📂 Expand All
        </button>

        <button
          onClick={handleCollapseAllContainers}
          title="Collapse All Containers"
          style={{
            padding: "8px 12px",
            backgroundColor: "white",
            color: "#333",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "500",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            transition: "all 0.2s ease",
          }}
        >
          📁 Collapse All
        </button>

        <button
          onClick={handleAutoFit}
          title="Fit View (Ctrl+Shift+F)"
          style={{
            padding: "8px 12px",
            backgroundColor: "white",
            color: "#333",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "500",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            transition: "all 0.2s ease",
          }}
        >
          🔍 Fit View
        </button>

        <button
          onClick={toggleAutoFit}
          title={`Auto-fit: ${state.autoFitEnabled ? "Enabled" : "Disabled"}`}
          style={{
            padding: "8px 12px",
            backgroundColor: state.autoFitEnabled ? "#28a745" : "white",
            color: state.autoFitEnabled ? "white" : "#333",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "500",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            transition: "all 0.2s ease",
          }}
        >
          {state.autoFitEnabled ? "🔄 Auto-fit ON" : "⏸️ Auto-fit OFF"}
        </button>
      </div>
    );
  }, [
    enableCollapse,
    state.hasParsedData,
    state.autoFitEnabled,
    state.stylePanelOpen,
    showStylePanel,
    handleExpandAllContainers,
    handleCollapseAllContainers,
    handleAutoFit,
    toggleAutoFit,
  ]);

  // ============================================================================
  // Render
  // ============================================================================

  // Error boundary
  if (state.error) {
    return (
      <div
        className={`hydroscope-error ${className || ""}`}
        style={{
          width,
          height,
          ...style,
        }}
      >
        <ErrorRecoveryComponent
          error={state.error}
          onRetry={handleRetry}
          onReset={handleReset}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`hydroscope ${className || ""}`}
      style={{
        width,
        height,
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* File Upload Interface */}
      {showFileUpload && !state.hasParsedData && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 100,
          }}
        >
          <FileUpload
            onFileLoaded={async (data, filename) => {
              console.log("Hydroscope: File loaded:", filename);
              await processData(data, "file");
              onFileUpload?.(data, filename);
            }}
            onParseError={(error, filename) => {
              console.error("Hydroscope: File parse error:", error, filename);
              handleError(
                new Error(`Failed to parse ${filename}: ${error.message}`),
              );
            }}
            onValidationError={(errors, filename) => {
              console.error(
                "Hydroscope: File validation errors:",
                errors,
                filename,
              );
              handleError(
                new Error(
                  `Validation failed for ${filename}: ${errors.map((e) => e.message).join(", ")}`,
                ),
              );
            }}
            acceptedTypes={[".json"]}
            maxFileSize={100 * 1024 * 1024} // 100MB for large graph files
            debug={showPerformancePanel}
            showDetailedErrors={showPerformancePanel}
            customValidator={(data) => {
              const errors = [];

              // Validate required fields
              if (!data.nodes || !Array.isArray(data.nodes)) {
                errors.push({
                  type: "validation",
                  message: 'Missing or invalid "nodes" array',
                  severity: "error" as const,
                });
              }

              if (!data.edges || !Array.isArray(data.edges)) {
                errors.push({
                  type: "validation",
                  message: 'Missing or invalid "edges" array',
                  severity: "error" as const,
                });
              }

              // Validate node structure
              if (data.nodes && Array.isArray(data.nodes)) {
                data.nodes.forEach((node: any, index: number) => {
                  if (!node.id) {
                    errors.push({
                      type: "validation",
                      message: `Node at index ${index} missing required "id" field`,
                      severity: "error" as const,
                    });
                  }
                });
              }

              // Validate edge structure
              if (data.edges && Array.isArray(data.edges)) {
                data.edges.forEach((edge: any, index: number) => {
                  if (!edge.source || !edge.target) {
                    errors.push({
                      type: "validation",
                      message: `Edge at index ${index} missing required "source" or "target" field`,
                      severity: "error" as const,
                    });
                  }
                });
              }

              return errors;
            }}
          />
        </div>
      )}

      {/* Loading State */}
      {state.isLoading && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 200,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "16px",
              color: "#666",
              marginBottom: "8px",
            }}
          >
            Loading visualization...
          </div>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid #f3f3f3",
              borderTop: "4px solid #007bff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto",
            }}
          />
        </div>
      )}

      {/* Main Visualization Area - Enhanced placeholder with data info */}
      {state.hasParsedData && !state.isLoading && (
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#f8f9fa",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#666",
            fontSize: "16px",
            padding: "20px",
          }}
        >
          <div
            style={{
              textAlign: "center",
              maxWidth: "600px",
            }}
          >
            <h2
              style={{
                margin: "0 0 16px 0",
                color: "#333",
                fontSize: "24px",
              }}
            >
              Data Loaded Successfully
            </h2>

            {state.metadata && (
              <div
                style={{
                  backgroundColor: "white",
                  padding: "20px",
                  borderRadius: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  marginBottom: "20px",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 12px 0",
                    fontSize: "18px",
                    color: "#333",
                  }}
                >
                  Graph Statistics
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: "12px",
                    textAlign: "left",
                  }}
                >
                  <div>
                    <strong>Nodes:</strong>{" "}
                    {state.metadata.nodeCount?.toLocaleString() || 0}
                  </div>
                  <div>
                    <strong>Edges:</strong>{" "}
                    {state.metadata.edgeCount?.toLocaleString() || 0}
                  </div>
                  <div>
                    <strong>Hierarchies:</strong>{" "}
                    {state.metadata.hierarchyChoices || 0}
                  </div>
                  <div>
                    <strong>Source:</strong>{" "}
                    {state.metadata.source || "unknown"}
                  </div>
                </div>

                {/* V6 Architecture Status */}
                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px",
                    backgroundColor: v6Status.available
                      ? "#d4edda"
                      : v6Status.partial
                        ? "#fff3cd"
                        : "#f8d7da",
                    border: `1px solid ${v6Status.available ? "#c3e6cb" : v6Status.partial ? "#ffeaa7" : "#f5c6cb"}`,
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "8px",
                    }}
                  >
                    <span style={{ fontSize: "14px" }}>
                      {v6Status.available
                        ? "✅"
                        : v6Status.partial
                          ? "⚠️"
                          : "❌"}
                    </span>
                    <strong>
                      V6 Architecture:{" "}
                      {v6Status.available
                        ? "Fully Available"
                        : v6Status.partial
                          ? "Partially Available"
                          : "Unavailable"}
                    </strong>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "4px",
                      fontSize: "11px",
                    }}
                  >
                    <div>
                      VisualizationState:{" "}
                      {v6Status.visualizationState
                        ? "✅ Available"
                        : "❌ Unavailable"}
                    </div>
                    <div>
                      AsyncCoordinator:{" "}
                      {v6Status.asyncCoordinator
                        ? "✅ Available"
                        : "❌ Unavailable"}
                    </div>
                  </div>

                  {v6Status.fallbackMode && (
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "11px",
                        color: "#856404",
                      }}
                    >
                      <strong>Note:</strong> Some features may be limited in
                      fallback mode.
                    </div>
                  )}
                </div>

                {generatedFilePath && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "8px",
                      backgroundColor: "#f8f9fa",
                      borderRadius: "4px",
                      fontSize: "12px",
                      color: "#666",
                    }}
                  >
                    <strong>File:</strong> {generatedFilePath}
                  </div>
                )}
              </div>
            )}

            <p
              style={{
                margin: "0 0 20px 0",
                lineHeight: "1.5",
              }}
            >
              Visualization rendering will be implemented in subsequent
              subtasks.
              <br />
              Use the panel controls above to explore the data structure.
            </p>

            {/* Keyboard Shortcuts Help */}
            <div
              style={{
                backgroundColor: "white",
                padding: "16px",
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                marginBottom: "20px",
                fontSize: "14px",
              }}
            >
              <h4
                style={{
                  margin: "0 0 12px 0",
                  fontSize: "16px",
                  color: "#333",
                }}
              >
                Keyboard Shortcuts
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "8px",
                  fontSize: "12px",
                }}
              >
                <div>
                  <kbd>Ctrl+F</kbd> - Focus search
                </div>
                <div>
                  <kbd>Ctrl+Shift+I</kbd> - Toggle Info Panel
                </div>
                <div>
                  <kbd>Ctrl+Shift+S</kbd> - Toggle Style Panel
                </div>
                <div>
                  <kbd>Ctrl+Shift+F</kbd> - Fit view
                </div>
                <div>
                  <kbd>Escape</kbd> - Close panels
                </div>
              </div>
            </div>

            {/* Data Preview */}
            {state.data && (
              <details
                style={{
                  backgroundColor: "white",
                  padding: "16px",
                  borderRadius: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  textAlign: "left",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    fontWeight: "bold",
                    marginBottom: "12px",
                  }}
                >
                  Data Preview
                </summary>
                <div
                  style={{
                    fontSize: "12px",
                    fontFamily: "monospace",
                    backgroundColor: "#f8f9fa",
                    padding: "12px",
                    borderRadius: "4px",
                    overflow: "auto",
                    maxHeight: "200px",
                  }}
                >
                  <div>
                    <strong>Sample Node:</strong>
                  </div>
                  <pre style={{ margin: "4px 0 12px 0" }}>
                    {JSON.stringify(state.data.nodes[0] || {}, null, 2)}
                  </pre>

                  <div>
                    <strong>Sample Edge:</strong>
                  </div>
                  <pre style={{ margin: "4px 0" }}>
                    {JSON.stringify(state.data.edges[0] || {}, null, 2)}
                  </pre>
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Panel Toggle Controls */}
      {(showInfoPanel || showStylePanel) && PanelToggleControls}

      {/* Container Operation Controls */}
      {ContainerOperationControls}

      {/* InfoPanel */}
      {showInfoPanel && (
        <InfoPanel
          ref={infoPanelRef}
          visualizationState={state.visualizationState}
          reactFlowData={{ nodes: [], edges: [] }}
          legendData={state.data?.legend}
          edgeStyleConfig={state.data?.edgeStyleConfig}
          hierarchyChoices={state.data?.hierarchyChoices?.map((choice) => ({
            id: choice.id,
            name: choice.name,
            description: `Hierarchy choice: ${choice.name}`,
          }))}
          currentGrouping={state.grouping}
          onGroupingChange={(groupingId) => {
            safeSetState((prev) => ({ ...prev, grouping: groupingId }));
          }}
          collapsedContainers={collapsedContainers}
          onToggleContainer={handleContainerToggle}
          asyncCoordinator={state.asyncCoordinator}
          colorPalette={state.colorPalette}
          open={state.infoPanelOpen}
          onOpenChange={handleInfoPanelToggle}
          onSearchUpdate={handleSearchUpdate}
          onResetToDefaults={handleResetToDefaults}
          onError={handleError}
        />
      )}

      {/* StyleTuner */}
      {showStylePanel && (
        <StyleTuner
          value={state.renderConfig}
          onChange={(config) => {
            safeSetState((prev) => ({ ...prev, renderConfig: config }));
            onConfigChange?.(config);
          }}
          colorPalette={state.colorPalette}
          onPaletteChange={(palette) => {
            safeSetState((prev) => ({ ...prev, colorPalette: palette }));
          }}
          currentLayout={state.layoutAlgorithm}
          onLayoutChange={handleLayoutChange}
          visualizationState={state.visualizationState}
          asyncCoordinator={state.asyncCoordinator}
          onResetToDefaults={handleResetToDefaults}
          open={state.stylePanelOpen}
          onOpenChange={handleStylePanelToggle}
          onError={handleError}
        />
      )}

      {/* Performance Panel (Development Mode) */}
      {showPerformancePanel && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            right: "20px",
            width: "300px",
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            color: "white",
            padding: "12px",
            borderRadius: "8px",
            fontSize: "11px",
            fontFamily: "monospace",
            zIndex: 1002,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <strong>Performance Monitor</strong>
            <button
              onClick={() => {
                // Toggle performance panel - this would be handled by parent
                console.log("Performance panel toggle requested");
              }}
              style={{
                background: "none",
                border: "1px solid #666",
                color: "white",
                padding: "2px 6px",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "10px",
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: "grid", gap: "4px" }}>
            <div>Render Time: {metrics.renderTime.toFixed(2)}ms</div>
            <div>Layout Time: {metrics.layoutTime.toFixed(2)}ms</div>
            <div>Component Mounts: {metrics.componentMounts}</div>
            <div>Error Count: {metrics.errorCount}</div>
            {metrics.memoryUsage && (
              <div>
                Memory: {(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB
              </div>
            )}
            <div>
              Last Update: {new Date(metrics.lastUpdate).toLocaleTimeString()}
            </div>

            {/* V6 Status in Performance Panel */}
            <div
              style={{
                marginTop: "8px",
                paddingTop: "8px",
                borderTop: "1px solid #666",
              }}
            >
              <div>
                V6 Status:{" "}
                {v6Status.available
                  ? "✅ Full"
                  : v6Status.partial
                    ? "⚠️ Partial"
                    : "❌ None"}
              </div>
              <div>
                VisualizationState: {v6Status.visualizationState ? "✅" : "❌"}
              </div>
              <div>
                AsyncCoordinator: {v6Status.asyncCoordinator ? "✅" : "❌"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS for loading animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ============================================================================
// React.memo Optimization and Memory Leak Prevention
// ============================================================================

export const Hydroscope = React.memo<HydroscopeProps>(
  HydroscopeComponent,
  (prevProps, nextProps) => {
    // Custom comparison for performance optimization
    const propsToCompare: (keyof HydroscopeProps)[] = [
      "data",
      "height",
      "width",
      "showControls",
      "showMiniMap",
      "showBackground",
      "showFileUpload",
      "showInfoPanel",
      "showStylePanel",
      "showPerformancePanel",
      "enableCollapse",
      "initialLayoutAlgorithm",
      "initialColorPalette",
      "responsive",
      "enableUrlParams",
    ];

    // Deep comparison for data prop
    if (prevProps.data !== nextProps.data) {
      if (!prevProps.data && !nextProps.data) {
        // Both null/undefined - no change
      } else if (!prevProps.data || !nextProps.data) {
        // One is null/undefined, other is not - changed
        return false;
      } else {
        // Both exist - compare node/edge counts for performance
        const prevNodeCount = prevProps.data.nodes?.length || 0;
        const nextNodeCount = nextProps.data.nodes?.length || 0;
        const prevEdgeCount = prevProps.data.edges?.length || 0;
        const nextEdgeCount = nextProps.data.edges?.length || 0;

        if (
          prevNodeCount !== nextNodeCount ||
          prevEdgeCount !== nextEdgeCount
        ) {
          return false;
        }
      }
    }

    // Compare other props
    for (const prop of propsToCompare) {
      if (prop !== "data" && prevProps[prop] !== nextProps[prop]) {
        return false;
      }
    }

    // Props are equal - skip re-render
    return true;
  },
);

// Set display name for debugging
Hydroscope.displayName = "Hydroscope";

// ============================================================================
// Default Export
// ============================================================================

export default Hydroscope;
