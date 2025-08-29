/**
 * @fileoverview HierarchyTree Component
 * 
 * Displays an interactive tree view of container hierarchy for navigation using Ant Design Tree.
 */

import React, { useMemo } from 'react';
import { Tree } from 'antd';
import { CaretRightOutlined, CaretDownOutlined } from '@ant-design/icons';
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
  style
}: HierarchyTreeProps) {

  // Convert HierarchyTreeNode to Ant Design TreeDataNode format
  const convertToTreeData = (nodes: HierarchyTreeNode[]): TreeDataNode[] => {
    return nodes.map(node => {
      const labelToUse = node.shortLabel || node.label;
      const truncatedLabel = truncateLabels 
        ? truncateLabel(labelToUse, { maxLength: maxLabelLength, leftTruncate: true })
        : labelToUse;
      const leafChildrenCount = Math.max(0, node.nodeCount - (node.children?.length || 0));
      const hasChildren = node.children && node.children.length > 0;
      const hasLeafChildren = leafChildrenCount > 0;
      const isCollapsed = collapsedContainers.has(node.id);
      
      // For collapsed containers that have content, add a virtual child to show the expand icon
      // For expanded containers, show real children or no children
      let children: TreeDataNode[] | undefined = undefined;
      
      if (hasChildren) {
        // Container has child containers - recurse
        children = convertToTreeData(node.children);
      } else if (hasLeafChildren) {
        // Container has leaf nodes
        if (isCollapsed) {
          // Add virtual child to show expand icon
          children = [{
            key: `${node.id}__virtual__`,
            title: `Loading...`, // This should never be visible
            isLeaf: true,
            style: { display: 'none' } // Hide the virtual child
          }];
        } else {
          // Expanded - don't show virtual child, show nothing (leaf nodes aren't shown in tree)
          children = undefined;
        }
      }
      
      // Create display title with better formatting
      let displayTitle: React.ReactNode = truncatedLabel;
      
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
              {truncatedLabel}
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
              {truncatedLabel}
            </span>
          );
        }
      }

      return {
        key: node.id,
        title: displayTitle,
        children: children,
        isLeaf: !hasChildren && !hasLeafChildren, // Only true leaf nodes (no children at all)
        // Add custom properties for styling
        data: {
          originalLabel: labelToUse,
          truncatedLabel,
          nodeCount: node.nodeCount,
          leafChildrenCount,
          hasLeafChildren: hasLeafChildren && !hasChildren,
          isContainer: hasChildren
        }
      };
    });
  };

  // Convert collapsed containers Set to expanded keys array (Ant Design uses expanded, not collapsed)
  const expandedKeys = useMemo(() => {
    const allKeys: string[] = [];
    
    const collectKeys = (nodes: HierarchyTreeNode[]) => {
      nodes.forEach(node => {
        allKeys.push(node.id);
        if (node.children) {
          collectKeys(node.children);
        }
      });
    };
    
    collectKeys(hierarchyTree || []);
    
    // Return keys that are NOT in collapsedContainers (i.e., expanded keys)
    const expandedKeysArray = allKeys.filter(key => !collapsedContainers.has(key));
    
    console.log('🌳 HierarchyTree: expandedKeys calculated', { 
      allKeys, 
      collapsedContainers: Array.from(collapsedContainers), 
      expandedKeys: expandedKeysArray 
    });
    
    return expandedKeysArray;
  }, [hierarchyTree, collapsedContainers]);

  const treeData = useMemo(() => {
    const data = convertToTreeData(hierarchyTree || []);
    console.log('🌳 HierarchyTree: treeData computed', { 
      hierarchyTreeLength: hierarchyTree?.length, 
      treeDataLength: data.length,
      treeData: data.map(node => ({ key: node.key, title: node.title, children: node.children?.length }))
    });
    return data;
  }, [hierarchyTree, maxLabelLength, showNodeCounts, truncateLabels]);

  const handleExpand = (expandedKeys: React.Key[], info: any) => {
    console.log('🌳 HierarchyTree: handleExpand called', { 
      expandedKeys, 
      nodeKey: info.node?.key, 
      hasOnToggleContainer: !!onToggleContainer 
    });
    
    if (onToggleContainer && info.node) {
      // Ant Design expansion is the opposite of our collapse state
      const nodeKey = info.node.key as string;
      console.log('🌳 HierarchyTree: calling onToggleContainer with', nodeKey);
      onToggleContainer(nodeKey);
    }
  };

  const handleSelect = (selectedKeys: React.Key[], info: any) => {
    console.log('🌳 HierarchyTree: handleSelect called', { 
      selectedKeys, 
      nodeKey: info.node?.key, 
      hasOnToggleContainer: !!onToggleContainer 
    });
    
    if (onToggleContainer && info.node) {
      const nodeKey = info.node.key as string;
      console.log('🌳 HierarchyTree: calling onToggleContainer from select with', nodeKey);
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
        treeData={treeData}
        expandedKeys={expandedKeys}
        onExpand={handleExpand}
        onSelect={handleSelect}
        switcherIcon={({ expanded, isLeaf }) => {
          if (isLeaf) return null;
          return expanded ? (
            <CaretDownOutlined style={{ color: COMPONENT_COLORS.TEXT_SECONDARY, fontSize: '12px' }} />
          ) : (
            <CaretRightOutlined style={{ color: COMPONENT_COLORS.TEXT_SECONDARY, fontSize: '12px' }} />
          );
        }}
        showLine={false} // Remove lines since we have custom icons
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
