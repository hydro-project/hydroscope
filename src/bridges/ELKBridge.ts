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
import type { IELKBridge } from "../types/bridges.js";
import {
  SIZES,
  LAYOUT_CONSTANTS,
  DEFAULT_ELK_ALGORITHM,
  DEFAULT_LAYOUT_CONFIG,
} from "../shared/config.js";
import { withAsyncResizeObserverErrorSuppression } from "../utils/ResizeObserverErrorSuppression.js";
export class ELKBridge implements IELKBridge {
  private performanceHints?: PerformanceHints;
  private elk: any;
  constructor(private layoutConfig: LayoutConfig = {}) {
    // Validate input config first
    this.validateConfiguration(layoutConfig);
    // Set defaults for missing config with performance-aware defaults
    const fullConfig: LayoutConfig = {
      algorithm: layoutConfig.algorithm || DEFAULT_ELK_ALGORITHM,
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
  // Synchronous Conversions - pure function without caching
  toELKGraph(state: VisualizationState): ELKNode {
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
        const nodeSize = this.calculateOptimalNodeSize(node, optimizedConfig);
        elkNode.children!.push({
          id: node.id,
          width: nodeSize.width,
          height: nodeSize.height,
          layoutOptions: this.getNodeLayoutOptions(node, optimizedConfig),
        });
      }
    }
    // Helper function to recursively convert containers with proper nesting
    const convertContainerRecursively = (
      container: Container,
      state: VisualizationState,
      containersToInclude: Set<Container>,
    ): any => {
      if (container.collapsed) {
        // Collapsed container as single node - still need some size for collapsed containers
        return {
          id: container.id,
          // Use proper collapsed container dimensions from config
          width: SIZES.COLLAPSED_CONTAINER_WIDTH,
          height: SIZES.COLLAPSED_CONTAINER_HEIGHT,
          layoutOptions: this.getContainerLayoutOptions(
            container,
            optimizedConfig,
          ),
        };
      } else {
        // Expanded container with children - let ELK determine size
        const elkChildren: any[] = [];
        // Add direct child nodes
        const childNodes = visibleNodes.filter((node) =>
          container.children.has(node.id),
        );
        for (const node of childNodes) {
          const nodeSize = this.calculateOptimalNodeSize(node, optimizedConfig);
          elkChildren.push({
            id: node.id,
            width: nodeSize.width,
            height: nodeSize.height,
            layoutOptions: this.getNodeLayoutOptions(node, optimizedConfig),
          });
        }
        // Add direct child containers (recursively)
        // Include both visible containers and containers referenced by aggregated edges
        const childContainers = Array.from(containersToInclude).filter(
          (childContainer) => container.children.has(childContainer.id),
        );
        for (const childContainer of childContainers) {
          elkChildren.push(
            convertContainerRecursively(
              childContainer,
              state,
              containersToInclude,
            ),
          );
        }
        const containerLayoutOptions = this.getContainerLayoutOptions(
          container,
          optimizedConfig,
          true, // Fix container positions to prevent movement
        );
        // Let ELK compute the size based on content
        containerLayoutOptions["elk.nodeSize.constraints"] = "MINIMUM_SIZE";
        containerLayoutOptions["elk.nodeSize.options"] =
          "DEFAULT_MINIMUM_SIZE COMPUTE_PADDING";
        return {
          id: container.id,
          // Provide current position to ELK (will be fixed in place)
          x: container.position?.x ?? 0,
          y: container.position?.y ?? 0,
          // Don't specify width/height - let ELK determine based on content
          children: elkChildren,
          layoutOptions: containerLayoutOptions,
        };
      }
    };
    // CRITICAL FIX: Collect containers referenced by aggregated edges
    // These containers must be included in the ELK graph even if they're hidden
    const containersReferencedByEdges = new Set<string>();
    for (const aggEdge of aggregatedEdges) {
      if (state.getContainer(aggEdge.source)) {
        containersReferencedByEdges.add(aggEdge.source);
      }
      if (state.getContainer(aggEdge.target)) {
        containersReferencedByEdges.add(aggEdge.target);
      }
    }
    // Include containers that are either visible OR referenced by aggregated edges
    const containersToInclude = new Set<Container>();
    // Add all visible containers
    for (const container of visibleContainers) {
      containersToInclude.add(container);
    }
    // Add containers referenced by aggregated edges (even if hidden)
    for (const containerId of containersReferencedByEdges) {
      const container = state.getContainer(containerId);
      if (container) {
        containersToInclude.add(container);
        // Also include all ancestors of referenced containers
        // This ensures that nested containers are properly included in the ELK hierarchy
        let currentId: string | null = containerId;
        while (currentId) {
          const currentContainer = state.getContainer(currentId);
          if (currentContainer) {
            containersToInclude.add(currentContainer);
          }
          // Move up to parent
          currentId = state.getContainerParent(currentId) || null;
        }
      }
    }
    // Only add root-level containers (containers with no parent) to the ELK root
    const rootContainers = Array.from(containersToInclude).filter(
      (container) => !state.getContainerParent(container.id),
    );
    for (const container of rootContainers) {
      elkNode.children!.push(
        convertContainerRecursively(container, state, containersToInclude),
      );
    }
    // Build set of all node IDs that exist in the ELK graph for validation
    const allELKNodeIds = new Set<string>();
    const collectNodeIds = (children: any[]): void => {
      for (const child of children) {
        allELKNodeIds.add(child.id);
        if (child.children) {
          collectNodeIds(child.children);
        }
      }
    };
    collectNodeIds(elkNode.children || []);
    // CRITICAL FIX: Also add all visible nodes that are children of containers
    // The collectNodeIds function above only gets container IDs, but expanded containers
    // also contain individual nodes as children that need to be included in validation
    for (const node of visibleNodes) {
      allELKNodeIds.add(node.id);
    }
    // CRITICAL FIX: Also add all visible containers to the validation set
    // Aggregated edges can reference containers as endpoints, so containers must be
    // included in the validation set
    for (const container of visibleContainers) {
      allELKNodeIds.add(container.id);
    }
    // CRITICAL FIX: Aggregated edges can reference ANY container that exists in the data model,
    // not just visible ones. When containers are collapsed/hidden, aggregated edges still
    // reference them as endpoints. We need to include ALL containers in the validation set.
    const allContainers = state.getAllContainers(); // Get all containers, not just visible ones
    for (const container of allContainers) {
      allELKNodeIds.add(container.id);
    }
    // Validate edges reference existing nodes - FAIL EARLY on bad data
    const invalidEdges: string[] = [];
    for (const edge of visibleEdges) {
      if (!allELKNodeIds.has(edge.source) || !allELKNodeIds.has(edge.target)) {
        invalidEdges.push(`${edge.id} (${edge.source} -> ${edge.target})`);
        console.error(
          `[ELKBridge] ❌ INVALID EDGE: ${edge.id} references non-existent nodes - source=${edge.source} (exists: ${allELKNodeIds.has(edge.source)}), target=${edge.target} (exists: ${allELKNodeIds.has(edge.target)})`,
        );
      }
    }
    for (const aggEdge of aggregatedEdges) {
      if (
        !allELKNodeIds.has(aggEdge.source) ||
        !allELKNodeIds.has(aggEdge.target)
      ) {
        invalidEdges.push(
          `${aggEdge.id} (${aggEdge.source} -> ${aggEdge.target})`,
        );
        console.error(
          `[ELKBridge] ❌ INVALID AGGREGATED EDGE: ${aggEdge.id} references non-existent nodes - source=${aggEdge.source} (exists: ${allELKNodeIds.has(aggEdge.source)}), target=${aggEdge.target} (exists: ${allELKNodeIds.has(aggEdge.target)})`,
        );
      }
    }
    // FAIL EARLY if we have invalid edges - don't suppress bad data
    if (invalidEdges.length > 0) {
      const errorMessage = `Data consistency error: ${invalidEdges.length} edges reference non-existent nodes. This indicates a bug in the data processing pipeline. Invalid edges: ${invalidEdges.slice(0, 5).join(", ")}${invalidEdges.length > 5 ? ` and ${invalidEdges.length - 5} more` : ""}`;
      console.error(`[ELKBridge] 🚨 ${errorMessage}`);
      throw new Error(errorMessage);
    }
    // Convert edges (all edges should be valid at this point)
    for (const edge of visibleEdges) {
      elkNode.edges!.push({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      });
    }
    for (const aggEdge of aggregatedEdges) {
      elkNode.edges!.push({
        id: aggEdge.id,
        sources: [aggEdge.source],
        targets: [aggEdge.target],
      });
    }
    // HIERARCHY LOGGING: Log complete ELK graph structure recursively
    // Deep clone the result to prevent mutation issues with nested hierarchies
    return this.deepCloneELKNode(elkNode);
  }

