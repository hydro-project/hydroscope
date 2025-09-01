/**
 * JSON Parser for Graph Data
 *
 * Framework-independent JSON parser that converts graph data into a VisualizationState.
 * Handles nodes, edges, hierarchies, grouping assignments and styling based on semantic tags.
 */

import { createVisualizationState, VisualizationState } from './VisualizationState';
import { NODE_STYLES, EDGE_STYLES, NodeStyle, EdgeStyle } from '../shared/config';
import type { RenderConfig } from './types';

// ============ Type Definitions ============

export interface GroupingOption {
  id: string;
  name: string;
}

export interface ParseResult {
  state: VisualizationState;
  metadata: {
    selectedGrouping: string | null;
    nodeCount: number;
    edgeCount: number;
    containerCount: number;
    availableGroupings: GroupingOption[];
    edgeStyleConfig?: {
      // Semantics-only fields surfaced by the parser (sanitized):
      // - propertyMappings: property -> styleTag or { styleTag }
      // - singlePropertyMappings: property -> styleTag
      // - booleanPropertyPairs: pairs with semantic tags (no raw styles)
      // - combinationRules: metadata only
      propertyMappings?: Record<string, string | { styleTag: string }>;
    };
    nodeTypeConfig?: {
      defaultType?: string;
      types?: Array<{
        id: string;
        label: string;
        colorIndex: number;
      }>;
    };
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  nodeCount: number;
  edgeCount: number;
  hierarchyCount: number;
}

export interface ParserOptions {
  validateData?: boolean;
  strictMode?: boolean;
  defaultNodeStyle?: NodeStyle;
  defaultEdgeStyle?: EdgeStyle;
}

// Raw JSON data interfaces (from legacy format)
interface RawNode {
  id: string;
  semanticTags?: string[];
  shortLabel?: string;
  fullLabel?: string;
  label?: string;
  type?: string;
  [key: string]: unknown;
}

interface RawEdge {
  id: string;
  source: string;
  target: string;
  semanticTags?: string[];
  label?: string;
  type?: string;
  // edgeProperties?: string[]; // Removed for uniformity
  [key: string]: unknown;
}

interface RawHierarchyChoice {
  id: string;
  name: string;
  children?: RawHierarchyItem[]; // Direct children, no wrapper
}

interface RawHierarchyItem {
  id: string;
  name: string;
  children?: RawHierarchyItem[];
}

interface EdgeStylePropertyMapping {
  styleTag: string;
}

interface EdgeStyleBooleanPair {
  pair: [string, string];
  defaultStyle: string; // styleTag
  altStyle: string; // styleTag
  description?: string;
  [key: string]: unknown;
}

interface EdgeStyleConfig {
  propertyMappings?: Record<string, string | EdgeStylePropertyMapping>;
  booleanPropertyPairs?: EdgeStyleBooleanPair[];
  [key: string]: unknown;
}

export interface RawGraphData {
  nodes: RawNode[];
  edges: RawEdge[];
  hierarchyChoices?: RawHierarchyChoice[];
  nodeAssignments?: Record<string, Record<string, string>>;
  edgeStyleConfig?: EdgeStyleConfig;
  nodeTypeConfig?: {
    defaultType?: string;
    types?: Array<{
      id: string;
      label: string;
      colorIndex: number;
    }>;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Parse graph JSON and populate a VisualizationState
 *
 * @param jsonData - Raw graph data or JSON string
 * @param grouping - Optional hierarchy grouping to apply
 * @returns Object containing the populated state and parsing metadata
 *
 * @example
 * ```javascript
 * const { state, metadata } = parseGraphJSON(graphData, 'myGrouping');
 * // // console.log('Parsed', metadata.nodeCount, 'nodes');
 */

/**
 * Sanitize edge style config to only allow semantic configurations
 * This prevents raw style objects from being passed through and ensures
 * only semantic mapping configurations are used
 */
function sanitizeEdgeStyleConfig(edgeStyleConfig: EdgeStyleConfig | undefined): EdgeStyleConfig | undefined {
  if (!edgeStyleConfig) return undefined;

  // Only allow semantic mapping properties, filter out raw style configurations
  const sanitized: EdgeStyleConfig = {};

  if (edgeStyleConfig.semanticMappings) {
    sanitized.semanticMappings = edgeStyleConfig.semanticMappings;
  }

  if (edgeStyleConfig.booleanPropertyPairs) {
    sanitized.booleanPropertyPairs = edgeStyleConfig.booleanPropertyPairs;
  }

  if (edgeStyleConfig.combinationRules) {
    sanitized.combinationRules = edgeStyleConfig.combinationRules;
  }

  // Do not include propertyMappings with raw style objects - only allow styleTag references
  if (edgeStyleConfig.propertyMappings) {
    const sanitizedPropertyMappings: Record<string, string | EdgeStylePropertyMapping> = {};
    Object.entries(edgeStyleConfig.propertyMappings).forEach(([key, value]) => {
      if (
        typeof value === 'string' ||
        (typeof value === 'object' && value && 'styleTag' in value)
      ) {
        sanitizedPropertyMappings[key] = value;
      }
    });
    if (Object.keys(sanitizedPropertyMappings).length > 0) {
      sanitized.propertyMappings = sanitizedPropertyMappings;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function parseGraphJSON(
  jsonData: RawGraphData | string,
  selectedGrouping?: string
): ParseResult {
  // Parse JSON if it's a string
  const data: RawGraphData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

  // Validate basic structure
  if (!isValidGraphData(data)) {
    throw new Error('Invalid graph data: missing nodes or edges');
  }

  const state = createVisualizationState();

  // Parse metadata
  const metadata = extractMetadata(data);

  // Determine which grouping to use
  const grouping = selectGrouping(data, selectedGrouping);

  // Parse nodes first (base graph nodes)
  parseNodes(data.nodes, state);

  // Parse edges
  parseEdges(data.edges, state);

  // Parse hierarchy and create containers
  let containerCount = 0;
  if (grouping) {
    containerCount = parseHierarchy(data, grouping, state);
  }

  return {
    state,
    metadata: {
      nodeCount: metadata.nodeCount,
      edgeCount: metadata.edgeCount,
      selectedGrouping: grouping,
      containerCount,
      availableGroupings: getAvailableGroupings(data),
      // Do not pass through raw styleConfig – visuals are controlled by renderer.
      // Only allow semantic edge style config with styleTag/propertyMappings.
      edgeStyleConfig: sanitizeEdgeStyleConfig(data.edgeStyleConfig),
      nodeTypeConfig: metadata.nodeTypeConfig,
    },
  };
}

/**
 * Create a reusable parser instance for processing multiple graph datasets.
 *
 * @param options - Parser configuration options
 * @returns Configured parser instance with parse method
 *
 * @example
 * ```javascript
 * const parser = createGraphParser({
 *   enableValidation: true,
 *   defaultStyle: 'highlighted'
 * });
 *
 * const result1 = parser.parse(data1);
 * const result2 = parser.parse(data2);
 * ```
 */
export function createGraphParser(options: ParserOptions = {}): {
  parse: (data: RawGraphData | string, grouping?: string) => ParseResult;
} {
  const { validateData = true, strictMode = false } = options;

  return {
    parse: (data: RawGraphData | string, grouping?: string): ParseResult => {
      if (validateData) {
        const validation = validateGraphJSON(data);
        if (!validation.isValid) {
          if (strictMode) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
          } else {
            console.warn('Parser validation warnings:', validation.warnings);
          }
        }
      }

      return parseGraphJSON(data, grouping);
    },
  };
} /**
 * Extract available hierarchical groupings from graph JSON data.
 *
 * @param jsonData - Raw graph data or JSON string
 * @returns Array of available grouping options
 *
 * @example
 * ```javascript
 * const groupings = getAvailableGroupings(graphData);
 * // // console.log('Available groupings:', groupings.map(g => g.name));
 * ```
 */
export function getAvailableGroupings(jsonData: RawGraphData | string): GroupingOption[] {
  const data: RawGraphData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
  if (data.hierarchyChoices && Array.isArray(data.hierarchyChoices)) {
    return data.hierarchyChoices.map(choice => ({
      id: choice.id,
      name: choice.name || choice.id,
    }));
  }
  return [];
}

/**
 * Validate Hydro graph JSON data structure and content.
 * Provides detailed validation results including errors and warnings.
 *
 * @param jsonData - The JSON data (object or JSON string)
 * @returns Validation result object
 * @example
 * ```typescript
 * const validation = validateHydroGraphJSON(suspiciousData);
 * if (!validation.isValid) {
 *   console.error('Validation failed:', validation.errors);
 *   return;
 * }
 * if (validation.warnings.length > 0) {
 *   console.warn('Warnings found:', validation.warnings);
 * }
 * ```
 */
export function validateGraphJSON(jsonData: RawGraphData | string): ValidationResult {
  try {
    const data: RawGraphData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check basic structure
    if (!data || typeof data !== 'object') {
      errors.push('Data must be an object');
      return { isValid: false, errors, warnings, nodeCount: 0, edgeCount: 0, hierarchyCount: 0 };
    }

    // 🔥 VALIDATE: JSON must NOT contain mutable state fields
    // These fields represent UI state and should be managed by VisualizationState only
    const forbiddenFields = ['collapsed', 'hidden', 'style'];

    // Check nodes for forbidden fields
    if (Array.isArray(data.nodes)) {
      for (let i = 0; i < data.nodes.length; i++) {
        const node = data.nodes[i];
        if (node) {
          for (const forbiddenField of forbiddenFields) {
            if (forbiddenField in node) {
              errors.push(
                `Node '${node.id || `at index ${i}`}' contains forbidden mutable state field '${forbiddenField}'. JSON should only contain immutable graph structure.`
              );
            }
          }
          // Validate semanticTags if present
          if ('semanticTags' in node && !Array.isArray(node.semanticTags)) {
            errors.push(
              `Node '${node.id || `at index ${i}`}' has invalid semanticTags - must be an array of strings.`
            );
          }
        }
      }
    }

    // Check edges for forbidden fields
    if (Array.isArray(data.edges)) {
      for (let i = 0; i < data.edges.length; i++) {
        const edge = data.edges[i];
        if (edge) {
          for (const forbiddenField of forbiddenFields) {
            if (forbiddenField in edge) {
              errors.push(
                `Edge '${edge.id || `at index ${i}`}' contains forbidden mutable state field '${forbiddenField}'. JSON should only contain immutable graph structure.`
              );
            }
          }
          // Validate semanticTags if present
          if ('semanticTags' in edge && !Array.isArray(edge.semanticTags)) {
            errors.push(
              `Edge '${edge.id || `at index ${i}`}' has invalid semanticTags - must be an array of strings.`
            );
          }
        }
      }
    }

    // Check hierarchyChoices for forbidden fields
    if (data.hierarchyChoices) {
      for (const choice of data.hierarchyChoices) {
        if (choice.children) {
          // Recursively check hierarchy items
          function validateHierarchyItems(items: RawHierarchyItem[], hierarchyId: string): void {
            for (const item of items) {
              for (const forbiddenField of forbiddenFields) {
                if (forbiddenField in item) {
                  errors.push(
                    `Container '${item.id}' in hierarchy '${hierarchyId}' contains forbidden mutable state field '${forbiddenField}'. JSON should only contain immutable graph structure.`
                  );
                }
              }
              if (item.children && Array.isArray(item.children)) {
                validateHierarchyItems(item.children, hierarchyId);
              }
            }
          }
          validateHierarchyItems(choice.children, choice.id);
        }
      }
    }

    // Validate nodes
    if (!Array.isArray(data.nodes)) {
      errors.push('Missing or invalid nodes array');
    } else {
      for (let i = 0; i < data.nodes.length; i++) {
        const node = data.nodes[i];
        if (!node) {
          errors.push(`Node at index ${i} is null or undefined`);
          continue;
        }
        if (!node.id || typeof node.id !== 'string') {
          errors.push(`Node at index ${i} missing or invalid id`);
          continue;
        }
        if (!node.shortLabel || typeof node.shortLabel !== 'string') {
          warnings.push(`Node '${node.id}' missing or invalid shortLabel`);
        }
        if (!node.fullLabel || typeof node.fullLabel !== 'string') {
          warnings.push(`Node '${node.id}' missing or invalid fullLabel`);
        }
      }
    }

    // Validate edges
    if (!Array.isArray(data.edges)) {
      errors.push('Missing or invalid edges array');
    } else {
      const nodeIds = new Set(data.nodes?.map(n => n?.id).filter(Boolean) || []);
      for (let i = 0; i < data.edges.length; i++) {
        const edge = data.edges[i];
        if (!edge) {
          errors.push(`Edge at index ${i} is null or undefined`);
          continue;
        }
        if (!edge.id || typeof edge.id !== 'string') {
          errors.push(`Edge at index ${i} missing or invalid id`);
          continue;
        }
        if (!edge.source || typeof edge.source !== 'string') {
          errors.push(`Edge '${edge.id}' missing or invalid source`);
        } else if (!nodeIds.has(edge.source)) {
          warnings.push(`Edge '${edge.id}' references unknown source node '${edge.source}'`);
        }
        if (!edge.target || typeof edge.target !== 'string') {
          errors.push(`Edge '${edge.id}' missing or invalid target`);
        } else if (!nodeIds.has(edge.target)) {
          warnings.push(`Edge '${edge.id}' references unknown target node '${edge.target}'`);
        }
      }
    }

    // Validate hierarchyChoices (optional)
    let hierarchyCount = 0;
    if (data.hierarchyChoices) {
      if (!Array.isArray(data.hierarchyChoices)) {
        warnings.push('hierarchyChoices should be an array');
      } else {
        hierarchyCount = data.hierarchyChoices.length;
        for (let i = 0; i < data.hierarchyChoices.length; i++) {
          const choice = data.hierarchyChoices[i];
          if (!choice) {
            warnings.push(`Hierarchy choice at index ${i} is null or undefined`);
            continue;
          }
          if (!choice.id || typeof choice.id !== 'string') {
            warnings.push(`Hierarchy choice at index ${i} missing or invalid id`);
            continue;
          }
          if (!choice.children || !Array.isArray(choice.children)) {
            warnings.push(`Hierarchy choice '${choice.id}' missing or invalid children`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      nodeCount: data.nodes?.length || 0,
      edgeCount: data.edges?.length || 0,
      hierarchyCount,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`JSON parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: [],
      nodeCount: 0,
      edgeCount: 0,
      hierarchyCount: 0,
    };
  }
}

