/**
 * @fileoverview HierarchyTree Component
 * 
 * Displays an interactifunction formatHierarchyNodeTitle(
  truncatedLabel: string,
  _hasChildren: boolean,
  hasLeafChildren: boolean,
  _childrenCount: number,
  leafChildrenCount: number,
  match: boolean,
  isCurrent: boolean,
  showNodeCounts: boolean
): React.ReactNode {ew of container hierarchy for navigation using Ant Design Tree.
 */

import React, { useMemo, useEffect, useState, useRef } from "react";
import { Tree } from "antd";
import type { TreeDataNode } from "antd";
import { HierarchyTreeProps, HierarchyTreeNode } from "./types";
import { TYPOGRAPHY } from "../shared/config";
import { COMPONENT_COLORS } from "../shared/config";
import type { VisualizationState } from "../core/VisualizationState";
import type { AsyncCoordinator } from "../core/AsyncCoordinator";
import type { Container } from "../shared/types";
import type { GraphNode } from "../types/core";

// ============ TREE DATA FORMATTING UTILITIES ============

/**
 * Build hierarchy tree structure from VisualizationState
 * This replaces the redundant hierarchyTree prop that was being passed from InfoPanel
 */
function buildHierarchyTreeFromState(
  visualizationState: VisualizationState,
): HierarchyTreeNode[] {
  if (!visualizationState || visualizationState.visibleContainers.length === 0)
    return [];

  const buildNode = (containerId: string): HierarchyTreeNode => {
    // Use efficient O(1) lookups instead of scanning
    const childrenIds: string[] = [];
    const containerChildren =
      visualizationState.getContainerChildren(containerId);
    containerChildren?.forEach((childId: string) => {
      if (visualizationState.getContainer(childId)) childrenIds.push(childId);
    });
    const children: HierarchyTreeNode[] = childrenIds.map(buildNode);
    return { id: containerId, children };
  };

  // Get top-level containers (those without parents)
  const rootContainers = visualizationState.visibleContainers.filter(
    (container) => !visualizationState.getContainerParent(container.id),
  );
  return rootContainers.map((container: Container) => buildNode(container.id));
}

/**
 * Helper function to truncate labels with consistent logic
 */
function truncateHierarchyLabel(
  text: string,
  maxLength: number,
  leftTruncate: boolean = false,
): string {
  if (text.length <= maxLength) return text;

  if (leftTruncate) {
    return "..." + text.slice(text.length - maxLength + 3);
  } else {
    return text.slice(0, maxLength - 3) + "...";
  }
}

/**
 * Helper function to create search highlight element
 */
function createSearchHighlightDiv(
  text: string,
  match: boolean,
  isCurrent: boolean,
  baseStyle: React.CSSProperties,
): React.ReactNode {
  // Import search highlight colors for consistency with graph nodes
  const searchColors = {
    match: {
      background: "#fbbf24", // amber-400 - same as StandardNode
      border: "#f59e0b", // amber-500
      text: "#000000",
    },
    current: {
      background: "#f97316", // orange-500 - same as StandardNode
      border: "#ea580c", // orange-600
      text: "#ffffff",
    },
  };

  return (
    <div
      style={
        match
          ? {
              backgroundColor: isCurrent
                ? searchColors.current.background
                : searchColors.match.background,
              borderRadius: 4,
              padding: "2px 4px",
              margin: "-1px -2px",
              fontWeight: isCurrent ? "600" : "500",
              border: `1px solid ${isCurrent ? searchColors.current.border : searchColors.match.border}`,
              color: isCurrent
                ? searchColors.current.text
                : searchColors.match.text,
              ...baseStyle,
            }
          : baseStyle
      }
    >
      {text}
    </div>
  );
}

/**
 * Helper function to create container display title
 */
