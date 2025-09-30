/**
 * JSONParser - Converts JSON data to VisualizationState
 * Handles paxos.json format with hierarchyChoices and nodeAssignments
 */

import { VisualizationState } from "../core/VisualizationState.js";
import type {
  HydroscopeData,
  HierarchyChoice,
  GraphNode,
  GraphEdge,
  Container,
  ParseError,
  ValidationResult,
} from "../types/core.js";

export interface JSONParserOptions {
  /** Default hierarchy choice to use for grouping */
  defaultHierarchyChoice?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom node transformation function */
  nodeTransformer?: (rawNode: any) => Partial<GraphNode>;
  /** Custom edge transformation function */
  edgeTransformer?: (rawEdge: any) => Partial<GraphEdge>;
  /** Validate data during parsing */
  validateDuringParsing?: boolean;
}

export interface ParseResult {
  visualizationState: VisualizationState;
  hierarchyChoices: HierarchyChoice[];
  selectedHierarchy: string | null;
  edgeStyleConfig?: any; // Edge style configuration from JSON
  nodeTypeConfig?: any; // Node type configuration from JSON
  warnings: ValidationResult[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    containerCount: number;
    processingTime: number;
  };
}

export class JSONParser {
  private options: Required<JSONParserOptions>;
  private debug: boolean;

  constructor(options: JSONParserOptions = {}) {
    this.options = {
      defaultHierarchyChoice: options.defaultHierarchyChoice || "location",
      debug: options.debug || false,
      nodeTransformer: options.nodeTransformer || ((node) => node),
      edgeTransformer: options.edgeTransformer || ((edge) => edge),
      validateDuringParsing: options.validateDuringParsing !== false,
    };
    this.debug = this.options.debug;
  }

  // Debug logging helper
  private debugLog(message: string, data?: any): void {
    if (this.debug) {
      console.log(`[JSONParser] ${message}`, data);
    }
  }