// ============ Private Helper Functions ============

/**
 * Type guard to validate that input data has the required structure for graph parsing
 * @param data - Input data to validate
 * @returns true if data has valid graph structure (nodes and edges arrays)
 */
function isValidGraphData(data: unknown): data is RawGraphData {
  return data !== null && typeof data === 'object' && 
         Array.isArray((data as RawGraphData).nodes) && 
         Array.isArray((data as RawGraphData).edges);
}

interface ParseMetadata {
  nodeCount: number;
  edgeCount: number;
  hasHierarchies: boolean;
  nodeTypeConfig: RawGraphData['nodeTypeConfig'];
  nodeTypeItems: Array<{ label: string; type: string }>;
  [key: string]: unknown;
}

function extractMetadata(data: RawGraphData): ParseMetadata {
  return {
    nodeCount: data.nodes.length,
    edgeCount: data.edges.length,
    hasHierarchies: !!(data.hierarchyChoices && data.hierarchyChoices.length > 0),
    nodeTypeConfig: data.nodeTypeConfig,
    nodeTypeItems: data.nodeTypeConfig?.types?.map(t => ({ label: t.label, type: t.id })) || [],
    ...data.metadata,
  };
}

function selectGrouping(
  data: RawGraphData,
  selectedGrouping: string | null | undefined
): string | null {
  if (data.hierarchyChoices && data.hierarchyChoices.length > 0) {
    if (selectedGrouping) {
      const found = data.hierarchyChoices.find(h => h.id === selectedGrouping);
      if (found) return selectedGrouping;
      console.warn(`Grouping '${selectedGrouping}' not found, using first available`);
    }
    return data.hierarchyChoices[0].id;
  }
  return null;
}