function createContainerDisplayTitle(
  truncatedLabel: string,
  _hasChildren: boolean,
  hasLeafChildren: boolean,
  _childrenCount: number,
  leafChildrenCount: number,
  match: boolean,
  isCurrent: boolean,
  showNodeCounts: boolean,
): React.ReactNode {
  const countText =
    showNodeCounts && hasLeafChildren ? ` (${leafChildrenCount})` : "";

  return (
    <div
      style={
        match
          ? {
              backgroundColor: isCurrent
                ? "rgba(255,107,53,0.35)"
                : "rgba(251,191,36,0.28)",
              borderRadius: 4,
              padding: "2px 4px",
              margin: "-1px -2px",
              fontWeight: isCurrent ? "600" : "500",
              border: isCurrent
                ? "1px solid rgba(255,107,53,0.4)"
                : "1px solid rgba(251,191,36,0.3)",
            }
          : {}
      }
    >
      <span style={{ fontWeight: 500 }}>
        {truncatedLabel}
        {countText && (
          <span style={{ fontSize: "10px", opacity: 0.75, fontWeight: 400 }}>
            {countText}
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * Generate tree data structure optimized for HierarchyTree rendering
 * This function handles all UI formatting concerns for the Ant Design Tree
 */
function getTreeDataStructure(
  visualizationState: VisualizationState,
  collapsedContainers: Set<string>,
  searchMatches?: Array<{
    id: string;
    label: string;
    type: "container" | "node";
    matchIndices?: number[][];
  }>,
  currentSearchMatch?: { id: string } | undefined,
  truncateLabels: boolean = true,
  maxLabelLength: number = 20,
  showNodeCounts: boolean = true,
): TreeDataNode[] {
  // Build hierarchy tree structure from VisualizationState
  const hierarchyTree = buildHierarchyTreeFromState(visualizationState);

  const convertToTreeData = (nodes: HierarchyTreeNode[]): TreeDataNode[] => {
    return nodes.map((node) => {
      // Get container data using VisualizationState accessors
      const containerData = visualizationState?.getContainer(node.id);
      const containerLabel = containerData?.label || `Container ${node.id}`;

      // Get leaf node count using available v6 methods
      const containerNodes =
        visualizationState?.getContainerNodes(node.id) || new Set();
      const leafChildrenCount = containerNodes.size;

      // Get container metadata for shortLabel (simplified since data structure is different in v6)
      const containerShortLabel = containerData?.label;

      const labelToUse = containerShortLabel || containerLabel;
      const truncatedLabel = truncateLabels
        ? truncateHierarchyLabel(labelToUse, maxLabelLength, true)
        : labelToUse;

      // Get leaf nodes using available v6 methods
      const leafNodeIds = Array.from(containerNodes);
      const leafNodes = leafNodeIds
        .map((id) => visualizationState?.getGraphNode(id))
        .filter(Boolean) as GraphNode[];

      const hasChildren = node.children && node.children.length > 0;
      const hasLeafChildren = leafChildrenCount > 0;
      const isCollapsed = collapsedContainers.has(node.id);

      // For collapsed containers that have content, add a virtual child to show the expand icon
      // For expanded containers, show real children AND actual leaf nodes
      let children: TreeDataNode[] | undefined = undefined;

      if (hasChildren) {
        // Container has child containers - recurse and add leaf nodes if expanded
        children = convertToTreeData(node.children);
        if (!isCollapsed && hasLeafChildren) {
          // Add actual leaf nodes when expanded
          const leafTreeNodes = leafNodes.map((leafNode: GraphNode) => {
            const match = searchMatches?.some(
              (m) => m.id === leafNode.id && m.type === "node",
            )
              ? true
              : false;
            const isCurrent = !!(
              currentSearchMatch && currentSearchMatch.id === leafNode.id
            );

            return {
              key: leafNode.id,
              title: createSearchHighlightDiv(
                truncateLabels
                  ? truncateHierarchyLabel(
                      leafNode.label,
                      maxLabelLength - 2,
                      true,
                    )
                  : leafNode.label,
                match,
                isCurrent,
                { fontSize: "11px", opacity: 0.8 },
              ),
              isLeaf: true,
              data: {
                isGraphNode: true,
                originalLabel: leafNode.label,
                fullLabel: leafNode.longLabel,
                shortLabel: leafNode.label,
              },
            };
          });
          children = [...children, ...leafTreeNodes];
        }
      } else if (hasLeafChildren) {
        // Container has only leaf nodes
        if (isCollapsed) {
          // Add virtual child to show expand icon
          children = [
            {
              key: `${node.id}__virtual__`,
              title: `Loading...`, // This should never be visible
              isLeaf: true,
              style: { display: "none" }, // Hide the virtual child
            },
          ];
        } else {
          // Expanded - show actual leaf nodes
          children = leafNodes.map((leafNode: GraphNode) => {
            const match = searchMatches?.some(
              (m) => m.id === leafNode.id && m.type === "node",
            )
              ? true
              : false;
            const isCurrent = !!(
              currentSearchMatch && currentSearchMatch.id === leafNode.id
            );

            return {
              key: leafNode.id,
              title: createSearchHighlightDiv(
                truncateLabels
                  ? truncateHierarchyLabel(
                      leafNode.label,
                      maxLabelLength - 2,
                      true,
                    )
                  : leafNode.label,
                match,
                isCurrent,
                { fontSize: "11px", opacity: 0.8 },
              ),
              isLeaf: true,
              data: {
                isGraphNode: true,
                originalLabel: leafNode.label,
                fullLabel: leafNode.longLabel,
                shortLabel: leafNode.label,
              },
            };
          });
        }
      }

      // Create display title with better formatting + optional search highlight
      const match = searchMatches?.some((m) => m.id === node.id) ? true : false;
      const isCurrent = !!(
        currentSearchMatch && currentSearchMatch.id === node.id
      );

      const displayTitle = createContainerDisplayTitle(
        truncatedLabel,
        hasChildren,
        hasLeafChildren,
        node.children.length,
        leafChildrenCount,
        match,
        isCurrent,
        showNodeCounts,
      );

      return {
        key: node.id,
        title: displayTitle,
        children: children,
        isLeaf: !hasChildren && !hasLeafChildren, // Only true leaf nodes (no children at all)
        // Add custom properties for styling
        data: {
          originalLabel: labelToUse,
          truncatedLabel,
          nodeCount: leafChildrenCount,
          leafChildrenCount,
          hasLeafChildren: hasLeafChildren && !hasChildren,
          isContainer: hasChildren,
        },
      };
    });
  };

  return convertToTreeData(hierarchyTree || []);
}

export function HierarchyTree({
  collapsedContainers = new Set(),
  onToggleContainer,
  layoutOrchestrator,
  asyncCoordinator,
  title = "Container Hierarchy",
  showNodeCounts = true,
  truncateLabels = true,
  maxLabelLength = 20,
  className = "",
  style,
  visualizationState,
  // optional search wiring
  searchQuery,
  searchMatches,
  currentSearchMatch,
}: HierarchyTreeProps & {
  searchQuery?: string;
  searchMatches?: Array<{
    id: string;
    label: string;
    type: "container" | "node";
    matchIndices?: number[][];
  }>;
  currentSearchMatch?: { id: string } | undefined;
}) {
  // ✅ EFFICIENT: Use VisualizationState's optimized search expansion logic with stable dependencies
  const derivedExpandedKeys = useMemo(() => {
    if (!visualizationState || !searchMatches || searchMatches.length === 0) {
      return [];
    }

    // Simple search expansion logic for v6
    const currentCollapsed = new Set(collapsedContainers);
    const expansionKeys = new Set<string>();

    // For each search match, expand its container hierarchy
    searchMatches.forEach((match) => {
      if (match.type === "container") {
        // Expand ancestors of matched containers
        const ancestors =
          visualizationState?.getContainerAncestors(match.id) || [];
        ancestors.forEach((ancestorId) => expansionKeys.add(ancestorId));
      }
    });

    return Array.from(expansionKeys);
  }, [visualizationState, searchMatches, collapsedContainers]);

  // Maintain a controlled expandedKeys state for immediate UI feedback on arrow clicks
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);

  // Track the last search expansion to prevent duplicate operations
  const lastSearchExpansionRef = useRef<string>("");
  const searchExpansionInProgressRef = useRef<boolean>(false);

  // Sync local expanded state whenever the derived value changes (e.g., collapse/expand in vis, search)
  useEffect(() => {
    setExpandedKeys(derivedExpandedKeys);

    // During search, expand containers that are ancestors of matches (including node matches)
    // Add debouncing to prevent excessive operations
    if (
      searchQuery &&
      searchQuery.trim() &&
      searchMatches &&
      searchMatches.length &&
      onToggleContainer
    ) {
      // Create a stable key for this search expansion to prevent duplicates
      const searchKey = `${searchQuery.trim()}-${searchMatches
        .map((m) => m.id)
        .sort()
        .join(",")}`;

      // Skip if we've already processed this exact search expansion
      if (lastSearchExpansionRef.current === searchKey) {
        return;
      }

      // Skip if a search expansion is already in progress
      if (searchExpansionInProgressRef.current) {
        console.error(
          `[HierarchyTree] 🚫 Skipping search expansion - already in progress`,
        );
        return;
      }

      lastSearchExpansionRef.current = searchKey;
      searchExpansionInProgressRef.current = true;

      // For both container matches and node matches, expand the containers to make them visible
      // This includes expanding matched containers themselves and their ancestors
      const shouldBeExpanded = new Set(
        derivedExpandedKeys.map((k: string) => String(k)),
      );
      const currentlyCollapsed = collapsedContainers;

      // Collect all containers that need to be toggled
      const containersToToggle: string[] = [];

      console.error(
        `[HierarchyTree] 🔍 Search expansion: shouldBeExpanded (${shouldBeExpanded.size}):`,
        Array.from(shouldBeExpanded).slice(0, 10).join(", "),
        shouldBeExpanded.size > 10 ? "..." : "",
      );
      console.error(
        `[HierarchyTree] 🔍 Search expansion: currentlyCollapsed (${currentlyCollapsed.size}):`,
        Array.from(currentlyCollapsed).join(", "),
      );

      currentlyCollapsed.forEach((containerId) => {
        if (shouldBeExpanded.has(containerId)) {
          containersToToggle.push(containerId);
        }
      });

      // CRITICAL FIX: For search expansion, also include containers that should be expanded
      // but are not in the collapsed set (they might be hidden child containers)
      if (
        searchQuery &&
        searchQuery.trim() &&
        searchMatches &&
        searchMatches.length > 0
      ) {
        shouldBeExpanded.forEach((containerId: string) => {
          if (
            !currentlyCollapsed.has(containerId) &&
            !containersToToggle.includes(containerId)
          ) {
            // Check if this container exists and is collapsed (but not tracked in currentlyCollapsed)
            const container = visualizationState?.getContainer(containerId);
            if (container && container.collapsed) {
              containersToToggle.push(containerId);
              console.error(
                `[HierarchyTree] 🔧 Adding missing collapsed container: ${containerId}`,
              );
            }
          }
        });
      }

      // CRITICAL FIX: Sort containers by hierarchy depth to expand parents before children
      // This prevents validation infinite loops caused by expanding children before parents
      containersToToggle.sort((a, b) => {
        const getHierarchyDepth = (containerId: string): number => {
          let depth = 0;
          let currentId = containerId;
          const visited = new Set<string>();

          while (currentId && !visited.has(currentId)) {
            visited.add(currentId);
            const container = visualizationState?.getContainer(currentId);
            if (!container) break;

            const parentId = visualizationState?.getContainerParent(currentId);
            if (!parentId) break;

            currentId = parentId;
            depth++;
          }
          return depth;
        };

        return getHierarchyDepth(a) - getHierarchyDepth(b);
      });

      console.error(
        `[HierarchyTree] 🔄 Search expansion: containersToToggle (${containersToToggle.length}) [SORTED BY DEPTH]:`,
        containersToToggle.join(", "),
      );

      // Use LayoutOrchestrator for coordinated search expansion
      if (containersToToggle.length > 0) {
        console.error(
          `[HierarchyTree] 🚀 Executing search expansion for ${containersToToggle.length} containers`,
        );

        if (layoutOrchestrator) {
          // CRITICAL: Use proper operation coordination and clear flag when done
          layoutOrchestrator
            .expandForSearch(containersToToggle, searchQuery || "")
            .then(() => {
              searchExpansionInProgressRef.current = false;
            })
            .catch((error: unknown) => {
              console.warn(
                `[HierarchyTree] LayoutOrchestrator search expansion failed: ${error}`,
              );
              searchExpansionInProgressRef.current = false;
            });
        } else {
          // Fallback to individual toggles if LayoutOrchestrator not available
          containersToToggle.forEach((containerId) => {
            if (onToggleContainer) {
              onToggleContainer(containerId);
            }
          });
          searchExpansionInProgressRef.current = false;
        }
      }
    } else if (
      (!searchQuery ||
        !searchQuery.trim() ||
        !searchMatches ||
        !searchMatches.length) &&
      onToggleContainer
    ) {
      // Clear the search expansion ref when search is cleared
      lastSearchExpansionRef.current = "";
      searchExpansionInProgressRef.current = false;

      // When not searching, sync normally
      const shouldBeExpanded = new Set(
        derivedExpandedKeys.map((k: string) => String(k)),
      );
      const currentlyCollapsed = collapsedContainers;

      // Collect containers that need to be toggled
      const containersToToggle: string[] = [];
      currentlyCollapsed.forEach((containerId) => {
        if (shouldBeExpanded.has(containerId)) {
          containersToToggle.push(containerId);
        }
      });

      // Batch container toggle operations to prevent ResizeObserver loops
      if (containersToToggle.length > 0) {
        // Use the same synchronous approach for consistency
        const operationId = `hierarchy-sync-${Date.now()}`;

        // Use AsyncCoordinator for v6 architecture if available
        if (asyncCoordinator && visualizationState) {
          // Toggle each container through AsyncCoordinator
          Promise.all(
            containersToToggle.map(async (containerId) => {
              const container = visualizationState.getContainer(containerId);
              if (container) {
                if (container.collapsed) {
                  return asyncCoordinator.expandContainer(
                    containerId,
                    visualizationState,
                    { triggerLayout: false },
                  );
                } else {
                  return asyncCoordinator.collapseContainer(
                    containerId,
                    visualizationState,
                    { triggerLayout: false },
                  );
                }
              }
            }),
          )
            .then(() => {
              // Note: Layout updates should be triggered separately by the parent component
              // as per v6 architecture design
            })
            .catch((error: unknown) => {
              console.warn(`[HierarchyTree] Hierarchy sync failed: ${error}`);
            });
        } else {
          // Fallback to direct operations
          for (const containerId of containersToToggle) {
            onToggleContainer?.(containerId);
          }
        }
      }
    }
  }, [
    derivedExpandedKeys,
    searchQuery,
    searchMatches,
    collapsedContainers,
    onToggleContainer,
    layoutOrchestrator,
    visualizationState,
  ]);

  const treeData = useMemo(() => {
    if (!visualizationState) return [];
    return getTreeDataStructure(
      visualizationState,
      collapsedContainers,
      searchMatches,
      currentSearchMatch,
      truncateLabels,
      maxLabelLength,
      showNodeCounts,
    );
  }, [
    visualizationState,
    collapsedContainers,
    searchMatches,
    currentSearchMatch,
    truncateLabels,
    maxLabelLength,
    showNodeCounts,
  ]);

  const handleExpand = (
    nextExpandedKeys: React.Key[],
    info: { node: TreeDataNode },
  ) => {
    // Update UI immediately
    setExpandedKeys(nextExpandedKeys);
    // Then toggle corresponding container in the visualization (batched to prevent ResizeObserver loops)
    if (onToggleContainer && info.node) {
      const nodeKey = info.node.key as string;
      // Check if we're expanding or collapsing by comparing current state
      const wasExpanded = expandedKeys.includes(nodeKey);
      const isNowExpanded = nextExpandedKeys.includes(nodeKey);

      // Only call onToggleContainer if the state actually changed
      if (wasExpanded !== isNowExpanded) {
        // Execute synchronously to prevent race conditions with layout operations
        onToggleContainer(nodeKey);
      }
    }
  };

  const handleSelect = (
    _selectedKeys: React.Key[],
    info: { node: TreeDataNode },
  ) => {
    if (onToggleContainer && info.node) {
      const nodeKey = info.node.key as string;
      // Execute synchronously to prevent race conditions with layout operations
      onToggleContainer(nodeKey);
    }
  };

  // Check if we have any containers to display
  if (
    !visualizationState ||
    visualizationState.visibleContainers.length === 0
  ) {
    return (
      <div className={`hierarchy-tree-empty ${className}`} style={style}>
        <span
          style={{
            color: COMPONENT_COLORS.TEXT_DISABLED,
            fontSize: TYPOGRAPHY.INFOPANEL_HIERARCHY_DETAILS,
            fontStyle: "italic",
          }}
        >
          No hierarchy available
        </span>
      </div>
    );
  }

  return (
    <div className={`hierarchy-tree ${className}`} style={style}>
      {title && (
        <div
          style={{
            fontSize: TYPOGRAPHY.INFOPANEL_HIERARCHY_NODE,
            fontWeight: "bold",
            color: COMPONENT_COLORS.TEXT_PRIMARY,
            marginBottom: "8px",
            paddingBottom: "4px",
            borderBottom: `1px solid ${COMPONENT_COLORS.BORDER_LIGHT}`,
          }}
        >
          {title}
        </div>
      )}

      <style>
        {`
          /* Hide virtual children in the tree */
          .ant-tree-treenode[data-key*="__virtual__"] {
            display: none !important;
          }
        `}
      </style>

      <Tree
        key={Array.from(collapsedContainers).sort().join(",")}
        treeData={treeData}
        expandedKeys={expandedKeys}
        onExpand={handleExpand}
        onSelect={handleSelect}
        showLine={false}
        showIcon={false}
        blockNode
        style={{
          fontSize: TYPOGRAPHY.INFOPANEL_HIERARCHY_NODE,
          color: COMPONENT_COLORS.TEXT_PRIMARY,
          backgroundColor: "transparent",
          // Ensure proper rendering in Card layout
          minHeight: "20px",
          width: "100%",
        }}
        // Enhanced styling through CSS variables for better hierarchy
        rootStyle={
          {
            "--antd-tree-node-hover-bg":
              COMPONENT_COLORS.BUTTON_HOVER_BACKGROUND,
            "--antd-tree-node-selected-bg":
              COMPONENT_COLORS.BUTTON_HOVER_BACKGROUND,
            "--antd-tree-indent-size": "16px", // Reduce indent for better space usage
            "--antd-tree-node-padding": "2px 4px", // Better padding
            width: "100%",
            overflow: "visible",
          } as React.CSSProperties
        }
      />
    </div>
  );
}
