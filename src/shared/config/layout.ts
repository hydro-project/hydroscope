/**
 * @fileoverview Layout Configuration
 *
 * All layout-related constants including ELK layout options,
 * node/container dimensions, spacing, and positioning.
 */

// ============================================================================
// LAYOUT DIMENSIONS
// ============================================================================

export const LAYOUT_DIMENSIONS = {
  // Node dimensions (fallback values when ELK doesn't provide sizing)
  NODE_WIDTH_DEFAULT: 180,
  NODE_HEIGHT_DEFAULT: 60,
  NODE_WIDTH_CONTAINER: 180, // For collapsed containers
  NODE_HEIGHT_CONTAINER: 100,

  // Container dimensions
  MIN_CONTAINER_WIDTH: 200,
  MIN_CONTAINER_HEIGHT: 150,
  DEFAULT_CONTAINER_PADDING: 20,

  // Container sizing for hierarchical layout
  CHILD_CONTAINER_WIDTH: 200,
  CHILD_CONTAINER_HEIGHT: 120,
  MAX_PARENT_CONTAINER_WIDTH: 500,
  MAX_PARENT_CONTAINER_HEIGHT: 350,
  DEFAULT_PARENT_CONTAINER_WIDTH: 250,
  DEFAULT_PARENT_CONTAINER_HEIGHT: 150,

  // Fallback dimensions
  FALLBACK_CONTAINER_WIDTH: 200,
  FALLBACK_CONTAINER_HEIGHT: 120,
  FALLBACK_CONTAINER_MAX_WIDTH: 250,
  FALLBACK_CONTAINER_MAX_HEIGHT: 150,
} as const;

// ============================================================================
// LAYOUT SPACING
// ============================================================================

export const LAYOUT_SPACING = {
  // Node positioning and spacing
  NODE_NODE: 94, // Node to node spacing
  NODE_EDGE: 13, // Node to edge spacing
  EDGE_EDGE: 13, // Edge to edge spacing
  COMPONENT_TO_COMPONENT: 75, // Component separation
  ROOT_PADDING: 25, // Root container padding
  CONTAINER_PADDING: 75, // Container internal padding

  // Grid layout within containers
  NODE_GRID_PADDING: 8,
  NODE_GRID_WIDTH: 100,
  NODE_GRID_HEIGHT: 40,
  NODE_GRID_COLUMNS: 2,

  // Container grid layout
  CONTAINER_GRID_PADDING: 15,
  CONTAINER_GRID_COLUMNS: 2,

  // Title and label spacing
  NODE_CONTAINER_TITLE_HEIGHT: 30,
  CONTAINER_TITLE_HEIGHT: 30,
  CONTAINER_LABEL_HEIGHT: 32,
  CONTAINER_LABEL_PADDING: 12,
} as const;

// ============================================================================
// ELK LAYOUT CONFIGURATION
// ============================================================================

export const ELK_ALGORITHMS = {
  MRTREE: "mrtree",
  LAYERED: "layered",
  FORCE: "force",
  STRESS: "stress",
} as const;

export type ELKAlgorithm = (typeof ELK_ALGORITHMS)[keyof typeof ELK_ALGORITHMS];

export const DEFAULT_ELK_ALGORITHM = ELK_ALGORITHMS.MRTREE;

export const ELK_LAYOUT_OPTIONS = {
  "elk.algorithm": DEFAULT_ELK_ALGORITHM,
  "elk.direction": "DOWN",
  "elk.spacing.nodeNode": LAYOUT_SPACING.NODE_NODE.toString(),
  "elk.spacing.edgeNode": LAYOUT_SPACING.NODE_EDGE.toString(),
  "elk.spacing.edgeEdge": LAYOUT_SPACING.EDGE_EDGE.toString(),
  "elk.spacing.componentComponent":
    LAYOUT_SPACING.COMPONENT_TO_COMPONENT.toString(),
  "elk.layered.spacing.nodeNodeBetweenLayers": "94",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.nodeSize.options": "DEFAULT_MINIMUM_SIZE",
} as const;

// ============================================================================
// LAYOUT UTILITIES
// ============================================================================