  /**
   * Parse HydroscopeData into VisualizationState
   */
  async parseData(data: HydroscopeData): Promise<ParseResult> {
    const startTime = Date.now();
    this.debugLog("Starting JSON parsing", {
      nodeCount: data.nodes.length,
      edgeCount: data.edges.length,
      hierarchyChoicesCount: data.hierarchyChoices.length,
    });

    const warnings: ValidationResult[] = [];
    const visualizationState = new VisualizationState();

    try {
      // Step 1: Parse hierarchy choices
      const hierarchyChoices = this.parseHierarchyChoices(
        data.hierarchyChoices,
      );
      this.debugLog("Parsed hierarchy choices", {
        count: hierarchyChoices.length,
      });

      // Step 2: Determine which hierarchy to use for grouping
      const selectedHierarchy = this.selectDefaultHierarchy(
        hierarchyChoices,
        data.nodeAssignments,
      );
      this.debugLog("Selected hierarchy", { hierarchy: selectedHierarchy });

      // Step 3: Create containers from selected hierarchy
      let containerCount = 0;
      if (selectedHierarchy && data.nodeAssignments[selectedHierarchy]) {
        containerCount = await this.createContainersFromHierarchy(
          visualizationState,
          hierarchyChoices.find((h) => h.id === selectedHierarchy),
          data.nodeAssignments[selectedHierarchy],
          warnings,
        );
      }

      // Step 4: Parse and add nodes
      const nodeCount = await this.parseNodes(
        visualizationState,
        data.nodes,
        warnings,
      );
      this.debugLog("Parsed nodes", { count: nodeCount });

      // Step 5: Assign nodes to containers
      if (selectedHierarchy && data.nodeAssignments[selectedHierarchy]) {
        await this.assignNodesToContainers(
          visualizationState,
          data.nodeAssignments[selectedHierarchy],
          warnings,
        );
      }

      // Step 6: Parse and add edges
      const edgeCount = await this.parseEdges(
        visualizationState,
        data.edges,
        warnings,
      );
      this.debugLog("Parsed edges", { count: edgeCount });

      // Step 7: Validate final state
      if (this.options.validateDuringParsing) {
        visualizationState.validateInvariants();
      }

      const processingTime = Date.now() - startTime;
      this.debugLog("Parsing completed", {
        processingTime,
        nodeCount,
        edgeCount,
        containerCount,
        warningCount: warnings.length,
      });

      return {
        visualizationState,
        hierarchyChoices,
        selectedHierarchy,
        edgeStyleConfig: data.edgeStyleConfig || null,
        nodeTypeConfig: data.nodeTypeConfig || null,
        warnings,
        stats: {
          nodeCount,
          edgeCount,
          containerCount,
          processingTime,
        },
      };
    } catch (error) {
      const parseError: ParseError = {
        type: "processing_error",
        message: `JSON parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        context: {
          step: "parsing",
          processingTime: Date.now() - startTime,
        },
      };
      throw parseError;
    }
  }

  /**
   * Parse hierarchy choices from raw data
   */
  private parseHierarchyChoices(rawChoices: any[]): HierarchyChoice[] {
    if (!Array.isArray(rawChoices)) {
      return [];
    }

    return rawChoices.map((choice, index) => {
      if (!choice.id || !choice.name) {
        throw new Error(
          `Invalid hierarchy choice at index ${index}: missing id or name`,
        );
      }

      // Handle different formats: some have 'children', others have 'hierarchy'
      const childrenArray = choice.children || choice.hierarchy || [];

      return {
        id: choice.id,
        name: choice.name,
        children: this.parseHierarchyChildren(childrenArray),
      };
    });
  }

  /**
   * Parse hierarchy children recursively
   */
  private parseHierarchyChildren(rawChildren: any[]): HierarchyChoice[] {
    if (!Array.isArray(rawChildren)) {
      return [];
    }

    return rawChildren.map((child, index) => {
      if (!child.id || !child.name) {
        throw new Error(
          `Invalid hierarchy child at index ${index}: missing id or name`,
        );
      }

      return {
        id: child.id,
        name: child.name,
        children: this.parseHierarchyChildren(child.children || []),
      };
    });
  }

  /**
   * Select the default hierarchy for grouping
   */
  private selectDefaultHierarchy(
    hierarchyChoices: HierarchyChoice[],
    nodeAssignments: Record<string, Record<string, string>>,
  ): string | null {
    // First try the configured default
    if (this.options.defaultHierarchyChoice) {
      const hasChoice = hierarchyChoices.some(
        (h) => h.id === this.options.defaultHierarchyChoice,
      );
      const hasAssignments =
        nodeAssignments[this.options.defaultHierarchyChoice];
      if (hasChoice && hasAssignments) {
        return this.options.defaultHierarchyChoice;
      }
    }

    // Fall back to first available hierarchy with assignments
    for (const choice of hierarchyChoices) {
      if (nodeAssignments[choice.id]) {
        return choice.id;
      }
    }

    return null;
  }

  /**
   * Create containers from hierarchy choice
   */
  private async createContainersFromHierarchy(
    state: VisualizationState,
    hierarchy: HierarchyChoice | undefined,
    assignments: Record<string, string>,
    warnings: ValidationResult[],
  ): Promise<number> {
    if (!hierarchy) {
      return 0;
    }

    let containerCount = 0;

    // Create containers from hierarchy children (these are the actual containers)
    for (const child of hierarchy.children || []) {
      try {
        const container: Container = {
          id: child.id,
          label: child.name,
          children: new Set<string>(),
          collapsed: false, // Start expanded by default to avoid invariant violations
          hidden: false,
        };

        state.addContainer(container);
        containerCount++;

        this.debugLog("Created container", { id: child.id, name: child.name });
      } catch (error) {
        warnings.push({
          type: "container_creation_error",
          message: `Failed to create container ${child.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "warning",
          context: { containerId: child.id, containerName: child.name },
        });
      }
    }

