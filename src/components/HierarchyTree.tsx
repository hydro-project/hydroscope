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
import { Tree, Spin } from "antd";
import { EyeOutlined, EyeInvisibleOutlined } from "@ant-design/icons";
import type { TreeDataNode } from "antd";
import { HierarchyTreeProps, HierarchyTreeNode } from "./types";
import {
  TYPOGRAPHY,
  COMPONENT_COLORS,
  SEARCH_HIGHLIGHT_COLORS,
  SEARCH_CURRENT_COLORS,
} from "../shared/config";
import { getHighlightColor } from "../shared/colorUtils";
import type { VisualizationState } from "../core/VisualizationState";
// import type { AsyncCoordinator } from "../core/AsyncCoordinator";
import type { Container } from "../shared/types";
import type { GraphNode, SearchResult } from "../types/core";
import { clearContainerOperationDebouncing } from "../utils/containerOperationUtils.js";
// ============ TREE DATA FORMATTING UTILITIES ============
/**
 * Build hierarchy tree structure from VisualizationState
 * This replaces the redundant hierarchyTree prop that was being passed from InfoPanel
 */
function buildHierarchyTreeFromState(
  visualizationState: VisualizationState,
): HierarchyTreeNode[] {
  // Use allContainers instead of visibleContainers to show hidden items with closed eye icons
  const allContainers = visualizationState.allContainers;
  if (!visualizationState || allContainers.length === 0) return [];
  const buildNode = (containerId: string): HierarchyTreeNode => {
    // Use efficient O(1) lookups instead of scanning
    const childrenIds: string[] = [];
    const containerChildren =
      visualizationState.getContainerChildren(containerId);
    containerChildren?.forEach((childId: string) => {
      if (visualizationState.getContainer(childId)) childrenIds.push(childId);
    });
    const children: HierarchyTreeNode[] = childrenIds.map(buildNode);
    const hasTemporaryHighlight =
      visualizationState.hasTemporaryHighlight(containerId);
    return { id: containerId, children, hasTemporaryHighlight };
  };
  // Get top-level containers (those without parents) - include all containers, not just visible ones
  const rootContainers = allContainers.filter(
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
  hasTemporaryHighlight: boolean = false,
  palette: string = "Set3",
  isManuallyHidden: boolean = false,
  onToggleVisibility?: (e: React.MouseEvent) => void,
  containerId?: string,
  longLabel?: string,
): React.ReactNode {
  let style: React.CSSProperties = baseStyle;

  // Start with search match background if applicable
  if (match) {
    style = {
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
    };
  }

  // Layer temporary highlight glow on top (if present)
  if (hasTemporaryHighlight) {
    // Temporary glow effect after click - synced with graph glow
    // Use palette-aware contrasting color
    const highlightColor = getHighlightColor(palette);
    style = {
      ...style, // Keep existing background (search highlight)
      borderRadius: 4,
      padding: "2px 4px",
      margin: "-1px -2px",
      fontWeight: "600",
      border: `2px solid ${highlightColor.border}`,
      boxShadow: `0 0 20px 4px ${highlightColor.glow}, inset 0 0 20px 2px ${highlightColor.glow.replace("0.8", "0.3")}`,
      animation: "treeGlowPulse 2s ease-in-out",
      ...baseStyle,
    };
  }

  return (
    <div
      style={{ ...style, display: "flex", alignItems: "center", gap: "6px" }}
      data-container-id={containerId}
    >
      {/* Eye icon toggle */}
      {onToggleVisibility && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility(e);
          }}
          style={{
            cursor: "pointer",
            fontSize: "13px",
            opacity: 0.7,
            userSelect: "none",
            transition: "opacity 0.15s",
            display: "flex",
            alignItems: "center",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0.7";
          }}
          title={
            isManuallyHidden
              ? "Show in graph (currently hidden)"
              : "Hide from graph (Shift+click to hide all others)"
          }
        >
          {isManuallyHidden ? <EyeInvisibleOutlined /> : <EyeOutlined />}
        </span>
      )}
      <span
        style={{
          opacity: isManuallyHidden ? 0.4 : 1,
          color: isManuallyHidden ? "#999" : "inherit",
          pointerEvents: isManuallyHidden ? "none" : "auto",
        }}
        title={longLabel || text}
      >
        {text}
      </span>
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
  hasTemporaryHighlight: boolean = false,
  palette: string = "Set3",
  isManuallyHidden: boolean = false,
  onToggleVisibility?: (e: React.MouseEvent) => void,
  containerId?: string,
  longLabel?: string,
): React.ReactNode {
  const countText =
    showNodeCounts && hasLeafChildren ? ` (${leafChildrenCount})` : "";
  // Determine highlight style based on match type
  let highlightStyle: React.CSSProperties = {};

  // Start with search match background if applicable
  if (match) {
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

  // Layer temporary highlight glow on top (if present)
  if (hasTemporaryHighlight) {
    // Temporary glow effect after click - synced with graph glow
    // Use palette-aware contrasting color
    const highlightColor = getHighlightColor(palette);
    highlightStyle = {
      ...highlightStyle, // Keep existing background (search highlight)
      fontWeight: "600",
      border: `2px solid ${highlightColor.border}`,
      boxShadow: `0 0 20px 4px ${highlightColor.glow}, inset 0 0 20px 2px ${highlightColor.glow.replace("0.8", "0.3")}`,
      animation: "treeGlowPulse 2s ease-in-out",
    };
  }

  return (
    <div
      style={{
        ...highlightStyle,
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
      data-container-id={containerId}
    >
      {/* Eye icon toggle */}
      {onToggleVisibility && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility(e);
          }}
          style={{
            cursor: "pointer",
            fontSize: "14px",
            opacity: 0.7,
            userSelect: "none",
            transition: "opacity 0.15s",
            display: "flex",
            alignItems: "center",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0.7";
          }}
          title={
            isManuallyHidden
              ? "Show in graph (currently hidden)"
              : "Hide from graph (Shift+click to hide all others)"
          }
        >
          {isManuallyHidden ? <EyeInvisibleOutlined /> : <EyeOutlined />}
        </span>
      )}
      <span
        style={{
          fontWeight:
            match || hasTemporaryHighlight
              ? isCurrent
                ? 600
                : 500
              : hasCollapsedMatchingDescendants
                ? 500
                : 400,
          opacity: isManuallyHidden ? 0.4 : 1,
          color: isManuallyHidden ? "#999" : "inherit",
          pointerEvents: isManuallyHidden ? "none" : "auto",
        }}
        title={longLabel || truncatedLabel}
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
 * Get searchable items in the same order as they appear in the tree hierarchy
 * @internal
 */
export function getSearchableItemsInTreeOrder(
  visualizationState: VisualizationState,
): Array<{ id: string; label: string; type: "container" | "node" }> {
  const items: Array<{
    id: string;
    label: string;
    type: "container" | "node";
  }> = [];
  const hierarchyTree = buildHierarchyTreeFromState(visualizationState);

  const traverse = (nodes: HierarchyTreeNode[], depth: number = 0) => {
    for (const node of nodes) {
      // Add the container first
      const containerData = visualizationState.getContainer(node.id);
      const containerLabel = containerData?.label || node.id;
      items.push({ id: node.id, label: containerLabel, type: "container" });

      // Recurse into child containers FIRST (matching tree render order)
      if (node.children && node.children.length > 0) {
        traverse(node.children, depth + 1);
      }

      // THEN add its leaf children (nodes) - these come after child containers in the tree
      const containerNodes = visualizationState.getContainerNodes(node.id);
      if (containerNodes && containerNodes.size > 0) {
        const leafNodeIds = Array.from(containerNodes);
        for (const leafId of leafNodeIds) {
          const nodeData = visualizationState.getGraphNode(leafId);
          const nodeLabel = nodeData?.label || leafId;
          items.push({ id: leafId, label: nodeLabel, type: "node" });
        }
      }
    }
  };

  if (hierarchyTree) {
    traverse(hierarchyTree);
  }

  return items;
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
  onToggleNodeVisibility?: (nodeId: string, shiftKey?: boolean) => void,
  onToggleContainerVisibility?: (
    containerId: string,
    shiftKey?: boolean,
  ) => void,
): TreeDataNode[] {
  // Build hierarchy tree structure from VisualizationState
  // Get the current color palette for highlight colors
  const palette = visualizationState.getColorPalette();
  const hierarchyTree = buildHierarchyTreeFromState(visualizationState);

  const convertToTreeData = (
    nodes: HierarchyTreeNode[],
    depth: number = 0,
  ): TreeDataNode[] => {
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
        children = convertToTreeData(node.children, depth + 1);
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
            const isManuallyHidden =
              visualizationState?.isNodeManuallyHidden(leafNode.id) ?? false;
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
                visualizationState?.hasTemporaryHighlight(leafNode.id) ?? false,
                palette,
                isManuallyHidden,
                onToggleNodeVisibility
                  ? (e: React.MouseEvent) =>
                      onToggleNodeVisibility(leafNode.id, e.shiftKey)
                  : undefined,
                leafNode.id, // Add containerId for scroll targeting
                leafNode.longLabel, // Show full label on hover
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
            const isManuallyHidden =
              visualizationState?.isNodeManuallyHidden(leafNode.id) ?? false;
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
                visualizationState?.hasTemporaryHighlight(leafNode.id) ?? false,
                palette,
                isManuallyHidden,
                onToggleNodeVisibility
                  ? (e: React.MouseEvent) =>
                      onToggleNodeVisibility(leafNode.id, e.shiftKey)
                  : undefined,
                leafNode.id, // Add containerId for scroll targeting
                leafNode.longLabel, // Show full label on hover
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
      // Check for temporary highlight (glow effect)
      const hasTemporaryHighlight = visualizationState.hasTemporaryHighlight(
        node.id,
      );
      const isContainerManuallyHidden =
        visualizationState?.isContainerManuallyHidden(node.id) ?? false;
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
        hasTemporaryHighlight,
        palette,
        isContainerManuallyHidden,
        onToggleContainerVisibility
          ? (e: React.MouseEvent) =>
              onToggleContainerVisibility(node.id, e.shiftKey)
          : undefined,
        node.id, // Add containerId for scroll targeting
        containerData?.longLabel || containerLabel, // Show full label on hover
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
  onToggleNodeVisibility,
  onToggleContainerVisibility,
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
  // ============================================================================
  // LOADING SPINNER STATE - CRITICAL BUG PREVENTION
  // ============================================================================
  // This state tracks when the tree is recalculating after a collapse/expand.
  //
  // ⚠️ CRITICAL BUG PREVENTED:
  // The spinner was being rendered but hidden in the same React render cycle
  // due to React's automatic state batching. Even though isRecalculating was
  // set to true and the overlay was in the DOM, React would batch the state
  // update from collapsedContainers changing and immediately hide the spinner
  // before it could be seen visually.
  //
  // 💡 SOLUTION:
  // Use setTimeout with a 300ms minimum duration in the useEffect that clears
  // this state (see below). This ensures the spinner stays visible even when
  // collapsedContainers updates immediately in the same render cycle.
  //
  // Without this, users see no feedback during noticeable delays when the graph
  // recalculates layout after expand/collapse operations.
  // ============================================================================
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Ref to the tree container for scrolling
  const treeContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to current search result when it changes
  useEffect(() => {
    if (!currentSearchResult || !treeContainerRef.current) return;

    // Wait a bit for the tree to render with the current result highlighted
    const scrollTimer = setTimeout(() => {
      // Ant Design Tree uses virtualization, so we need to find visible nodes only
      // Look for the title element that contains our search highlight
      const allTitles =
        treeContainerRef.current?.querySelectorAll(".ant-tree-title");

      let targetNode: Element | null = null;

      // Find the title that contains a search highlight div with our container ID
      if (allTitles) {
        for (const title of Array.from(allTitles)) {
          // Look for the search highlight div inside this title
          const highlightDiv = title.querySelector(
            `div[data-container-id="${currentSearchResult.id}"]`,
          );
          if (highlightDiv) {
            // Found it! Get the tree node ancestor
            targetNode = title.closest(".ant-tree-treenode");
            break;
          }
        }
      }

      if (targetNode && treeContainerRef.current) {
        // treeContainerRef is now the scrollable div with maxHeight and overflowY
        const scrollContainer = treeContainerRef.current;

        // Get positions
        const containerRect = scrollContainer.getBoundingClientRect();
        const targetRect = targetNode.getBoundingClientRect();

        // Calculate scroll to center the target in the container
        const currentScroll = scrollContainer.scrollTop;
        const targetOffsetFromContainer = targetRect.top - containerRect.top;
        const containerHeight = containerRect.height;
        const targetHeight = targetRect.height;

        const newScroll =
          currentScroll +
          targetOffsetFromContainer -
          containerHeight / 2 +
          targetHeight / 2;

        scrollContainer.scrollTo({
          top: newScroll,
          behavior: "smooth",
        });
      }
    }, 100); // Small delay to ensure DOM is updated

    return () => clearTimeout(scrollTimer);
  }, [currentSearchResult]);

  // ✅ EFFICIENT: Use VisualizationState's optimized search expansion logic with stable dependencies
  const derivedExpandedKeys = useMemo(() => {
    if (!visualizationState) {
      return [];
    }
    // When search is cleared, calculate expanded containers from collapsedContainers prop
    if (!searchResults || searchResults.length === 0) {
      // Return containers that are NOT in the collapsedContainers set
      // Use allContainers to include manually hidden containers in the tree
      const allContainerIds = visualizationState.allContainers.map(
        (container) => container.id,
      );
      const currentlyExpanded = allContainerIds.filter(
        (id) => !collapsedContainers.has(id),
      );
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
  }, [visualizationState, searchResults, collapsedContainers]);
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
        searchResults.length > 0 &&
        visualizationState
      ) {
        shouldBeExpanded.forEach((containerId: string) => {
          if (
            !currentlyCollapsed.has(containerId) &&
            !containersToToggle.includes(containerId)
          ) {
            // Check if this container exists and is collapsed (but not tracked in currentlyCollapsed)
            const container = visualizationState.getContainer(containerId);
            if (container && container.collapsed) {
              // CRITICAL: Only add to toggle list if no ancestors are collapsed
              // If any ancestor is collapsed, this container cannot be expanded yet
              let hasCollapsedAncestor = false;
              let currentAncestor =
                visualizationState.getNodeContainer(containerId);
              while (currentAncestor) {
                const ancestorContainer =
                  visualizationState.getContainer(currentAncestor);
                if (ancestorContainer && ancestorContainer.collapsed) {
                  hasCollapsedAncestor = true;
                  break;
                }
                currentAncestor =
                  visualizationState.getNodeContainer(currentAncestor);
              }
              if (!hasCollapsedAncestor) {
                containersToToggle.push(containerId);
              }
            }
          }
        });
      }
      // CRITICAL: Make hidden containers and nodes visible before expanding
      // Search matches should always be visible in the graph
      if (visualizationState && searchResults) {
        // First, show all hidden containers that need to be expanded or contain matches
        const containersToShow: string[] = [];

        // Collect all containers that need to be visible
        for (const result of searchResults) {
          if (result.type === "container") {
            // If the match is a container, show it
            if (visualizationState.isContainerManuallyHidden(result.id)) {
              containersToShow.push(result.id);
            }
            // Show all its ancestors
            const ancestors = visualizationState.getContainerAncestors(
              result.id,
            );
            for (const ancestorId of ancestors) {
              if (visualizationState.isContainerManuallyHidden(ancestorId)) {
                containersToShow.push(ancestorId);
              }
            }
          } else if (result.type === "node") {
            // If the match is a node, show it
            if (visualizationState.isNodeManuallyHidden(result.id)) {
              visualizationState.toggleNodeVisibility(result.id);
            }
            // Show its container and all ancestors
            const containerId = visualizationState.getNodeContainer(result.id);
            if (containerId) {
              if (visualizationState.isContainerManuallyHidden(containerId)) {
                containersToShow.push(containerId);
              }
              const ancestors =
                visualizationState.getContainerAncestors(containerId);
              for (const ancestorId of ancestors) {
                if (visualizationState.isContainerManuallyHidden(ancestorId)) {
                  containersToShow.push(ancestorId);
                }
              }
            }
          }
        }

        // Show containers from root to leaf (ancestors first)
        const uniqueContainers = Array.from(new Set(containersToShow));
        uniqueContainers.sort((a, b) => {
          const depthA = visualizationState.getContainerAncestors(a).length;
          const depthB = visualizationState.getContainerAncestors(b).length;
          return depthB - depthA; // Root first (fewer ancestors)
        });

        for (const containerId of uniqueContainers) {
          visualizationState.toggleContainerVisibility(containerId);
        }
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
          // Fallback: Use onTreeExpansion for atomic batch expansion, or onToggleContainer
          if (_onTreeExpansion) {
            // PREFERRED: Atomic batch expansion through callback
            _onTreeExpansion(containersToToggle)
              .then(() => {
                searchExpansionInProgressRef.current = false;
              })
              .catch((error: unknown) => {
                console.warn(
                  `[HierarchyTree] Batch tree expansion failed: ${error}`,
                );
                searchExpansionInProgressRef.current = false;
              });
          } else if (onToggleContainer) {
            // FALLBACK: Individual toggles (may cause race conditions!)
            console.warn(
              "[HierarchyTree] Using individual toggles for search expansion - may cause race conditions. Consider using onTreeExpansion for atomic batch operations.",
            );
            containersToToggle.forEach((containerId) => {
              onToggleContainer(containerId);
            });
            searchExpansionInProgressRef.current = false;
          }
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
        // Call onToggleContainer for each container that needs to be synced
        // This goes through the AsyncCoordinator pipeline for proper updates
        for (const containerId of containersToToggle) {
          onToggleContainer(containerId);
        }
      }
    }
  }, [
    derivedExpandedKeys,
    searchQuery,
    searchResults,
    collapsedContainers,
    onToggleContainer,
    _onTreeExpansion,
    layoutOrchestrator,
    visualizationState,
    asyncCoordinator,
    syncEnabled,
  ]);

  // Extract cacheVersion for dependency tracking
  // This ensures tree re-renders when visibility toggles change internal state
  const cacheVersion = visualizationState?.cacheVersion ?? 0;

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
      onToggleNodeVisibility,
      onToggleContainerVisibility,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    visualizationState,
    cacheVersion, // Re-compute when visibility state changes
    collapsedContainers,
    searchResults,
    currentSearchResult,
    truncateLabels,
    maxLabelLength,
    showNodeCounts,
    onToggleNodeVisibility,
    onToggleContainerVisibility,
  ]);

  // Clear loading state when collapsedContainers changes (signaling state update complete)
  // Add a minimum delay so the spinner is actually visible to the user
  useEffect(() => {
    if (isRecalculating) {
      // Use setTimeout to ensure spinner shows for at least one frame
      // This prevents React batching from hiding it instantly
      const timer = setTimeout(() => {
        setIsRecalculating(false);
      }, 300); // 300ms minimum display time

      return () => clearTimeout(timer);
    }
  }, [collapsedContainers, isRecalculating]);

  const handleExpand = (
    nextExpandedKeys: React.Key[],
    info: {
      node: TreeDataNode;
    },
  ) => {
    // Update UI immediately
    setExpandedKeys(nextExpandedKeys);

    // Show loading indicator
    setIsRecalculating(true);

    // Then toggle corresponding container in the visualization
    if (info.node && onToggleContainer) {
      const nodeKey = info.node.key as string;
      // Check if we're expanding or collapsing by comparing current state
      const wasExpanded = expandedKeys.includes(nodeKey);
      const isNowExpanded = nextExpandedKeys.includes(nodeKey);
      // Only toggle if the state actually changed
      if (wasExpanded !== isNowExpanded) {
        // Call the parent's toggle handler which goes through AsyncCoordinator
        // This ensures proper layout recalculation and ReactFlow updates
        onToggleContainer(nodeKey);
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

      // Check if the element is manually hidden - if so, ignore clicks
      if (isGraphNode) {
        const isHidden = visualizationState?.isNodeManuallyHidden(nodeKey);
        if (isHidden) {
          return; // Don't navigate to hidden nodes
        }

        // This is a leaf node - trigger navigation if callback is provided
        if (onElementNavigation) {
          onElementNavigation(nodeKey, "node");
        }
      } else {
        const isHidden = visualizationState?.isContainerManuallyHidden(nodeKey);
        if (isHidden) {
          return; // Don't navigate to hidden containers
        }

        // This is a container - trigger navigation if callback is provided
        if (onElementNavigation) {
          onElementNavigation(nodeKey, "container");
        }
        // Note: Don't fallback to toggle behavior to avoid conflicting with navigation
        // The parent component should handle both navigation and expansion separately
      }
    }
  };
  // Check if we have any containers to display (including hidden ones)
  if (!visualizationState || visualizationState.allContainers.length === 0) {
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
          
          /* Glow pulse animation for tree highlights - synced with graph */
          @keyframes treeGlowPulse {
            0% { 
              opacity: 0;
              transform: scale(0.98);
            }
            15% { 
              opacity: 1;
              transform: scale(1);
            }
            85% { 
              opacity: 1;
              transform: scale(1);
            }
            100% { 
              opacity: 0;
              transform: scale(1.01);
            }
          }
        `}
      </style>

      {/* Scrollable container for the tree */}
      <div
        ref={treeContainerRef}
        style={{
          maxHeight: "500px",
          overflowY: "auto",
          position: "relative",
          minHeight: "100px",
        }}
      >
        {isRecalculating && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              minHeight: "200px", // Ensure overlay has minimum height
              backgroundColor: "rgba(255, 255, 255, 0.8)", // Semi-transparent white
              display: "flex",
              alignItems: "flex-start", // Align to top instead of center
              justifyContent: "center",
              paddingTop: "40px", // Add padding from top
              zIndex: 9999,
              pointerEvents: "auto", // Allow pointer events so spinner is visible
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "12px 20px",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                border: "1px solid #e0e0e0",
              }}
            >
              <Spin size="default" />
              <span style={{ fontSize: "14px", color: "#333" }}>
                Updating tree...
              </span>
            </div>
          </div>
        )}
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
            minHeight: "100px",
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
    </div>
  );
}