export function getELKLayoutOptions(algorithm: string = DEFAULT_ELK_ALGORITHM) {
  const allowed: Record<string, ELKAlgorithm> = {
    [ELK_ALGORITHMS.MRTREE]: ELK_ALGORITHMS.MRTREE,
    [ELK_ALGORITHMS.LAYERED]: ELK_ALGORITHMS.LAYERED,
    [ELK_ALGORITHMS.FORCE]: ELK_ALGORITHMS.FORCE,
    [ELK_ALGORITHMS.STRESS]: ELK_ALGORITHMS.STRESS,
  } as const;

  const normalized = allowed[algorithm] ?? DEFAULT_ELK_ALGORITHM;

  return {
    ...ELK_LAYOUT_OPTIONS,
    "elk.algorithm": normalized,
    "elk.hierarchyHandling": "INCLUDE_CHILDREN",
    "elk.json.shapeCoords": "ROOT",
    "elk.json.edgeCoords": "ROOT",
  };
}

export function createFixedPositionOptions(x?: number, y?: number) {
  const options = {
    ...ELK_LAYOUT_OPTIONS,
    "elk.position": "FIXED",
    "elk.nodeSize.constraints": "",
    "elk.nodeSize.options": "DEFAULT_MINIMUM_SIZE",
    "elk.interactive": "true",
  };

  if (x !== undefined && y !== undefined) {
    return {
      ...options,
      "elk.position.x": x.toString(),
      "elk.position.y": y.toString(),
    };
  }

  return options;
}

export function createFreePositionOptions() {
  return {
    ...ELK_LAYOUT_OPTIONS,
    "elk.position": "FREE",
  };
}

// ============================================================================
// DEFAULT LAYOUT CONFIG
// ============================================================================

export const DEFAULT_LAYOUT_CONFIG = {
  algorithm: DEFAULT_ELK_ALGORITHM,
  direction: "DOWN",
  enableSmartCollapse: true,
  spacing: 100,
  nodeSize: {
    width: LAYOUT_DIMENSIONS.NODE_WIDTH_CONTAINER,
    height: LAYOUT_DIMENSIONS.NODE_HEIGHT_DEFAULT,
  },
} as const;

// ============================================================================
// RENDER CONFIG
// ============================================================================

export const DEFAULT_RENDER_CONFIG = {
  enableMiniMap: true,
  enableControls: true,
  fitView: true,
  nodesDraggable: true,
  snapToGrid: false,
  gridSize: 20,
  nodesConnectable: false,
  elementsSelectable: true,
  enableZoom: true,
  enablePan: true,
  enableSelection: true,

  // Visual style defaults
  edgeStyle: "smoothstep", // 'bezier' | 'straight' | 'smoothstep'
  edgeColor: "#1976d2",
  edgeWidth: 2,
  edgeDashed: false,
  nodeBorderRadius: 4,
  nodePadding: 8,
  nodeFontSize: 12,
  containerBorderRadius: 8,
  containerBorderWidth: 2,
  containerShadow: "LIGHT", // 'LIGHT' | 'MEDIUM' | 'LARGE' | 'NONE'
} as const;

// ============================================================================
// SMART COLLAPSE CONFIGURATION
// ============================================================================

export const SMART_COLLAPSE_CONFIG = {
  // Thresholds for determining when to collapse containers
  LARGE_CONTAINER_WIDTH_THRESHOLD: LAYOUT_DIMENSIONS.MIN_CONTAINER_WIDTH * 1.5, // 300
  LARGE_CONTAINER_HEIGHT_THRESHOLD:
    LAYOUT_DIMENSIONS.MIN_CONTAINER_HEIGHT +
    LAYOUT_SPACING.CONTAINER_LABEL_HEIGHT, // 182
  LARGE_CONTAINER_CHILD_COUNT_THRESHOLD: 7,
  SMART_COLLAPSE_BUDGET: 50000,

  // Validation thresholds
  MAX_HYPEREDGE_WARNINGS: 10,
  EDGE_DISTANCE_WARNING_THRESHOLD: 5000, // pixels
  SUPPRESS_EDGE_VALIDATION_NODE_THRESHOLD: 20,
} as const;
