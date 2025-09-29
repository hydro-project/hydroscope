/**
 * Main entry point for Hydroscope Core (React-free)
 *
 * Architectural constraints: React-free core, synchronous processing
 * React components should be in a separate application layer using AsyncCoordinator
 */

export { VisualizationState } from "./core/VisualizationState.js";
export { InteractionHandler } from "./core/InteractionHandler.js";
export { ReactFlowBridge } from "./bridges/ReactFlowBridge.js";
export { ELKBridge } from "./bridges/ELKBridge.js";
export {
  JSONParser,
  type JSONParserOptions,
  type ParseResult,
} from "./utils/JSONParser.js";
export * from "./types/core.js";
export {
  loadPaxosTestData,
  createTestVisualizationState,
} from "./utils/testData.js";

// Docusaurus-compatible React components
export { HydroscopeEnhanced } from "./components/HydroscopeEnhanced.js";