function parseNodes(nodes: RawNode[], state: VisualizationState): void {
  for (const rawNode of nodes) {
    try {
      // Extract immutable properties and filter out UI state fields
      const {
        id,
        shortLabel,
        fullLabel,
        nodeType,
        semanticTags,
        position,
        type,
        expanded,
        collapsed,
        hidden,
        style,
        ...safeProps
      } = rawNode;
      // Resolve nodeType with fallbacks: explicit nodeType > legacy 'type' > default
      const resolvedNodeType =
        nodeType ?? (typeof type === 'string' ? type : undefined) ?? 'default';

      state.addGraphNode(id, {
        label: shortLabel || id, // Initial display label (starts with short, can be toggled to full)
        shortLabel: shortLabel || id,
        fullLabel: fullLabel || shortLabel || id,
        style: NODE_STYLES.DEFAULT, // Default style - will be applied by bridge based on semanticTags
        // ✅ All nodes start visible - VisualizationState manages visibility
        hidden: false,
        nodeType: resolvedNodeType,
        semanticTags: semanticTags || [],
        ...safeProps, // Only include non-UI-state properties
      });
    } catch (error) {
      console.warn(`Failed to parse node '${rawNode.id}':`, error);
    }
  }
}

function parseEdges(edges: RawEdge[], state: VisualizationState): void {
  for (const rawEdge of edges) {
    try {
      // Extract immutable properties and filter out UI state fields
      const { id, source, target, semanticTags, style, hidden, animated, ...safeProps } = rawEdge;

      state.addGraphEdge(id, {
        source,
        target,
        style: EDGE_STYLES.DEFAULT, // Default style - will be applied by bridge based on properties
        hidden: false,
        semanticTags: semanticTags || [],
        ...safeProps, // Only include non-UI-state properties
      });
    } catch (error) {
      console.warn(`Failed to parse edge '${rawEdge.id}':`, error);
    }
  }
}