  private deepCloneELKNode(node: ELKNode): ELKNode {
    return JSON.parse(JSON.stringify(node));
  }
  /**
   * Calculate and apply ELK layout to VisualizationState
   * This is the main method to use - it runs the ELK algorithm and applies results
   */
  async layout(
    state: VisualizationState,
    constrainedEntities?: string[],
  ): Promise<void> {
    // Determine if this is a constrained layout (only specific entities being re-laid out)
    const isConstrainedLayout =
      constrainedEntities !== undefined && constrainedEntities.length > 0;
    try {
      // Run smart collapse before layout if enabled
      if (state.shouldRunSmartCollapse()) {
        console.log(
          "🎯 SMART COLLAPSE CALLED - running smart collapse before layout",
        );
        state.performSmartCollapse();
        console.log("✅ SMART COLLAPSE COMPLETED");
      } else {
        console.log(
          "❌ SMART COLLAPSE SKIPPED - shouldRunSmartCollapse() returned false",
        );
      }

      // Convert VisualizationState to ELK format
      const elkGraph = this.toELKGraph(state);

      // Call real ELK library to calculate layout with fallback mechanism
      let layoutResult;
      try {
        // Wrap ELK layout operation with ResizeObserver error suppression
        layoutResult = await withAsyncResizeObserverErrorSuppression(
          async () => await this.elk.layout(elkGraph),
        )();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        // Check if this is the specific hitbox error that affects complex nested hierarchies
        if (
          errorMessage.includes(
            "Invalid hitboxes for scanline constraint calculation",
          )
        ) {
          // Create a fallback ELK graph with stress algorithm configuration
          const fallbackElkGraph = {
            ...elkGraph,
            layoutOptions: {
              ...elkGraph.layoutOptions,
              "elk.algorithm": "stress",
              "elk.hierarchyHandling": "SEPARATE_CHILDREN", // Disable hierarchical layout
            },
          };
          try {
            // Wrap fallback ELK layout operation with ResizeObserver error suppression
            layoutResult = await withAsyncResizeObserverErrorSuppression(
              async () => await this.elk.layout(fallbackElkGraph),
            )();
          } catch (fallbackError) {
            console.error(
              `[ELKBridge] ❌ Stress algorithm fallback also failed:`,
              fallbackError,
            );
            throw error; // Throw the original error
          }
        } else {
          // For other errors, just re-throw
          throw error;
        }
      }
      // Apply the calculated positions back to VisualizationState
      this.applyELKResults(state, layoutResult, isConstrainedLayout);
      // Log state after layout
      // Increment layout count after successful layout
      state.incrementLayoutCount();
    } catch (error) {
      console.error(`[ELKBridge] ❌ LAYOUT PIPELINE FAILED:`, error);
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
  applyELKResults(
    state: VisualizationState,
    elkResult: ELKNode,
    preserveContainerPositions: boolean = false,
  ): void {
    if (!elkResult.children) return;
    try {
      // Validate ELK result structure
      this.validateELKResult(elkResult);
      // Apply positions to nodes and containers
      this.applyPositionsToElements(
        state,
        elkResult.children,
        preserveContainerPositions,
      );
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
    preserveContainerPositions: boolean = false,
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
        // Preserve container positions only during constrained layouts
        this.applyContainerPosition(
          container,
          elkChild,
          preserveContainerPositions,
        );
      }
      // Silently ignore unknown IDs (they may be from previous state)
      // Handle nested children (for expanded containers)
      if (elkChild.children && elkChild.children.length > 0) {
        this.applyPositionsToElements(
          state,
          elkChild.children,
          preserveContainerPositions,
        );
      }
    }
  }
  private applyNodePosition(node: GraphNode, elkChild: ELKNode): void {
    node.position = { x: elkChild.x!, y: elkChild.y! };

    // FIXED: Only update dimensions if the node doesn't have custom dimensions
    // This preserves custom dimensions set by "Show full node labels" feature
    if (elkChild.width && elkChild.height && !node.dimensions) {
      node.dimensions = { width: elkChild.width, height: elkChild.height };
    }

    // If node has custom dimensions, preserve them but log for debugging
    if (node.dimensions && elkChild.width && elkChild.height) {
      console.log(
        `🎯 [ELKBridge] Node ${node.id}: preserving custom dimensions ${node.dimensions.width}x${node.dimensions.height} (ELK calculated ${elkChild.width}x${elkChild.height})`,
      );
    }
  }
  private applyContainerPosition(
    container: Container,
    elkChild: ELKNode,
    preservePosition: boolean = false,
  ): void {
    // Only update position if not preserving
    if (!preservePosition) {
      container.position = { x: elkChild.x!, y: elkChild.y! };
    }
    // Always update dimensions to accommodate content changes
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
      algorithm: DEFAULT_LAYOUT_CONFIG.algorithm,
      direction: DEFAULT_LAYOUT_CONFIG.direction,
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
      "elk.algorithm": config.algorithm || DEFAULT_LAYOUT_CONFIG.algorithm,
      "elk.direction": config.direction || DEFAULT_LAYOUT_CONFIG.direction,
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
  ): {
    width: number;
    height: number;
  } {
    const baseSize = config.nodeSize || { width: 120, height: 60 };

    // FIXED: Use custom dimensions when available (for "Show full node labels" feature)
    // This allows nodes to be properly sized based on their label length
    if (node.dimensions) {
      console.log(
        `🎯 [ELKBridge] Node ${node.id}: using custom dimensions ${node.dimensions.width}x${node.dimensions.height}`,
      );
      return {
        width: node.dimensions.width,
        height: node.dimensions.height,
      };
    }

    // Fallback to base size when no custom dimensions
    return {
      width: baseSize.width,
      height: baseSize.height,
    };
  }
  private getNodeLayoutOptions(
    node: GraphNode,
    _config: LayoutConfig,
  ): Record<string, any> {
    const options: Record<string, any> = {};
    // Add node-specific layout hints based on semantic tags
    if (node.semanticTags?.includes("important")) {
      options["elk.priority"] = "10";
    }
    if (node.semanticTags?.includes("central")) {
      options["elk.layered.layering.nodePromotion.strategy"] = "NONE";
    }
    return options;
  }
  private getContainerLayoutOptions(
    _container: Container,
    config: LayoutConfig,
    _fixPosition: boolean = false,
  ): Record<string, any> {
    const options: Record<string, any> = {};
    // Container-specific layout options
    // Use configured container padding to create proper visual separation between nested levels
    const padding = config.containerPadding ?? 20; // Use nullish coalescing to respect 0 values
    // Add extra bottom padding to accommodate container labels
    const bottomPadding =
      padding +
      LAYOUT_CONSTANTS.CONTAINER_LABEL_HEIGHT +
      LAYOUT_CONSTANTS.CONTAINER_LABEL_PADDING;
    options["elk.padding"] =
      `[top=${padding},left=${padding},bottom=${bottomPadding},right=${padding}]`;
    if (config.hierarchicalLayout) {
      options["elk.hierarchyHandling"] = "INCLUDE_CHILDREN";
    }
    // Note: Position fixing is handled by preserving positions in applyContainerPosition
    // rather than through ELK layout options
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
    const validAlgorithms = ["layered", "force", "stress", "mrtree", "disco"];
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
