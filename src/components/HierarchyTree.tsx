/**
 * @fileoverview HierarchyTree Component
 * 
 * Displays an interactive tree view of container hierarchy for navigation using Ant Design Tree.
 */

import React, { useMemo, useEffect, useState } from 'react';
import { Tree } from 'antd';
import type { TreeDataNode } from 'antd';
import { HierarchyTreeProps, HierarchyTreeNode } from './types';
import { TYPOGRAPHY } from '../shared/config';
import { COMPONENT_COLORS } from '../shared/config';
import { truncateLabel } from '../shared/textUtils';

export function HierarchyTree({
  hierarchyTree,
  collapsedContainers = new Set(),
  onToggleContainer,
  title = 'Container Hierarchy',
  showNodeCounts = true,
  truncateLabels = true,
  maxLabelLength = 20,
  className = '',
  style,
  // Add visualizationState to access leaf nodes
  visualizationState,
  // optional search wiring
  searchQuery,
  searchMatches,
  currentSearchMatch
}: HierarchyTreeProps & {
  visualizationState?: any; // Add this prop
  searchQuery?: string;
  searchMatches?: Array<{ id: string; label: string; type: 'container' | 'node'; matchIndices?: number[][] }>;
  currentSearchMatch?: { id: string } | undefined;
}) {

  // Convert HierarchyTreeNode to Ant Design TreeDataNode format
  const convertToTreeData = (nodes: HierarchyTreeNode[]): TreeDataNode[] => {
    return nodes.map(node => {
        // Get container data directly from visualizationState
        const containerData = visualizationState?.getContainer(node.id);
        const containerLabel = containerData?.label || `Container ${node.id}`;
        
        // ✅ EFFICIENT: Use O(1) lookup instead of Array.from().filter()
        const leafChildrenCount = visualizationState?.getContainerLeafNodeCount(node.id) || 0;
        
        // Get container metadata for shortLabel
        const containerShortLabel = containerData?.data?.shortLabel || containerData?.shortLabel;
        
        const labelToUse = containerShortLabel || containerLabel;
        const truncatedLabel = truncateLabels 
          ? truncateLabel(labelToUse, { maxLength: maxLabelLength, leftTruncate: true })
          : labelToUse;
          
        // ✅ EFFICIENT: Use O(1) lookup instead of Array.from().filter().map().find()
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
            const match = searchMatches?.some(m => m.id === leafNode.id && m.type === 'node') ? true : false;
            const isCurrent = !!(currentSearchMatch && currentSearchMatch.id === leafNode.id);
            
            return {
              key: leafNode.id,
              title: (
                <div style={match ? {
                  backgroundColor: isCurrent ? 'rgba(255,107,53,0.35)' : 'rgba(251,191,36,0.28)',
                  borderRadius: 4,
                  padding: '2px 4px',
                  margin: '-1px -2px',
                  fontWeight: isCurrent ? '600' : '500',
                  border: isCurrent ? '1px solid rgba(255,107,53,0.4)' : '1px solid rgba(251,191,36,0.3)',
                  fontSize: '11px'
                } : { fontSize: '11px', opacity: 0.8 }}>
                  {truncateLabels 
                    ? truncateLabel(leafNode.label || leafNode.shortLabel || leafNode.id, { maxLength: maxLabelLength - 2, leftTruncate: true })
                    : (leafNode.label || leafNode.shortLabel || leafNode.id)}
                </div>
              ),
              isLeaf: true,
              data: {
                isGraphNode: true,
                originalLabel: leafNode.label || leafNode.shortLabel || leafNode.id,
                fullLabel: leafNode.fullLabel,
                shortLabel: leafNode.shortLabel
              }
            };
          });
          children = [...children, ...leafTreeNodes];
        }
      } else if (hasLeafChildren) {
        // Container has only leaf nodes
        if (isCollapsed) {
          // Add virtual child to show expand icon
          children = [{
            key: `${node.id}__virtual__`,
            title: `Loading...`, // This should never be visible
            isLeaf: true,
            style: { display: 'none' } // Hide the virtual child
          }];
        } else {
          // Expanded - show actual leaf nodes
          children = leafNodes.map((leafNode: any) => {
            const match = searchMatches?.some(m => m.id === leafNode.id && m.type === 'node') ? true : false;
            const isCurrent = !!(currentSearchMatch && currentSearchMatch.id === leafNode.id);
            
            return {
              key: leafNode.id,
              title: (
                <div style={match ? {
                  backgroundColor: isCurrent ? 'rgba(255,107,53,0.35)' : 'rgba(251,191,36,0.28)',
                  borderRadius: 4,
                  padding: '2px 4px',
                  margin: '-1px -2px',
                  fontWeight: isCurrent ? '600' : '500',
                  border: isCurrent ? '1px solid rgba(255,107,53,0.4)' : '1px solid rgba(251,191,36,0.3)',
                  fontSize: '11px'
                } : { fontSize: '11px', opacity: 0.8 }}>
                  {truncateLabels 
                    ? truncateLabel(leafNode.label || leafNode.shortLabel || leafNode.id, { maxLength: maxLabelLength - 2, leftTruncate: true })
                    : (leafNode.label || leafNode.shortLabel || leafNode.id)}
                </div>
              ),
              isLeaf: true,
              data: {
                isGraphNode: true,
                originalLabel: leafNode.label || leafNode.shortLabel || leafNode.id,
                fullLabel: leafNode.fullLabel,
                shortLabel: leafNode.shortLabel
              }
            };
          });
        }
      }
      
  // Create display title with better formatting + optional search highlight
  let displayTitle: React.ReactNode = truncatedLabel;
  const match = searchMatches?.some(m => m.id === node.id) ? true : false;
  const isCurrent = !!(currentSearchMatch && currentSearchMatch.id === node.id);
      
      if (showNodeCounts && (hasChildren || hasLeafChildren)) {
        const count = hasChildren ? node.children.length : leafChildrenCount;
        const countText = hasChildren ? `${count} containers` : `${count} nodes`;
        displayTitle = (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ 
              fontWeight: hasChildren ? '500' : '400',
              color: COMPONENT_COLORS.TEXT_PRIMARY,
              ...(hasLeafChildren && !hasChildren ? {
                // Subtle gray background for leaf nodes
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                padding: '1px 4px',
                borderRadius: '3px',
                fontSize: TYPOGRAPHY.INFOPANEL_HIERARCHY_DETAILS
              } : {})
            }}>
              {/* Stronger, row-wide highlight applied below on wrapper */}
              <span>{truncatedLabel}</span>
            </span>
            <span style={{ 
              fontSize: TYPOGRAPHY.INFOPANEL_HIERARCHY_DETAILS, 
              color: COMPONENT_COLORS.TEXT_TERTIARY,
              fontStyle: 'italic',
              marginLeft: '8px',
              opacity: 0.7
            }}>
              {countText}
            </span>
          </span>
        );
      } else {
        // For nodes without counts, still apply leaf styling if needed
        if (hasLeafChildren && !hasChildren) {
          displayTitle = (
            <span style={{
              color: COMPONENT_COLORS.TEXT_PRIMARY,
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
              padding: '1px 4px',
              borderRadius: '3px',
              fontSize: TYPOGRAPHY.INFOPANEL_HIERARCHY_DETAILS
            }}>
              <span>{truncatedLabel}</span>
            </span>
          );
        }
      }

      return {
        key: node.id,
        title: (
          <div style={match ? {
            backgroundColor: isCurrent ? 'rgba(255,107,53,0.35)' : 'rgba(251,191,36,0.28)',
            borderRadius: 4,
            padding: '4px 6px',
            margin: '-2px -4px',
            fontWeight: isCurrent ? '600' : '500',
            border: isCurrent ? '1px solid rgba(255,107,53,0.4)' : '1px solid rgba(251,191,36,0.3)'
          } : undefined}>{displayTitle}</div>
        ),
        children: children,
        isLeaf: !hasChildren && !hasLeafChildren, // Only true leaf nodes (no children at all)
        // Add custom properties for styling
        data: {
          originalLabel: labelToUse,
          truncatedLabel,
          nodeCount: leafChildrenCount, // Use efficient leaf children count
          leafChildrenCount,
          hasLeafChildren: hasLeafChildren && !hasChildren,
          isContainer: hasChildren
        }
      };
    });
  };

  // ✅ EFFICIENT: Use VisualizationState's optimized search expansion logic instead of complex useMemo
  const derivedExpandedKeys = useMemo(() => {
    if (!visualizationState) {
      // Fallback: simple expansion based on collapsed containers
      const allKeys: string[] = [];
      const collectKeys = (nodes: HierarchyTreeNode[]) => {
        for (const node of nodes) {
          allKeys.push(node.id);
          if (node.children) {
            collectKeys(node.children);
          }
        }
      };
      collectKeys(hierarchyTree || []);
      return allKeys.filter(key => !collapsedContainers.has(key));
    }
    
    // Use VisualizationState's efficient search expansion method
    return visualizationState.getSearchExpansionKeys(
      searchMatches || [],
      collapsedContainers
    );
  }, [visualizationState, hierarchyTree, collapsedContainers, searchQuery, searchMatches]);

  // Maintain a controlled expandedKeys state for immediate UI feedback on arrow clicks
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);

  // Sync local expanded state whenever the derived value changes (e.g., collapse/expand in vis, search)
  useEffect(() => {
    setExpandedKeys(derivedExpandedKeys);
    
    // During search, expand containers that are ancestors of matches (including node matches)
    if (searchQuery && searchQuery.trim() && searchMatches && searchMatches.length && onToggleContainer) {
      // For container matches, avoid expanding the matches themselves
      // For node matches, expand their parent containers to make nodes visible
      const containerMatches = new Set(searchMatches.filter(m => m.type === 'container').map(m => m.id));
      const shouldBeExpanded = new Set(derivedExpandedKeys.map((k: string) => String(k)));
      const currentlyCollapsed = collapsedContainers;
      
      currentlyCollapsed.forEach(containerId => {
        if (shouldBeExpanded.has(containerId) && !containerMatches.has(containerId)) {
          // This container should be expanded to show the path to matches or to reveal matching nodes
          onToggleContainer(containerId);
        }
      });
    } else if ((!searchQuery || !searchQuery.trim() || !searchMatches || !searchMatches.length) && onToggleContainer) {
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
    const data = convertToTreeData(hierarchyTree || []);
    return data;
  }, [hierarchyTree, maxLabelLength, showNodeCounts, truncateLabels, collapsedContainers, searchMatches, currentSearchMatch]);

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

  const handleSelect = (selectedKeys: React.Key[], info: any) => {
    if (onToggleContainer && info.node) {
      const nodeKey = info.node.key as string;
      onToggleContainer(nodeKey);
    }
  };

  if (!hierarchyTree || hierarchyTree.length === 0) {
    return (
      <div className={`hierarchy-tree-empty ${className}`} style={style}>
        <span style={{ 
          color: COMPONENT_COLORS.TEXT_DISABLED,
          fontSize: TYPOGRAPHY.INFOPANEL_HIERARCHY_DETAILS,
          fontStyle: 'italic'
        }}>
          No hierarchy available
        </span>
      </div>
    );
  }

  return (
    <div className={`hierarchy-tree ${className}`} style={style}>
      {title && (
        <div style={{
          fontSize: TYPOGRAPHY.INFOPANEL_HIERARCHY_NODE,
          fontWeight: 'bold',
          color: COMPONENT_COLORS.TEXT_PRIMARY,
          marginBottom: '8px',
          paddingBottom: '4px',
          borderBottom: `1px solid ${COMPONENT_COLORS.BORDER_LIGHT}`,
        }}>
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
          width: '100%'
        }}
        // Enhanced styling through CSS variables for better hierarchy
        rootStyle={{
          '--antd-tree-node-hover-bg': COMPONENT_COLORS.BUTTON_HOVER_BACKGROUND,
          '--antd-tree-node-selected-bg': COMPONENT_COLORS.BUTTON_HOVER_BACKGROUND,
          '--antd-tree-indent-size': '16px', // Reduce indent for better space usage
          '--antd-tree-node-padding': '2px 4px', // Better padding
          width: '100%',
          overflow: 'visible'
        } as React.CSSProperties}
      />
    </div>
  );
}
