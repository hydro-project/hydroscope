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

import React, { useMemo, useEffect, useState } from 'react';
import { Tree } from 'antd';
import type { TreeDataNode } from 'antd';
import { HierarchyTreeProps, HierarchyTreeNode } from './types';
import { TYPOGRAPHY } from '../shared/config';
import { COMPONENT_COLORS } from '../shared/config';

// ============ TREE DATA FORMATTING UTILITIES ============

/**
 * Build hierarchy tree structure from VisualizationState
 * This replaces the redundant hierarchyTree prop that was being passed from InfoPanel
 */
function buildHierarchyTreeFromState(visualizationState: any): HierarchyTreeNode[] {
  if (!visualizationState || visualizationState.visibleContainers.length === 0) return [];

  const buildNode = (containerId: string): HierarchyTreeNode => {
    // Use efficient O(1) lookups instead of scanning
    const childrenIds: string[] = [];
    const containerChildren = visualizationState.getContainerChildren(containerId);
    containerChildren?.forEach((childId: string) => {
      if (visualizationState.getContainer(childId)) childrenIds.push(childId);
    });
    const children: HierarchyTreeNode[] = childrenIds.map(buildNode);
    return { id: containerId, children };
  };

  // Use existing getTopLevelContainers() instead of building parentMap
  const rootContainers = visualizationState.getTopLevelContainers();
  return rootContainers.map((container: any) => buildNode(container.id));
}

/**
 * Helper function to truncate labels with consistent logic
 */
function truncateHierarchyLabel(
  text: string,
  maxLength: number,
  leftTruncate: boolean = false
): string {
  if (text.length <= maxLength) return text;

  if (leftTruncate) {
    return '...' + text.slice(text.length - maxLength + 3);
  } else {
    return text.slice(0, maxLength - 3) + '...';
  }
}

/**
 * Helper function to create search highlight element
 */