function parseHierarchy(data: RawGraphData, groupingId: string, state: VisualizationState): number {
  let containerCount = 0;
  const hierarchyChoice = data.hierarchyChoices?.find(choice => choice.id === groupingId);
  if (!hierarchyChoice) {
    console.warn(`Hierarchy choice '${groupingId}' not found`);
    return 0;
  }
  if (hierarchyChoice.children) {
    function createContainersFromHierarchy(hierarchyItems: RawHierarchyItem[], parentId?: string): void {
      for (const item of hierarchyItems) {
        const children: string[] = [];
        if (item.children && Array.isArray(item.children)) {
          for (const childItem of item.children) {
            children.push(childItem.id);
          }
        }
        state.addContainer(item.id, {
          label: item.name || item.id,
          children,
          collapsed: false,
        });
        containerCount++;
        if (parentId) {
          const parent = state.getContainer(parentId);
          if (parent) {
            const parentChildren = state.getContainerChildren(parentId);
            if (!parentChildren.has(item.id)) {
              state.addContainer(parentId, {
                ...parent,
                children: [...parentChildren, item.id],
              });
            }
          }
        }
        if (item.children && Array.isArray(item.children)) {
          createContainersFromHierarchy(item.children, item.id);
        }
      }
    }
    createContainersFromHierarchy(hierarchyChoice.children);
    const assignments = data.nodeAssignments?.[groupingId];
    if (assignments) {
      for (const [nodeId, containerId] of Object.entries(assignments)) {
        const container = state.getContainer(containerId);
        if (container && state.getGraphNode(nodeId)) {
          const currentChildren = state.getContainerChildren(containerId);
          if (!currentChildren.has(nodeId)) {
            state.addContainer(containerId, {
              ...container,
              children: [...currentChildren, nodeId],
            });
          }
        }
      }
    }
  }
  return containerCount;
}

/**
 * Create a RenderConfig from a ParseResult
 * Combines metadata from parsing with optional overrides
 */
export function createRenderConfig(
  parseResult: ParseResult,
  overrides: Partial<RenderConfig> = {}
): RenderConfig {
  return {
    // Include edge style config from parsing
    edgeStyleConfig: parseResult.metadata.edgeStyleConfig,
    // Apply any overrides
    ...overrides,
  };
}
