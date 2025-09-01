/**
 * @fileoverview Hydroscope public API - Three-Tier Architecture
 * 
 * TIER 1: Hydroscope (Basic)
 * - Minimal, read-only graph rendering
 * - Just pass data, get visualization
 * 
 * TIER 2: HydroscopeMini (Interactive)  
 * - Built-in container collapse/expand on click
 * - Pack/Unpack all controls
 * - Zero configuration required
 * 
 * TIER 3: HydroscopeFull (Complete)
 * - Full /vis experience with all UI panels
 * - File upload, layout controls, style tuning
 * - Complete graph exploration environment
 * 
 * DIY TOOLKIT: Individual components for custom layouts
 */

// Import CSS to be bundled
import './style.css';

// === THREE-TIER API ===

// Tier 1: Basic (read-only)
export { Hydroscope } from './components/Hydroscope';
export type { HydroscopeProps, HydroscopeRef } from './components/Hydroscope';

// Tier 2: Interactive (built-in container interaction)
export { HydroscopeMini } from './components/HydroscopeMini';
export type { HydroscopeMiniProps } from './components/HydroscopeMini';


// === DIY TOOLKIT ===

// Re-export everything from components for DIY construction
export * from './components';
export { FileDropZone } from './components/FileDropZone';
export { FlowGraph } from './render/FlowGraph';

// === CORE UTILITIES ===

// Core types
export type { VisualizationState } from './core/VisualizationState';
export type { RenderConfig, LayoutConfig, FlowGraphEventHandlers } from './core/types';

// JSON parsing
export { parseGraphJSON, createRenderConfig } from './core/JSONParser';

// Data utilities
export { decompressData, parseDataFromUrl } from './utils/compression';

// Example data generation and schema versioning
export { generateCompleteExample, SCHEMA_VERSION, LAST_UPDATED } from './docs/generateJSONSchema';

// Engine (for programmatic layout/render orchestration)
export { VisualizationEngine, createVisualizationEngine } from './core/VisualizationEngine';

// === VERSION ===

export const VERSION = '1.0.0-alpha.1' as const;

// === USAGE EXAMPLES ===

/**
 * TIER 1 - Basic Usage:
 * 
 * import { Hydroscope } from 'hydroscope';
 * 
 * <Hydroscope data={graphJSON} />
 * 
 * 
 * TIER 2 - Interactive Usage:
 * 
 * import { HydroscopeMini } from 'hydroscope';
 * 
 * <HydroscopeMini 
 *   data={graphJSON}
 *   showControls={true}
 *   enableCollapse={true}
 * />
 * 
 * 
 * TIER 3 - Full-Featured Usage:
 * 
 * import { HydroscopeFull } from 'hydroscope';
 * 
 * <HydroscopeFull 
 *   data={graphJSON}
 *   showFileUpload={true}
 *   showInfoPanel={true}
 *   onFileUpload={(data, filename) => console.log('Uploaded:', filename)}
 * />
 * 
 * 
 * DIY TOOLKIT - Custom Layout:
 * 
 * import { 
 *   Hydroscope, 
 *   LayoutControls, 
 *   StyleTunerPanel, 
 *   InfoPanel,
 *   createContainerClickHandler 
 * } from 'hydroscope';
 * 
 * function CustomVisualizer() {
 *   return (
 *     <div style={{ display: 'flex' }}>
 *       <Hydroscope 
 *         data={data} 
 *         eventHandlers={{ onNodeClick: createContainerClickHandler(...) }}
 *       />
 *       <div>
 *         <LayoutControls ... />
 *         <StyleTunerPanel ... />
 *         <InfoPanel ... />
 *       </div>
 *     </div>
 *   );
 * }
 */
