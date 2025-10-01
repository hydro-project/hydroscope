/**
 * ELKBridge - Stateless bridge for ELK layout engine integration
 * Architectural constraints: Stateless, React-free, synchronous conversions
 */

import ELK from "elkjs";
import type { VisualizationState } from "../core/VisualizationState.js";
import type {
  LayoutConfig,
  ELKNode,
  ELKValidationResult,
  GraphNode,
  Container,
  PerformanceHints,
} from "../types/core.js";

export class ELKBridge {
  private performanceHints?: PerformanceHints;
  private layoutCache = new Map<string, ELKNode>();
  private configCache = new Map<string, any>();
  private lastGraphHash: string | null = null;
  private elk: any;

  constructor(private layoutConfig: LayoutConfig = {}) {
    // Validate input config first
    this.validateConfiguration(layoutConfig);

    // Set defaults for missing config with performance-aware defaults
    const fullConfig: LayoutConfig = {
      algorithm: layoutConfig.algorithm || "layered",
      direction: layoutConfig.direction || "DOWN",
      spacing: layoutConfig.spacing,
      nodeSpacing: layoutConfig.nodeSpacing ?? 20,
      layerSpacing: layoutConfig.layerSpacing ?? 25,
      edgeSpacing: layoutConfig.edgeSpacing ?? 10,
      portSpacing: layoutConfig.portSpacing ?? 10,
      separateConnectedComponents:
        layoutConfig.separateConnectedComponents ?? true,
      mergeEdges: layoutConfig.mergeEdges ?? false,
      mergeHierarchyEdges: layoutConfig.mergeHierarchyEdges ?? false,
      aspectRatio: layoutConfig.aspectRatio ?? 1.6,
      nodeSize: layoutConfig.nodeSize || { width: 120, height: 60 },
      containerPadding: layoutConfig.containerPadding ?? 20,
      hierarchicalLayout: layoutConfig.hierarchicalLayout ?? true,
      compactLayout: layoutConfig.compactLayout ?? false,
      interactiveLayout: layoutConfig.interactiveLayout ?? false,
      elkOptions: layoutConfig.elkOptions || {},
    };

    this.layoutConfig = fullConfig;

    // Initialize ELK instance
    this.elk = new ELK();
  }