    return containerCount;
  }

  /**
   * Parse nodes from raw data
   */
  private async parseNodes(
    state: VisualizationState,
    rawNodes: any[],
    warnings: ValidationResult[],
  ): Promise<number> {
    let nodeCount = 0;

    for (const [index, rawNode] of rawNodes.entries()) {
      try {
        // Apply custom transformation if provided
        const transformedNode = this.options.nodeTransformer(rawNode);

        // Create GraphNode from raw data
        const node: GraphNode = {
          id: rawNode.id || transformedNode.id || `node_${index}`,
          label:
            rawNode.shortLabel ||
            rawNode.label ||
            transformedNode.label ||
            `Node ${index}`,
          longLabel:
            rawNode.fullLabel ||
            rawNode.longLabel ||
            transformedNode.longLabel ||
            rawNode.shortLabel ||
            rawNode.label ||
            `Node ${index}`,
          type:
            rawNode.nodeType ||
            rawNode.type ||
            transformedNode.type ||
            "Unknown",
          semanticTags:
            rawNode.semanticTags || transformedNode.semanticTags || [],
          hidden: false,
          showingLongLabel: false,
          ...transformedNode, // Allow transformer to override any field
        };

        state.addNode(node);
        nodeCount++;

        if (nodeCount % 100 === 0) {
          this.debugLog("Parsed nodes progress", { count: nodeCount });
        }
      } catch (error) {
        warnings.push({
          type: "node_parsing_error",
          message: `Failed to parse node at index ${index}: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "warning",
          context: { nodeIndex: index, rawNode },
        });
      }
    }

    return nodeCount;
  }

  /**
   * Assign nodes to containers based on nodeAssignments
   */
  private async assignNodesToContainers(
    state: VisualizationState,
    assignments: Record<string, string>,
    warnings: ValidationResult[],
  ): Promise<void> {
    let assignmentCount = 0;

    for (const [nodeId, containerId] of Object.entries(assignments)) {
      try {
        // Check if node exists
        const node = state.getGraphNode(nodeId);
        if (!node) {
          warnings.push({
            type: "node_assignment_error",
            message: `Cannot assign non-existent node ${nodeId} to container ${containerId}`,
            severity: "warning",
            context: { nodeId, containerId },
          });
          continue;
        }

        // Check if container exists
        const container = state.getContainer(containerId);
        if (!container) {
          warnings.push({
            type: "container_assignment_error",
            message: `Cannot assign node ${nodeId} to non-existent container ${containerId}`,
            severity: "warning",
            context: { nodeId, containerId },
          });
          continue;
        }

        // Assign node to container
        state.assignNodeToContainer(nodeId, containerId);
        assignmentCount++;

        if (assignmentCount % 100 === 0) {
          this.debugLog("Node assignment progress", { count: assignmentCount });
        }
      } catch (error) {
        warnings.push({
          type: "assignment_error",
          message: `Failed to assign node ${nodeId} to container ${containerId}: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "warning",
          context: { nodeId, containerId },
        });
      }
    }

    this.debugLog("Completed node assignments", { count: assignmentCount });
  }

  /**
   * Parse edges from raw data
   */
  private async parseEdges(
    state: VisualizationState,
    rawEdges: any[],
    warnings: ValidationResult[],
  ): Promise<number> {
    let edgeCount = 0;

    for (const [index, rawEdge] of rawEdges.entries()) {
      try {
        // Apply custom transformation if provided
        const transformedEdge = this.options.edgeTransformer(rawEdge);

        // Create GraphEdge from raw data
        const edge: GraphEdge = {
          id: rawEdge.id || transformedEdge.id || `edge_${index}`,
          source: rawEdge.source || transformedEdge.source,
          target: rawEdge.target || transformedEdge.target,
          type: rawEdge.type || transformedEdge.type || "default",
          semanticTags:
            rawEdge.semanticTags ||
            rawEdge.edgeProperties ||
            transformedEdge.semanticTags ||
            [],
          hidden: false,
          ...transformedEdge, // Allow transformer to override any field
        };

        // Validate required fields
        if (!edge.source || !edge.target) {
          throw new Error(
            `Edge missing source or target: source=${edge.source}, target=${edge.target}`,
          );
        }

        // Debug: Log first few edges to verify source/target values
        if (edgeCount < 5) {
          console.log(
            `[JSONParser] 🔍 Edge ${edge.id}: ${edge.source} -> ${edge.target}`,
          );
        }

        state.addEdge(edge);
        edgeCount++;

        if (edgeCount % 100 === 0) {
          this.debugLog("Parsed edges progress", { count: edgeCount });
        }
      } catch (error) {
        warnings.push({
          type: "edge_parsing_error",
          message: `Failed to parse edge at index ${index}: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "warning",
          context: { edgeIndex: index, rawEdge },
        });
      }
    }

    return edgeCount;
  }

  /**
   * Create a parser with paxos.json specific configuration
   */
  static createPaxosParser(
    options: Partial<JSONParserOptions> = {},
  ): JSONParser {
    return new JSONParser({
      defaultHierarchyChoice: "location",
      debug: false,
      validateDuringParsing: true,
      ...options,
      // Paxos-specific node transformer
      nodeTransformer: (rawNode) => {
        const transformed: Partial<GraphNode> = {};

        // Handle paxos.json specific fields
        if (rawNode.shortLabel) {
          transformed.label = rawNode.shortLabel;
        }
        if (rawNode.fullLabel) {
          transformed.longLabel = rawNode.fullLabel;
        }
        if (rawNode.nodeType) {
          transformed.type = rawNode.nodeType;
        }

        // Extract semantic tags from various sources
        const semanticTags: string[] = [];
        if (rawNode.semanticTags) {
          semanticTags.push(...rawNode.semanticTags);
        }
        if (rawNode.nodeType) {
          semanticTags.push(rawNode.nodeType);
        }
        if (rawNode.data?.locationType) {
          semanticTags.push(rawNode.data.locationType);
        }
        transformed.semanticTags = [...new Set(semanticTags)]; // Remove duplicates

        // Apply custom transformer if provided
        if (options.nodeTransformer) {
          Object.assign(transformed, options.nodeTransformer(rawNode));
        }

        return transformed;
      },
      // Paxos-specific edge transformer
      edgeTransformer: (rawEdge) => {
        const transformed: Partial<GraphEdge> = {};

        // Handle paxos.json specific fields
        if (rawEdge.edgeProperties) {
          transformed.semanticTags = rawEdge.edgeProperties;
        }

        // Apply custom transformer if provided
        if (options.edgeTransformer) {
          Object.assign(transformed, options.edgeTransformer(rawEdge));
        }

        return transformed;
      },
    });
  }
}

export default JSONParser;