function createSearchHighlightDiv(
  text: string,
  match: boolean,
  isCurrent: boolean,
  baseStyle: any
): React.ReactNode {
  return (
    <div
      style={
        match
          ? {
              backgroundColor: isCurrent ? 'rgba(255,107,53,0.35)' : 'rgba(251,191,36,0.28)',
              borderRadius: 4,
              padding: '2px 4px',
              margin: '-1px -2px',
              fontWeight: isCurrent ? '600' : '500',
              border: isCurrent
                ? '1px solid rgba(255,107,53,0.4)'
                : '1px solid rgba(251,191,36,0.3)',
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
  showNodeCounts: boolean
): React.ReactNode {
  const countText = showNodeCounts && hasLeafChildren ? ` (${leafChildrenCount})` : '';

  return (
    <div
      style={
        match
          ? {
              backgroundColor: isCurrent ? 'rgba(255,107,53,0.35)' : 'rgba(251,191,36,0.28)',
              borderRadius: 4,
              padding: '2px 4px',
              margin: '-1px -2px',
              fontWeight: isCurrent ? '600' : '500',
              border: isCurrent
                ? '1px solid rgba(255,107,53,0.4)'
                : '1px solid rgba(251,191,36,0.3)',
            }
          : {}
      }
    >
      <span style={{ fontWeight: 500 }}>
        {truncatedLabel}
        {countText && (
          <span style={{ fontSize: '10px', opacity: 0.75, fontWeight: 400 }}>{countText}</span>
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
  visualizationState: any,
  collapsedContainers: Set<string>,
  searchMatches?: Array<{
    id: string;
    label: string;
    type: 'container' | 'node';
    matchIndices?: number[][];
  }>,
  currentSearchMatch?: { id: string } | undefined,
  truncateLabels: boolean = true,
  maxLabelLength: number = 20,
  showNodeCounts: boolean = true
): TreeDataNode[] {
  // Build hierarchy tree structure from VisualizationState
  const hierarchyTree = buildHierarchyTreeFromState(visualizationState);

  const convertToTreeData = (nodes: HierarchyTreeNode[]): TreeDataNode[] => {
    return nodes.map(node => {
      // Get container data using VisualizationState accessors
      const containerData = visualizationState?.getContainer(node.id);
      const containerLabel = containerData?.label || `Container ${node.id}`;

      // Get efficient leaf node count (O(1) lookup)
      const leafChildrenCount = visualizationState?.getContainerLeafNodeCount(node.id) || 0;

      // Get container metadata for shortLabel
      const containerShortLabel = containerData?.data?.shortLabel || containerData?.shortLabel;

      const labelToUse = containerShortLabel || containerLabel;
      const truncatedLabel = truncateLabels
        ? truncateHierarchyLabel(labelToUse, maxLabelLength, true)
        : labelToUse;

      // Get efficient leaf nodes (O(1) lookup)
      const leafNodes = visualizationState?.getContainerLeafNodes(node.id) || [];

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
          const leafTreeNodes = leafNodes.map((leafNode: any) => {
            const match = searchMatches?.some(m => m.id === leafNode.id && m.type === 'node')
              ? true
              : false;
            const isCurrent = !!(currentSearchMatch && currentSearchMatch.id === leafNode.id);

            return {
              key: leafNode.id,
              title: createSearchHighlightDiv(
                truncateLabels
                  ? truncateHierarchyLabel(leafNode.label, maxLabelLength - 2, true)
                  : leafNode.label,
                match,
                isCurrent,
                { fontSize: '11px', opacity: 0.8 }
              ),
              isLeaf: true,
              data: {
                isGraphNode: true,
                originalLabel: leafNode.label,
                fullLabel: leafNode.fullLabel,
                shortLabel: leafNode.shortLabel,
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
              style: { display: 'none' }, // Hide the virtual child
            },
          ];
        } else {
          // Expanded - show actual leaf nodes
          children = leafNodes.map((leafNode: any) => {
            const match = searchMatches?.some(m => m.id === leafNode.id && m.type === 'node')
              ? true
              : false;
            const isCurrent = !!(currentSearchMatch && currentSearchMatch.id === leafNode.id);

            return {
              key: leafNode.id,
              title: createSearchHighlightDiv(
                truncateLabels
                  ? truncateHierarchyLabel(leafNode.label, maxLabelLength - 2, true)
                  : leafNode.label,
                match,
                isCurrent,
                { fontSize: '11px', opacity: 0.8 }
              ),
              isLeaf: true,
              data: {
                isGraphNode: true,
                originalLabel: leafNode.label,
                fullLabel: leafNode.fullLabel,
                shortLabel: leafNode.shortLabel,
              },
            };
          });
        }
      }

      // Create display title with better formatting + optional search highlight
      const match = searchMatches?.some(m => m.id === node.id) ? true : false;
      const isCurrent = !!(currentSearchMatch && currentSearchMatch.id === node.id);

      const displayTitle = createContainerDisplayTitle(
        truncatedLabel,
        hasChildren,
        hasLeafChildren,
        node.children.length,
        leafChildrenCount,
        match,
        isCurrent,
        showNodeCounts
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
  title = 'Container Hierarchy',
  showNodeCounts = true,
  truncateLabels = true,
  maxLabelLength = 20,
  className = '',
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
    type: 'container' | 'node';
    matchIndices?: number[][];
  }>;
  currentSearchMatch?: { id: string } | undefined;
}) {
  // ✅ EFFICIENT: Use VisualizationState's optimized search expansion logic instead of complex useMemo
  const derivedExpandedKeys = useMemo(() => {
    if (!visualizationState) {
      return [];
    }

    // Use VisualizationState's efficient search expansion method
    return visualizationState.getSearchExpansionKeys(searchMatches || [], collapsedContainers);
  }, [visualizationState, collapsedContainers, searchQuery, searchMatches]);

  // Maintain a controlled expandedKeys state for immediate UI feedback on arrow clicks
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);

  // Sync local expanded state whenever the derived value changes (e.g., collapse/expand in vis, search)
  useEffect(() => {
    setExpandedKeys(derivedExpandedKeys);

    // During search, expand containers that are ancestors of matches (including node matches)
    if (
      searchQuery &&
      searchQuery.trim() &&
      searchMatches &&
      searchMatches.length &&
      onToggleContainer
    ) {
      // For container matches, avoid expanding the matches themselves
      // For node matches, expand their parent containers to make nodes visible
      const containerMatches = new Set(
        searchMatches.filter(m => m.type === 'container').map(m => m.id)
      );
      const shouldBeExpanded = new Set(derivedExpandedKeys.map((k: string) => String(k)));
      const currentlyCollapsed = collapsedContainers;

      currentlyCollapsed.forEach(containerId => {
        if (shouldBeExpanded.has(containerId) && !containerMatches.has(containerId)) {
          // This container should be expanded to show the path to matches or to reveal matching nodes
          onToggleContainer(containerId);
        }
      });
    } else if (
      (!searchQuery || !searchQuery.trim() || !searchMatches || !searchMatches.length) &&
      onToggleContainer
    ) {
      // When not searching, sync normally
      const shouldBeExpanded = new Set(derivedExpandedKeys.map((k: string) => String(k)));
      const currentlyCollapsed = collapsedContainers;

      currentlyCollapsed.forEach(containerId => {
        if (shouldBeExpanded.has(containerId)) {
          onToggleContainer(containerId);
        }
      });
    }
  }, [derivedExpandedKeys, searchQuery, searchMatches, collapsedContainers, onToggleContainer]);

  const treeData = useMemo(() => {
    return getTreeDataStructure(
      visualizationState,
      collapsedContainers,
      searchMatches,
      currentSearchMatch,
      truncateLabels,
      maxLabelLength,
      showNodeCounts
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

  const handleExpand = (nextExpandedKeys: React.Key[], info: any) => {
    // Update UI immediately
    setExpandedKeys(nextExpandedKeys);
    // Then toggle corresponding container in the visualization
    if (onToggleContainer && info.node) {
      const nodeKey = info.node.key as string;
      // Check if we're expanding or collapsing by comparing current state
      const wasExpanded = expandedKeys.includes(nodeKey);
      const isNowExpanded = nextExpandedKeys.includes(nodeKey);

      // Only call onToggleContainer if the state actually changed
      if (wasExpanded !== isNowExpanded) {
        onToggleContainer(nodeKey);
      }
    }
  };

  const handleSelect = (_selectedKeys: React.Key[], info: any) => {
    if (onToggleContainer && info.node) {
      const nodeKey = info.node.key as string;
      onToggleContainer(nodeKey);
    }
  };

  // Check if we have any containers to display
  if (!visualizationState || visualizationState.visibleContainers.length === 0) {
    return (
      <div className={`hierarchy-tree-empty ${className}`} style={style}>
        <span
          style={{
            color: COMPONENT_COLORS.TEXT_DISABLED,
            fontSize: TYPOGRAPHY.INFOPANEL_HIERARCHY_DETAILS,
            fontStyle: 'italic',
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
            fontWeight: 'bold',
            color: COMPONENT_COLORS.TEXT_PRIMARY,
            marginBottom: '8px',
            paddingBottom: '4px',
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
        key={Array.from(collapsedContainers).sort().join(',')}
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
          backgroundColor: 'transparent',
          // Ensure proper rendering in Card layout
          minHeight: '20px',
          width: '100%',
        }}
        // Enhanced styling through CSS variables for better hierarchy
        rootStyle={
          {
            '--antd-tree-node-hover-bg': COMPONENT_COLORS.BUTTON_HOVER_BACKGROUND,
            '--antd-tree-node-selected-bg': COMPONENT_COLORS.BUTTON_HOVER_BACKGROUND,
            '--antd-tree-indent-size': '16px', // Reduce indent for better space usage
            '--antd-tree-node-padding': '2px 4px', // Better padding
            width: '100%',
            overflow: 'visible',
          } as React.CSSProperties
        }
      />
    </div>
  );
}