  // Synchronous Conversions with caching
  toELKGraph(state: VisualizationState): ELKNode {
    // Generate hash for caching
    const graphHash = this.generateGraphHash(state);

    // Check cache first
    if (this.lastGraphHash === graphHash && this.layoutCache.has(graphHash)) {
      return this.deepCloneELKNode(this.layoutCache.get(graphHash)!);
    }

    const visibleNodes = state.visibleNodes;
    const visibleContainers = state.visibleContainers;
    const visibleEdges = state.visibleEdges;
    const aggregatedEdges = state.getAggregatedEdges();

    // Generate performance hints for optimization
    this.performanceHints = this.generatePerformanceHints(
      visibleNodes,
      visibleEdges,
      visibleContainers,
    );

    // Apply performance-based configuration adjustments
    const optimizedConfig = this.applyPerformanceOptimizations(
      this.layoutConfig,
      this.performanceHints,
    );

    const elkNode: ELKNode = {
      id: "root",
      children: [],
      edges: [],
      layoutOptions: this.buildLayoutOptions(optimizedConfig),
    };

    // Convert visible nodes (not in collapsed containers)
    for (const node of visibleNodes) {
      // Check if node is in an expanded container
      const parentContainer = visibleContainers.find(
        (c) => c.children.has(node.id) && !c.collapsed,
      );

      if (!parentContainer) {
        // Node is not in a container or container is collapsed
        console.log(
          `[ELKBridge] Adding node ${node.id} to root (no parent container)`,
        );
        const nodeSize = this.calculateOptimalNodeSize(node, optimizedConfig);
        elkNode.children!.push({
          id: node.id,
          width: nodeSize.width,
          height: nodeSize.height,
          layoutOptions: this.getNodeLayoutOptions(node, optimizedConfig),
        });
      } else {
        console.log(
          `[ELKBridge] Node ${node.id} will be added as child of container ${parentContainer.id}`,
        );
      }
    }

    // Convert containers
    for (const container of visibleContainers) {
      if (container.collapsed) {
        // Collapsed container as single node
        const containerSize = this.calculateOptimalContainerSize(
          container,
          optimizedConfig,
          true,
        );
        elkNode.children!.push({
          id: container.id,
          width: containerSize.width,
          height: containerSize.height,
          layoutOptions: this.getContainerLayoutOptions(
            container,
            optimizedConfig,
          ),
        });
      } else {
        // Expanded container with children
        const containerChildren = visibleNodes
          .filter((node) => container.children.has(node.id))
          .map((node) => {
            console.log(
              `[ELKBridge] Adding node ${node.id} as child of container ${container.id}`,
            );
            const nodeSize = this.calculateOptimalNodeSize(
              node,
              optimizedConfig,
            );
            return {
              id: node.id,
              width: nodeSize.width,
              height: nodeSize.height,
              layoutOptions: this.getNodeLayoutOptions(node, optimizedConfig),
            };
          });

        const containerSize = this.calculateOptimalContainerSize(
          container,
          optimizedConfig,
          false,
          containerChildren.length,
        );
        elkNode.children!.push({
          id: container.id,
          width: containerSize.width,
          height: containerSize.height,
          children: containerChildren,
          layoutOptions: this.getContainerLayoutOptions(
            container,
            optimizedConfig,
          ),
        });
      }
    }

    // Convert regular edges (for expanded containers)
    for (const edge of visibleEdges) {
      elkNode.edges!.push({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      });
    }

    // Convert aggregated edges (for collapsed containers)
    for (const aggEdge of aggregatedEdges) {
      elkNode.edges!.push({
        id: aggEdge.id,
        sources: [aggEdge.source],
        targets: [aggEdge.target],
      });
    }

    // Cache the result
    this.layoutCache.set(graphHash, this.deepCloneELKNode(elkNode));
    this.lastGraphHash = graphHash;

    // Cleanup cache if it gets too large
    if (this.layoutCache.size > 10) {
      const oldestKey = this.layoutCache.keys().next().value;
      if (oldestKey) {
        this.layoutCache.delete(oldestKey);
      }
    }

    return elkNode;
  }

  private generateGraphHash(state: VisualizationState): string {
    // Simple hash based on visible elements and their states
    const visibleNodes = state.visibleNodes;
    const visibleContainers = state.visibleContainers;
    const visibleEdges = state.visibleEdges;

    const nodeHash = visibleNodes.map((n) => `${n.id}:${n.hidden}`).join(",");
    const containerHash = visibleContainers
      .map((c) => `${c.id}:${c.collapsed}`)
      .join(",");
    const edgeHash = visibleEdges
      .map((e) => `${e.id}:${e.source}:${e.target}`)
      .join(",");

    return `${nodeHash}|${containerHash}|${edgeHash}|${JSON.stringify(this.layoutConfig)}`;
  }

  private deepCloneELKNode(node: ELKNode): ELKNode {
    return JSON.parse(JSON.stringify(node));
  }

  // Clear caches for memory management
  clearCaches(): void {
    this.layoutCache.clear();
    this.configCache.clear();
    this.lastGraphHash = null;
    this.performanceHints = undefined;
  }

