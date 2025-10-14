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
import {
  TYPOGRAPHY,
  COMPONENT_COLORS,
  SEARCH_HIGHLIGHT_COLORS,
  SEARCH_CURRENT_COLORS,
} from "../shared/config";
import type { VisualizationState } from "../core/VisualizationState";
// import type { AsyncCoordinator } from "../core/AsyncCoordinator";
import type { Container } from "../shared/types";
import type { GraphNode, SearchResult } from "../types/core";
import {
  toggleContainerImperatively,
  clearContainerOperationDebouncing,
} from "../utils/containerOperationUtils.js";
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
 * Helper function to create search highlight element with proper color constants
 */
function createSearchHighlightDiv(
  text: string,
  match: boolean,
  isCurrent: boolean,
  baseStyle: React.CSSProperties,
): React.ReactNode {
  return (
    <div
      style={
        match
          ? {
              backgroundColor: isCurrent
                ? SEARCH_CURRENT_COLORS.backgroundColor
                : SEARCH_HIGHLIGHT_COLORS.backgroundColor,
              borderRadius: 4,
              padding: "2px 4px",
              margin: "-1px -2px",
              fontWeight: isCurrent ? "600" : "500",
              border: `1px solid ${isCurrent ? SEARCH_CURRENT_COLORS.border : SEARCH_HIGHLIGHT_COLORS.border}`,
              color: isCurrent ? "#ffffff" : "#000000",
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
 * Helper function to check if a container has matching descendants in search results
 */
function hasMatchingDescendants(
  containerId: string,
  searchResults: SearchResult[],
  visualizationState: VisualizationState,
): boolean {
  // Check if any search result is a descendant of this container
  return searchResults.some((result) => {
    if (result.type === "node") {
      // Check if this node is contained within the container
      const nodeContainer = visualizationState.getNodeContainer(result.id);
      if (nodeContainer === containerId) return true;
      // Check if the node's container is a descendant of this container
      if (nodeContainer) {
        const ancestors =
          visualizationState.getContainerAncestors(nodeContainer);
        return ancestors.includes(containerId);
      }
    } else if (result.type === "container") {
      // Check if this container is a descendant
      const ancestors = visualizationState.getContainerAncestors(result.id);
      return ancestors.includes(containerId);
    }
    return false;
  });
}
/**
 * Helper function to create container display title with enhanced search highlighting
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
  hasCollapsedMatchingDescendants: boolean = false,
): React.ReactNode {
  const countText =
    showNodeCounts && hasLeafChildren ? ` (${leafChildrenCount})` : "";
  // Determine highlight style based on match type
  let highlightStyle: React.CSSProperties = {};
  if (match) {
    // Direct match - use full highlight
    highlightStyle = {
      backgroundColor: isCurrent
        ? SEARCH_CURRENT_COLORS.backgroundColor
        : SEARCH_HIGHLIGHT_COLORS.backgroundColor,
      borderRadius: 4,
      padding: "2px 4px",
      margin: "-1px -2px",
      fontWeight: isCurrent ? "600" : "500",
      border: `1px solid ${isCurrent ? SEARCH_CURRENT_COLORS.border : SEARCH_HIGHLIGHT_COLORS.border}`,
    };
  } else if (hasCollapsedMatchingDescendants) {
    // Collapsed ancestor containing matches - use subtle highlight
    highlightStyle = {
      backgroundColor: `${SEARCH_HIGHLIGHT_COLORS.backgroundColor}20`, // 20% opacity
      borderRadius: 4,
      padding: "2px 4px",
      margin: "-1px -2px",
      fontWeight: "500",
      border: `1px solid ${SEARCH_HIGHLIGHT_COLORS.border}40`, // 40% opacity
    };
  }
  return (
    <div style={highlightStyle}>
      <span
        style={{
          fontWeight: match
            ? isCurrent
              ? 600
              : 500
            : hasCollapsedMatchingDescendants
              ? 500
              : 400,
        }}
      >
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
  searchResults?: SearchResult[],
  currentSearchResult?: SearchResult,
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
      // Get leaf node count using available v1.0.0 methods
      const containerNodes =
        visualizationState?.getContainerNodes(node.id) || new Set();
      const leafChildrenCount = containerNodes.size;
      // Get container metadata for shortLabel (simplified since data structure is different in v1.0.0)
      const containerShortLabel = containerData?.label;
      const labelToUse = containerShortLabel || containerLabel;
      const truncatedLabel = truncateLabels
        ? truncateHierarchyLabel(labelToUse, maxLabelLength, true)
        : labelToUse;
      // Get leaf nodes using available v1.0.0 methods
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
            const match =
              searchResults?.some(
                (result) => result.id === leafNode.id && result.type === "node",
              ) ?? false;
            const isCurrent = !!(
              currentSearchResult && currentSearchResult.id === leafNode.id
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
            const match =
              searchResults?.some(
                (result) => result.id === leafNode.id && result.type === "node",
              ) ?? false;
            const isCurrent = !!(
              currentSearchResult && currentSearchResult.id === leafNode.id
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
      // Check for search matches
      const match =
        searchResults?.some((result) => result.id === node.id) ?? false;
      const isCurrent = !!(
        currentSearchResult && currentSearchResult.id === node.id
      );
      // Check if this collapsed container has matching descendants
      const hasCollapsedMatchingDescendants =
        isCollapsed && searchResults
          ? hasMatchingDescendants(node.id, searchResults, visualizationState)
          : false;
      const displayTitle = createContainerDisplayTitle(
        truncatedLabel,
        hasChildren,
        hasLeafChildren,
        node.children.length,
        leafChildrenCount,
        match,
        isCurrent,
        showNodeCounts,
        hasCollapsedMatchingDescendants,
      );
      return {
        key: node.id,
        title: displayTitle,
        children: children,
        isLeaf: !hasChildren && !hasLeafChildren, // Only true leaf nodes (no children at all)
        // Add custom className for collapsed containers with matching descendants
        className: hasCollapsedMatchingDescendants
          ? "search-match-ancestor"
          : undefined,
        // Add custom properties for styling
        data: {
          originalLabel: labelToUse,
          truncatedLabel,
          nodeCount: leafChildrenCount,
          leafChildrenCount,
          hasLeafChildren: hasLeafChildren && !hasChildren,
          isContainer: hasChildren,
          hasCollapsedMatchingDescendants,
        },
      };
    });
  };
  return convertToTreeData(hierarchyTree || []);
}
export function HierarchyTree({
  collapsedContainers = new Set(),
  onToggleContainer,
  onElementNavigation,
  layoutOrchestrator,
  asyncCoordinator,
  title = "Container Hierarchy",
  showNodeCounts = true,
  truncateLabels = true,
  maxLabelLength = 20,
  className = "",
  style,
  visualizationState,
  // Enhanced search integration props
  searchQuery,
  searchResults,
  currentSearchResult,
  onTreeExpansion: _onTreeExpansion,
  syncEnabled = true,
}: HierarchyTreeProps) {
  // ✅ EFFICIENT: Use VisualizationState's optimized search expansion logic with stable dependencies
  const derivedExpandedKeys = useMemo(() => {
    if (!visualizationState) {
      return [];
    }
    // When search is cleared, preserve current expansion state instead of collapsing
    if (!searchResults || searchResults.length === 0) {
      // Return current expanded containers from VisualizationState
      const currentlyExpanded = visualizationState.visibleContainers
        .filter((container) => !container.collapsed)
        .map((container) => container.id);
      return currentlyExpanded;
    }
    // Enhanced search expansion logic for v1.0.0
    const expansionKeys = new Set<string>();
    // For each search result, expand its container hierarchy
    searchResults.forEach((result) => {
      if (result.type === "container") {
        // Expand ancestors of matched containers
        const ancestors =
          visualizationState.getContainerAncestors(result.id) || [];
        ancestors.forEach((ancestorId) => expansionKeys.add(ancestorId));
      } else if (result.type === "node") {
        // For node matches, expand the container hierarchy to make the node visible
        const nodeContainer = visualizationState.getNodeContainer(result.id);
        if (nodeContainer) {
          // Expand the direct container
          expansionKeys.add(nodeContainer);
          // Expand all ancestors of the container
          const ancestors =
            visualizationState.getContainerAncestors(nodeContainer) || [];
          ancestors.forEach((ancestorId) => expansionKeys.add(ancestorId));
        }
      }
    });
    return Array.from(expansionKeys);
  }, [visualizationState, searchResults]);
  // Maintain a controlled expandedKeys state for immediate UI feedback on arrow clicks
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  // Track the last search expansion to prevent duplicate operations
  const lastSearchExpansionRef = useRef<string>("");
  const searchExpansionInProgressRef = useRef<boolean>(false);

  // Cleanup debounced operations on unmount
  useEffect(() => {
    return () => {
      clearContainerOperationDebouncing();
    };
  }, []);
  // Sync local expanded state whenever the derived value changes (e.g., collapse/expand in vis, search)
  useEffect(() => {
    setExpandedKeys(derivedExpandedKeys);
    // During search, expand containers that are ancestors of matches (including node matches)
    // Add debouncing to prevent excessive operations
    if (
      searchQuery &&
      searchQuery.trim() &&
      searchResults &&
      searchResults.length &&
      onToggleContainer
    ) {
      // Create a stable key for this search expansion to prevent duplicates
      const searchKey = `${searchQuery.trim()}-${searchResults
        .map((result) => result.id)
        .sort()
        .join(",")}`;
      // Skip if we've already processed this exact search expansion
      if (lastSearchExpansionRef.current === searchKey) {
        return;
      }
      // Skip if a search expansion is already in progress
      if (searchExpansionInProgressRef.current) {
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
        searchResults &&
        searchResults.length > 0
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
      // Use LayoutOrchestrator for coordinated search expansion
      if (containersToToggle.length > 0) {
        if (
          layoutOrchestrator &&
          "expandForSearch" in layoutOrchestrator &&
          typeof layoutOrchestrator.expandForSearch === "function"
        ) {
          // CRITICAL: Use proper operation coordination and clear flag when done
          (layoutOrchestrator as any)
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
          // Fallback to imperative utilities if LayoutOrchestrator not available
          containersToToggle.forEach((containerId) => {
            const success = toggleContainerImperatively({
              containerId,
              visualizationState,
              forceExpanded: true, // Search expansion always expands
              debounce: false, // Don't debounce search expansion
              debug: false,
            });

            // Final fallback to onToggleContainer if imperative operation fails
            if (!success && onToggleContainer) {
              onToggleContainer(containerId);
            }
          });
          searchExpansionInProgressRef.current = false;
        }
      }
    } else if (
      (!searchQuery ||
        !searchQuery.trim() ||
        !searchResults ||
        !searchResults.length) &&
      onToggleContainer &&
      syncEnabled
    ) {
      // Clear the search expansion ref when search is cleared
      lastSearchExpansionRef.current = "";
      searchExpansionInProgressRef.current = false;
      // When not searching and sync is enabled, sync normally
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
        const _operationId = `hierarchy-sync-${Date.now()}`;
        // Use imperative operations to avoid coordination cascades
        if (visualizationState) {
          // Use imperative utilities for all container operations
          for (const containerId of containersToToggle) {
            const success = toggleContainerImperatively({
              containerId,
              visualizationState,
              debounce: false, // Don't debounce sync operations
              debug: false,
            });

            if (!success) {
              console.warn(
                `[HierarchyTree] Failed to toggle container ${containerId} imperatively`,
              );
            }
          }
        } else {
          // Fallback to imperative operations
          for (const containerId of containersToToggle) {
            const success = toggleContainerImperatively({
              containerId,
              visualizationState,
              debounce: false, // Don't debounce sync operations
              debug: false,
            });

            // Final fallback to onToggleContainer if imperative operation fails
            if (!success) {
              onToggleContainer?.(containerId);
            }
          }
        }
      }
    }
  }, [
    derivedExpandedKeys,
    searchQuery,
    searchResults,
    collapsedContainers,
    onToggleContainer,
    layoutOrchestrator,
    visualizationState,
    asyncCoordinator,
    syncEnabled,
  ]);
  const treeData = useMemo(() => {
    if (!visualizationState) return [];
    return getTreeDataStructure(
      visualizationState,
      collapsedContainers,
      searchResults,
      currentSearchResult,
      truncateLabels,
      maxLabelLength,
      showNodeCounts,
    );
  }, [
    visualizationState,
    collapsedContainers,
    searchResults,
    currentSearchResult,
    truncateLabels,
    maxLabelLength,
    showNodeCounts,
  ]);
  const handleExpand = (
    nextExpandedKeys: React.Key[],
    info: {
      node: TreeDataNode;
    },
  ) => {
    // Update UI immediately
    setExpandedKeys(nextExpandedKeys);
    // Then toggle corresponding container in the visualization using imperative utilities
    if (info.node && visualizationState) {
      const nodeKey = info.node.key as string;
      // Check if we're expanding or collapsing by comparing current state
      const wasExpanded = expandedKeys.includes(nodeKey);
      const isNowExpanded = nextExpandedKeys.includes(nodeKey);
      // Only toggle if the state actually changed
      if (wasExpanded !== isNowExpanded) {
        // Use imperative container operations with debouncing for rapid interactions
        const success = toggleContainerImperatively({
          containerId: nodeKey,
          visualizationState,
          forceExpanded: isNowExpanded,
          debounce: true, // Enable debouncing for rapid tree interactions
          debug: false,
        });

        // Fallback to onToggleContainer if imperative operation fails
        if (!success && onToggleContainer) {
          onToggleContainer(nodeKey);
        }
      }
    }
  };
  const handleSelect = (
    _selectedKeys: React.Key[],
    info: {
      node: TreeDataNode;
    },
  ) => {
    if (info.node) {
      const nodeKey = info.node.key as string;
      // Check if this is a graph node (leaf) or container
      const isGraphNode = (info.node as any).data?.isGraphNode;
      if (isGraphNode) {
        // This is a leaf node - trigger navigation if callback is provided
        if (onElementNavigation) {
          onElementNavigation(nodeKey, "node");
        }
      } else {
        // This is a container - trigger navigation if callback is provided
        if (onElementNavigation) {
          onElementNavigation(nodeKey, "container");
        }
        // Note: Don't fallback to toggle behavior to avoid conflicting with navigation
        // The parent component should handle both navigation and expansion separately
      }
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
          
          /* Highlight caret icons for collapsed containers with search matches */
          .ant-tree-treenode .ant-tree-switcher.search-match-ancestor {
            background-color: ${SEARCH_HIGHLIGHT_COLORS.backgroundColor}40 !important;
            border-radius: 3px;
            border: 1px solid ${SEARCH_HIGHLIGHT_COLORS.border}60;
          }
          
          .ant-tree-treenode .ant-tree-switcher.search-match-ancestor .ant-tree-switcher-icon {
            color: ${SEARCH_HIGHLIGHT_COLORS.border} !important;
            font-weight: bold;
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
