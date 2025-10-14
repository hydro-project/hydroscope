/**
 * Utils Index - Export all utility functions and classes
 */
export {
  JSONParser,
  type JSONParserOptions,
  type ParseResult,
} from "./JSONParser.js";

// Logger utility for conditional logging
export { hscopeLogger, refreshLoggerConfig, type HydroLogCategory } from "./logger.js";
export {
  processSemanticTags,
  validateSemanticMappings,
  VISUAL_CHANNELS,
  DEFAULT_STYLE,
  HALO_COLOR_MAPPINGS,
  type ProcessedStyle,
} from "./StyleProcessor.js";

// Performance Monitoring Utilities
export {
  OperationPerformanceMonitor,
  globalOperationMonitor,
  monitorOperation,
  monitorAsyncOperation,
  recordCoordinatorCall,
  recordDOMUpdate,
  measureOperationPerformance,
  measureAsyncOperationPerformance,
  type OperationType,
  type OperationMetrics,
  type CascadeDetection,
  type OperationMonitoringConfig,
} from "./operationPerformanceMonitor.js";

// Imperative Operation Utilities
export {
  toggleContainerImperatively,
  expandContainerImperatively,
  collapseContainerImperatively,
  batchContainerOperationsImperatively,
  clearContainerOperationDebouncing,
  CONTAINER_OPERATION_PATTERN,
} from "./containerOperationUtils.js";

export {
  togglePanelImperatively,
  expandPanelImperatively,
  collapsePanelImperatively,
  batchPanelOperationsImperatively,
  changeStyleImperatively,
  changeLayoutImperatively,
  changeColorPaletteImperatively,
  changeEdgeStyleImperatively,
  clearPanelOperationDebouncing,
  PANEL_OPERATION_PATTERN,
  type PanelOperation,
  type InfoPanelSection,
  type StyleOperation,
} from "./panelOperationUtils.js";

export {
  changeLayoutImperatively as changeLayoutStyleImperatively,
  changeColorPaletteImperatively as changeColorPaletteStyleImperatively,
  changeEdgeStyleImperatively as changeEdgeStyleStyleImperatively,
  resetStylesImperatively,
  batchStyleOperationsImperatively,
  clearStyleOperationDebouncing,
  STYLE_OPERATION_PATTERN,
  type StyleOperationType,
  type EdgeStyleKind,
  type StyleChangeOptions,
} from "./styleOperationUtils.js";

export {
  clearSearchImperatively,
  clearSearchPanelImperatively,
  SEARCH_CLEAR_PATTERN,
} from "./searchClearUtils.js";

export * from "./testData.js";