  // Get cache statistics
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.layoutCache.size,
      hitRate: 0, // Would need to track hits/misses for accurate rate
    };
  }

  /**
   * Calculate and apply ELK layout to VisualizationState
   * This is the main method to use - it runs the ELK algorithm and applies results
   */
  async layout(state: VisualizationState): Promise<void> {
    try {
      // CRITICAL FIX: Run smart collapse before layout if enabled
      if (state.shouldRunSmartCollapse()) {
        console.log(`[ELKBridge] 🧠 Running smart collapse before layout`);
        state.performSmartCollapse();
      }

      // Convert VisualizationState to ELK format
      const elkGraph = this.toELKGraph(state);

      // Call real ELK library to calculate layout
      const layoutResult = await this.elk.layout(elkGraph);

      // Apply the calculated positions back to VisualizationState
      this.applyELKResults(state, layoutResult);

      // Increment layout count after successful layout
      state.incrementLayoutCount();
    } catch (error) {
      throw new Error(
        `ELK layout calculation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Apply pre-calculated ELK layout results to VisualizationState
   * @deprecated Use layout() instead for automatic ELK calculation
   */
  applyLayout(state: VisualizationState, elkResult: ELKNode): void {
    this.applyELKResults(state, elkResult);
  }

  /**
   * Apply pre-calculated ELK layout results to VisualizationState
   * Use this when you have ELK results from external calculation
   */
  applyELKResults(state: VisualizationState, elkResult: ELKNode): void {
    if (!elkResult.children) return;

    try {
      // Validate ELK result structure
      this.validateELKResult(elkResult);

      // Apply positions to nodes and containers
      this.applyPositionsToElements(state, elkResult.children);

      // Update layout state to indicate successful layout application
      state.setLayoutPhase("ready");
    } catch (error) {
      // Handle layout application errors
      state.setLayoutPhase("error");
      throw new Error(
        `Failed to apply ELK layout results: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private applyPositionsToElements(
    state: VisualizationState,
    elkChildren: ELKNode[],
  ): void {
    for (const elkChild of elkChildren) {
      if (elkChild.x === undefined || elkChild.y === undefined) {
        continue; // Skip invalid results
      }

      const node = state.getGraphNode(elkChild.id);
      const container = state.getContainer(elkChild.id);

      if (node) {
        this.applyNodePosition(node, elkChild);
      } else if (container) {
        this.applyContainerPosition(container, elkChild);
      }
      // Silently ignore unknown IDs (they may be from previous state)

      // Handle nested children (for expanded containers)
      if (elkChild.children && elkChild.children.length > 0) {
        this.applyPositionsToElements(state, elkChild.children);
      }
    }
  }

  private applyNodePosition(node: GraphNode, elkChild: ELKNode): void {
    node.position = { x: elkChild.x!, y: elkChild.y! };
    if (elkChild.width && elkChild.height) {
      node.dimensions = { width: elkChild.width, height: elkChild.height };
    }
  }

  private applyContainerPosition(
    container: Container,
    elkChild: ELKNode,
  ): void {
    container.position = { x: elkChild.x!, y: elkChild.y! };
    if (elkChild.width && elkChild.height) {
      container.dimensions = { width: elkChild.width, height: elkChild.height };
    }
  }

  // Configuration Management
  updateConfiguration(config: Partial<LayoutConfig>): void {
    const newConfig: LayoutConfig = { ...this.layoutConfig, ...config };
    this.validateConfiguration(newConfig);
    this.layoutConfig = newConfig;
    // Clear performance hints to force recalculation
    this.performanceHints = undefined;
  }

  getConfiguration(): Readonly<LayoutConfig> {
    return { ...this.layoutConfig };
  }

  resetConfiguration(): void {
    this.layoutConfig = {
      algorithm: "layered",
      direction: "DOWN",
      nodeSpacing: 50,
      layerSpacing: 25,
      edgeSpacing: 10,
      portSpacing: 10,
      separateConnectedComponents: true,
      mergeEdges: false,
      mergeHierarchyEdges: false,
      aspectRatio: 1.6,
      nodeSize: { width: 120, height: 60 },
      containerPadding: 20,
      hierarchicalLayout: true,
      compactLayout: false,
      interactiveLayout: false,
      elkOptions: {},
    };
    this.performanceHints = undefined;
  }

  // Performance Optimization Methods
  generatePerformanceHints(
    nodes: readonly GraphNode[],
    edges: readonly any[],
    containers: readonly Container[],
  ): PerformanceHints {
    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    const containerCount = containers.length;

    // Calculate maximum nesting depth
    const maxDepth = this.calculateMaxContainerDepth(containers);

    // Determine if this is a large graph
    const isLargeGraph =
      nodeCount > 100 || edgeCount > 200 || containerCount > 20;

    // Recommend algorithm based on graph characteristics
    let recommendedAlgorithm = this.layoutConfig.algorithm;
    let recommendedOptions: Record<string, string> = {};

    if (isLargeGraph) {
      if (containerCount > 10) {
        recommendedAlgorithm = "layered"; // Better for hierarchical structures
        recommendedOptions = {
          "elk.layered.compaction.postCompaction.strategy": "EDGE_LENGTH",
          "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
          "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
        };
      } else if (edgeCount > nodeCount * 2) {
        recommendedAlgorithm = "stress"; // Better for dense graphs
        recommendedOptions = {
          "elk.stress.epsilon": "0.1",
          "elk.stress.iterationLimit": "1000",
        };
      }
    }

    return {
      nodeCount,
      edgeCount,
      containerCount,
      maxDepth,
      isLargeGraph,
      recommendedAlgorithm,
      recommendedOptions,
    };
  }

  applyPerformanceOptimizations(
    config: LayoutConfig,
    hints: PerformanceHints,
  ): LayoutConfig {
    const optimizedConfig = { ...config };

    if (hints.isLargeGraph) {
      // Enable optimizations for large graphs
      optimizedConfig.separateConnectedComponents = true;
      optimizedConfig.compactLayout = true;

      // Adjust spacing for better performance
      if (hints.nodeCount > 200) {
        optimizedConfig.nodeSpacing = Math.max(
          (optimizedConfig.nodeSpacing || 20) * 0.8,
          10,
        );
        optimizedConfig.layerSpacing = Math.max(
          (optimizedConfig.layerSpacing || 25) * 0.8,
          15,
        );
      }

      // Use recommended algorithm if not explicitly set
      if (!config.algorithm && hints.recommendedAlgorithm) {
        optimizedConfig.algorithm = hints.recommendedAlgorithm;
      }

      // Merge recommended ELK options
      if (hints.recommendedOptions) {
        optimizedConfig.elkOptions = {
          ...optimizedConfig.elkOptions,
          ...hints.recommendedOptions,
        };
      }
    }

    // Optimize for deep hierarchies
    if (hints.maxDepth > 3) {
      optimizedConfig.hierarchicalLayout = true;
      optimizedConfig.containerPadding = Math.max(
        (optimizedConfig.containerPadding || 20) * 0.7,
        10,
      );
    }

    return optimizedConfig;
  }

  private calculateMaxContainerDepth(containers: readonly Container[]): number {
    if (containers.length === 0) return 0;

    // Build container hierarchy map
    const containerMap = new Map<string, Container>();
    const childToParent = new Map<string, string>();

    for (const container of containers) {
      containerMap.set(container.id, container);
      for (const childId of container.children) {
        childToParent.set(childId, container.id);
      }
    }

    // Calculate depth for each container
    let maxDepth = 0;

    for (const container of containers) {
      let depth = 0;
      let currentId: string | undefined = container.id;
      const visited = new Set<string>();

      // Traverse up the hierarchy to find depth
      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const parentId = childToParent.get(currentId);
        if (parentId && containerMap.has(parentId)) {
          depth++;
          currentId = parentId;
        } else {
          break;
        }
      }

      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  private buildLayoutOptions(config: LayoutConfig): Record<string, any> {
    const options: Record<string, any> = {
      "elk.algorithm": config.algorithm || "layered",
      "elk.direction": config.direction || "DOWN",
      "elk.spacing.nodeNode": (config.spacing !== undefined
        ? config.spacing
        : config.nodeSpacing !== undefined
          ? config.nodeSpacing
          : 50
      ).toString(),
      "elk.spacing.edgeNode": (config.edgeSpacing || 10).toString(),
      "elk.spacing.edgeEdge": (config.edgeSpacing || 10).toString(),
      "elk.layered.spacing.nodeNodeBetweenLayers": (
        config.layerSpacing || 25
      ).toString(),
      "elk.spacing.portPort": (config.portSpacing || 10).toString(),
    };

    // Add performance optimizations
    if (config.separateConnectedComponents) {
      options["elk.separateConnectedComponents"] = "true";
    }

    if (config.compactLayout) {
      options["elk.spacing.componentComponent"] = "20";
      options["elk.layered.compaction.postCompaction.strategy"] = "EDGE_LENGTH";
    }

    if (config.hierarchicalLayout) {
      options["elk.hierarchyHandling"] = "INCLUDE_CHILDREN";
    }

    if (config.interactiveLayout) {
      options["elk.interactiveLayout"] = "true";
    }

    // Add aspect ratio hint
    if (config.aspectRatio) {
      options["elk.aspectRatio"] = config.aspectRatio.toString();
    }

    // Merge custom ELK options
    if (config.elkOptions) {
      Object.assign(options, config.elkOptions);
    }

    return options;
  }

  private calculateOptimalNodeSize(
    node: GraphNode,
    config: LayoutConfig,
  ): { width: number; height: number } {
    const baseSize = config.nodeSize || { width: 120, height: 60 };

    // Adjust size based on label length for better readability
    const labelLength = node.showingLongLabel
      ? node.longLabel.length
      : node.label.length;
    const widthMultiplier = Math.max(1, Math.min(2, labelLength / 20));

    return {
      width: Math.round(baseSize.width * widthMultiplier),
      height: baseSize.height,
    };
  }

  private calculateOptimalContainerSize(
    container: Container,
    config: LayoutConfig,
    collapsed: boolean,
    childCount: number = 0,
  ): { width: number; height: number } {
    if (collapsed) {
      // Use consistent collapsed container dimensions from config
      return {
        width: 200, // COLLAPSED_CONTAINER_WIDTH from config
        height: 150, // COLLAPSED_CONTAINER_HEIGHT from config
      };
    } else {
      // Expanded container size based on children and padding
      const padding = config.containerPadding || 20;
      const baseWidth = 200 + childCount * 30;
      const baseHeight = 150 + childCount * 20;

      return {
        width: baseWidth + padding * 2,
        height: baseHeight + padding * 2,
      };
    }
  }

  private getNodeLayoutOptions(
    node: GraphNode,
    _config: LayoutConfig,
  ): Record<string, any> {
    const options: Record<string, any> = {};

    // Add node-specific layout hints based on semantic tags
    if (node.semanticTags.includes("important")) {
      options["elk.priority"] = "10";
    }

    if (node.semanticTags.includes("central")) {
      options["elk.layered.layering.nodePromotion.strategy"] = "NONE";
    }

    return options;
  }

  private getContainerLayoutOptions(
    container: Container,
    config: LayoutConfig,
  ): Record<string, any> {
    const options: Record<string, any> = {};

    // Container-specific layout options
    options["elk.padding"] =
      `[top=${config.containerPadding || 20},left=${config.containerPadding || 20},bottom=${config.containerPadding || 20},right=${config.containerPadding || 20}]`;

    if (config.hierarchicalLayout) {
      options["elk.hierarchyHandling"] = "INCLUDE_CHILDREN";
    }

    return options;
  }

  // Performance Analysis
  getPerformanceHints(): PerformanceHints | undefined {
    return this.performanceHints ? { ...this.performanceHints } : undefined;
  }

  analyzeLayoutComplexity(state: VisualizationState): {
    complexity: "low" | "medium" | "high" | "very_high";
    estimatedLayoutTime: number;
    recommendations: string[];
  } {
    const nodes = state.visibleNodes;
    const edges = state.visibleEdges;
    const containers = state.visibleContainers;

    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    const containerCount = containers.length;

    let complexity: "low" | "medium" | "high" | "very_high" = "low";
    let estimatedLayoutTime = 100; // Base time in ms
    const recommendations: string[] = [];

    // Analyze complexity
    if (nodeCount > 500 || edgeCount > 1000) {
      complexity = "very_high";
      estimatedLayoutTime = 5000;
      recommendations.push(
        "Consider using stress algorithm for very large graphs",
      );
      recommendations.push("Enable compact layout for better performance");
    } else if (nodeCount > 200 || edgeCount > 400) {
      complexity = "high";
      estimatedLayoutTime = 2000;
      recommendations.push("Enable separate connected components");
      recommendations.push("Consider reducing node spacing");
    } else if (nodeCount > 50 || edgeCount > 100) {
      complexity = "medium";
      estimatedLayoutTime = 500;
      recommendations.push("Current settings should work well");
    }

    // Container-specific recommendations
    if (containerCount > 20) {
      recommendations.push(
        "Use hierarchical layout for better container handling",
      );
    }

    return {
      complexity,
      estimatedLayoutTime,
      recommendations,
    };
  }

  private validateConfiguration(config: LayoutConfig): void {
    const validAlgorithms = [
      "layered",
      "force",
      "stress",
      "mrtree",
      "radial",
      "disco",
    ];
    const validDirections = ["UP", "DOWN", "LEFT", "RIGHT"];

    if (config.algorithm && !validAlgorithms.includes(config.algorithm)) {
      throw new Error(
        `Invalid ELK algorithm: ${config.algorithm}. Valid options: ${validAlgorithms.join(", ")}`,
      );
    }

    if (config.direction && !validDirections.includes(config.direction)) {
      throw new Error(
        `Invalid ELK direction: ${config.direction}. Valid options: ${validDirections.join(", ")}`,
      );
    }

    // Validate numeric values
    if (
      config.spacing !== undefined &&
      (config.spacing < 0 || !Number.isFinite(config.spacing))
    ) {
      throw new Error("Spacing must be a non-negative finite number");
    }

    if (
      config.nodeSpacing !== undefined &&
      (config.nodeSpacing < 0 || !Number.isFinite(config.nodeSpacing))
    ) {
      throw new Error("Node spacing must be a non-negative finite number");
    }

    if (
      config.layerSpacing !== undefined &&
      (config.layerSpacing < 0 || !Number.isFinite(config.layerSpacing))
    ) {
      throw new Error("Layer spacing must be a non-negative finite number");
    }

    if (
      config.edgeSpacing !== undefined &&
      (config.edgeSpacing < 0 || !Number.isFinite(config.edgeSpacing))
    ) {
      throw new Error("Edge spacing must be a non-negative finite number");
    }

    if (
      config.portSpacing !== undefined &&
      (config.portSpacing < 0 || !Number.isFinite(config.portSpacing))
    ) {
      throw new Error("Port spacing must be a non-negative finite number");
    }

    if (
      config.aspectRatio !== undefined &&
      (config.aspectRatio <= 0 || !Number.isFinite(config.aspectRatio))
    ) {
      throw new Error("Aspect ratio must be a positive finite number");
    }

    if (
      config.containerPadding !== undefined &&
      (config.containerPadding < 0 || !Number.isFinite(config.containerPadding))
    ) {
      throw new Error("Container padding must be a non-negative finite number");
    }

    // Validate node size
    if (config.nodeSize) {
      if (
        config.nodeSize.width <= 0 ||
        !Number.isFinite(config.nodeSize.width)
      ) {
        throw new Error("Node width must be a positive finite number");
      }
      if (
        config.nodeSize.height <= 0 ||
        !Number.isFinite(config.nodeSize.height)
      ) {
        throw new Error("Node height must be a positive finite number");
      }
    }

    // Validate ELK options
    if (config.elkOptions) {
      for (const [key, value] of Object.entries(config.elkOptions)) {
        if (typeof key !== "string" || typeof value !== "string") {
          throw new Error("ELK options must be string key-value pairs");
        }
      }
    }
  }

  private validateELKResult(elkResult: ELKNode): void {
    if (!elkResult.children) return;

    this.validateELKChildren(elkResult.children);
  }

  private validateELKChildren(children: ELKNode[]): void {
    for (const child of children) {
      // Validate required position and dimension properties
      if (
        child.x === undefined ||
        child.y === undefined ||
        child.width === undefined ||
        child.height === undefined
      ) {
        throw new Error(
          `Invalid ELK layout result for element ${child.id}: missing position or dimensions`,
        );
      }

      // Validate position values are finite numbers
      if (
        !Number.isFinite(child.x) ||
        !Number.isFinite(child.y) ||
        !Number.isFinite(child.width) ||
        !Number.isFinite(child.height)
      ) {
        throw new Error(
          `Invalid ELK layout result for element ${child.id}: non-finite position or dimensions`,
        );
      }

      // Validate dimensions are positive
      if (child.width <= 0 || child.height <= 0) {
        throw new Error(
          `Invalid ELK layout result for element ${child.id}: non-positive dimensions`,
        );
      }

      // Recursively validate nested children
      if (child.children && child.children.length > 0) {
        this.validateELKChildren(child.children);
      }
    }
  }

  // Validation
  validateELKGraph(elkGraph: ELKNode): ELKValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!elkGraph.id) {
      errors.push("ELK graph must have an id");
    }

    if (!elkGraph.children || elkGraph.children.length === 0) {
      warnings.push("ELK graph has no children");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
