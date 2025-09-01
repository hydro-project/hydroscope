/**
 * @fileoverview Components exports for the hydroscope system
 * 
 * Three-Tier API:
 * 1. Hydroscope - Basic graph rendering (read-only)
 * 2. HydroscopeMini - Interactive with container collapse/expand + basic controls
 * 3. HydroscopeFull - Complete /vis experience with full UI
 * 
 * Plus DIY Toolkit - Individual components for custom layouts
 */

// === THREE-TIER API ===

// Tier 1: Basic (read-only)
export { Hydroscope } from './Hydroscope';
export type { HydroscopeProps, HydroscopeRef } from './Hydroscope';

// Tier 2: Interactive (with built-in container interaction)
export { HydroscopeMini } from './HydroscopeMini';
export type { HydroscopeMiniProps } from './HydroscopeMini';

// Tier 3: Full-featured (complete /vis experience)

// === DIY TOOLKIT ===

// File handling
export { FileDropZone } from './FileDropZone';

// Layout and interaction controls
export { GroupingControls } from './GroupingControls';

// Style and theming
export { StyleTunerPanel } from './StyleTunerPanel';

// Information and metadata display
export { InfoPanel } from './InfoPanel';
export { Legend } from './Legend';
export { HierarchyTree } from './HierarchyTree';

// UI building blocks
export { CollapsibleSection } from './CollapsibleSection';

// Edge styling
export { EdgeStyleLegend } from './EdgeStyleLegend';

// Panel positioning
export { PANEL_POSITIONS } from './types';

// === TYPES ===

// Component prop types
export type {
  InfoPanelProps,
  LegendProps,
  HierarchyTreeProps,
  CollapsibleSectionProps,
  DockablePanelProps,
  HierarchyTreeNode,
  LegendData,
  LegendItem,
  GroupingOption,
  PanelPosition,
  BaseComponentProps
} from './types';

export type { StyleTunerPanelProps } from './StyleTunerPanel';

// === UTILITY FUNCTIONS ===

// Default data generators
export function createDefaultLegendData() {
  return {
    title: "Node Types",
    items: [
      { type: "Source", label: "Source", description: "Data input nodes" },
      { type: "Transform", label: "Transform", description: "Data transformation nodes" },
      { type: "Sink", label: "Sink", description: "Data output nodes" },
      { type: "Network", label: "Network", description: "Network communication nodes" },
      { type: "Aggregation", label: "Aggregation", description: "Data aggregation nodes" },
      { type: "Join", label: "Join", description: "Data joining nodes" },
      { type: "Tee", label: "Tee", description: "Data splitting nodes" }
    ]
  };
}

// Container interaction helpers
export function createContainerClickHandler(
  visualizationState: any,
  refreshLayout: () => Promise<void>,
  options: {
    enableCollapse?: boolean;
    autoFit?: boolean;
    onExpand?: (containerId: string) => void;
    onCollapse?: (containerId: string) => void;
  } = {}
) {
  const { enableCollapse = true, autoFit = true, onExpand, onCollapse } = options;
  
  return async (event: any, node: any) => {
    if (!enableCollapse) return;
    
    const container = visualizationState.getContainer(node.id);
    if (container) {
      if (container.collapsed) {
        visualizationState.expandContainer(node.id);
        onExpand?.(node.id);
      } else {
        visualizationState.collapseContainer(node.id);
        onCollapse?.(node.id);
      }
      
      await refreshLayout();
    }
  };
}

// Layout configuration helpers
export function createLayoutConfig(algorithm: string = 'mrtree') {
  return {
    algorithm,
    // Add other common layout options
  };
}

// Color palette options
export const COLOR_PALETTES = [
  'Set1', 'Set2', 'Set3', 'Pastel1', 'Pastel2', 'Dark2', 
  'Accent', 'Spectral', 'RdYlBu', 'RdYlGn', 'Viridis'
];

// Layout algorithm options  
export const LAYOUT_ALGORITHMS = [
  'mrtree', 'elkLayered', 'elkForce', 'stress', 'random'
];
