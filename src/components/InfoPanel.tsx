/**
 * @fileoverview InfoPanel Component
 * 
 * Combined info panel that displays grouping controls, legend, and container hierarchy
 * with collapsible sections for organizing the interface.
 */

import React, { useState, useMemo } from 'react';
import { Button } from 'antd';
import { InfoPanelProps, HierarchyTreeNode, LegendData } from './types';
import { CollapsibleSection } from './CollapsibleSection';
import { GroupingControls } from './GroupingControls';
import { HierarchyTree } from './HierarchyTree';
import { Legend } from './Legend';
import { EdgeStyleLegend } from './EdgeStyleLegend';
import { COMPONENT_COLORS, TYPOGRAPHY } from '../shared/config';

export function InfoPanel({
  visualizationState,
  legendData,
  edgeStyleConfig,
  hierarchyChoices = [],
  currentGrouping,
  onGroupingChange,
  collapsedContainers = new Set(),
  onToggleContainer,
  colorPalette = 'Set3',
  defaultCollapsed = false,
  className = '',
  style,
  open = true,
  onOpenChange
}: InfoPanelProps & { open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [legendCollapsed, setLegendCollapsed] = useState(true); // Start expanded so users can see it
  const [edgeStyleCollapsed, setEdgeStyleCollapsed] = useState(true);
  const [groupingCollapsed, setGroupingCollapsed] = useState(false);

  // Get default legend data if none provided
  const defaultLegendData: LegendData = {
    title: "Node Types",
    items: []
  };

  // Generate legend data from actual node types in the visualization
  const generateLegendFromState = (): LegendData => {
    if (!visualizationState) return defaultLegendData;
    
    const nodeTypes = new Set<string>();
    
    // Collect all unique node types from visible nodes
    visualizationState.visibleNodes.forEach(node => {
      // Support nodeType possibly nested under a data field
      const nodeType = (node as any).nodeType || (node as any)?.data?.nodeType || (node as any).style || 'default';
      nodeTypes.add(nodeType);
    });
    
    return {
      title: "Node Types",
      items: Array.from(nodeTypes).map(nodeType => ({
        type: nodeType,
        label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1)
      }))
    };
  };

  // Ensure we always have valid legend data
  const effectiveLegendData = (legendData && legendData.items && Array.isArray(legendData.items)) 
    ? legendData 
    : generateLegendFromState();
  
  // Ensure hierarchyChoices is always an array
  const safeHierarchyChoices = Array.isArray(hierarchyChoices) ? hierarchyChoices : [];

  // Get the current grouping name for the section title
  const currentGroupingName = safeHierarchyChoices.find(choice => choice.id === currentGrouping)?.name || 'Container';

    // Build hierarchy tree structure from visualization state
  const hierarchyTree = useMemo((): HierarchyTreeNode[] => {
    if (!visualizationState) {
      return [];
    }

    const containers = visualizationState.visibleContainers;
    if (containers.length === 0) {
      return [];
    }

    // Create a map of container ID to container info with proper parent detection
    const containerMap = new Map<string, HierarchyTreeNode & { parentId: string | null }>();
    
    containers.forEach(container => {
      // Find parent by checking which container has this container as a child
      let parentId: string | null = null;
      for (const potentialParent of containers) {
        if (potentialParent.id !== container.id && potentialParent.children && potentialParent.children.has && potentialParent.children.has(container.id)) {
          parentId = potentialParent.id;
          break;
        }
      }
      
      containerMap.set(container.id, {
        id: container.id,
        label: (container as any).data?.label || (container as any).label || container.id, // Try data.label, then label, then fallback to id
        children: [],
        nodeCount: container.children ? container.children.size : 0,
        parentId: parentId,
      });
    });

    // Recursively build tree structure 
    const buildTree = (parentId: string | null): HierarchyTreeNode[] => {
      const children: HierarchyTreeNode[] = [];
      for (const container of containerMap.values()) {
        if (container.parentId === parentId) {
          const grandchildren = buildTree(container.id);
          children.push({
            id: container.id,
            label: container.label,
            children: grandchildren,
            nodeCount: container.nodeCount
          });
        }
      }
      return children;
    };

    return buildTree(null); // Start with root containers (no parent)
  }, [visualizationState, collapsedContainers]); // Add collapsedContainers as dependency

  // Count immediate leaf (non-container) children of a container
  const countLeafChildren = (containerId: string): number => {
    const children = visualizationState?.getContainerChildren(containerId);
    if (!children) return 0;
    
    // Count children that are not containers themselves
    let leafCount = 0;
    children.forEach(childId => {
      const isContainer = visualizationState.getContainer(childId) !== undefined;
      if (!isContainer) {
        leafCount++;
      }
    });
    return leafCount;
  };

  // Panel style
  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    top: 10, // position to occlude the button
    left: 8, // nearly flush with edge
    zIndex: 1200,
    minWidth: 280,
    maxWidth: 340,
    background: '#fff',
    boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
    borderRadius: 2,
    border: '1px solid #eee',
    padding: 20,
    transition: 'transform 0.3s cubic-bezier(.4,0,.2,1), opacity 0.2s',
    transform: open ? 'translateX(0)' : 'translateX(-120%)', // slide from left
    opacity: open ? 1 : 0,
    pointerEvents: open ? 'auto' : 'none',
  };

  // Custom button style for open/close, matching CustomControls
  const controlButtonStyle: React.CSSProperties = {
    fontSize: 18,
    color: '#222',
    marginLeft: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid #3b82f6',
    borderRadius: 4,
    boxShadow: '0 1px 4px rgba(59,130,246,0.08)',
    transition: 'background 0.18s, box-shadow 0.18s',
    padding: '2px 8px',
    outline: 'none',
    cursor: 'pointer',
  };

  // Add hover/focus effect via inline event handlers
  const [btnHover, setBtnHover] = useState(false);
  const [btnFocus, setBtnFocus] = useState(false);
  const mergedButtonStyle = {
    ...controlButtonStyle,
    backgroundColor: btnHover || btnFocus ? 'rgba(59,130,246,0.18)' : controlButtonStyle.backgroundColor,
    boxShadow: btnHover || btnFocus ? '0 2px 8px rgba(59,130,246,0.16)' : controlButtonStyle.boxShadow,
    borderColor: btnHover || btnFocus ? '#2563eb' : '#3b82f6',
  };

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 16 }}>Graph Info</span>
        <Button
          type="text"
          size="small"
          onClick={() => onOpenChange?.(false)}
          style={mergedButtonStyle}
          onMouseEnter={() => setBtnHover(true)}
          onMouseLeave={() => setBtnHover(false)}
          onFocus={() => setBtnFocus(true)}
          onBlur={() => setBtnFocus(false)}
        >
          ×
        </Button>
      </div>
      <div style={{ fontSize: TYPOGRAPHY.INFOPANEL_BASE, maxHeight: '68vh', overflowY: 'auto', paddingRight: 4 }}>
        {/* Grouping & Hierarchy Section */}
        {(safeHierarchyChoices.length > 0 || hierarchyTree.length > 0) && (
          <CollapsibleSection
            title="Grouping"
            isCollapsed={groupingCollapsed}
            onToggle={() => setGroupingCollapsed(!groupingCollapsed)}
          >
            {/* Grouping Controls */}
            {safeHierarchyChoices.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <GroupingControls
                  hierarchyChoices={safeHierarchyChoices}
                  currentGrouping={currentGrouping}
                  onGroupingChange={onGroupingChange}
                  compact={true}
                />
              </div>
            )}
            {/* Hierarchy Tree */}
            {hierarchyTree.length > 0 && (
              <HierarchyTree
                hierarchyTree={hierarchyTree}
                collapsedContainers={collapsedContainers}
                onToggleContainer={onToggleContainer}
                title={`${currentGroupingName} Hierarchy`}
                showNodeCounts={true}
                truncateLabels={true}
                maxLabelLength={15}
              />
            )}
          </CollapsibleSection>
        )}
        {/* Edge Style Legend Section - Show whenever edgeStyleConfig exists */}
        {edgeStyleConfig && (
          <CollapsibleSection
            title="Edge Styles"
            isCollapsed={edgeStyleCollapsed}
            onToggle={() => setEdgeStyleCollapsed(!edgeStyleCollapsed)}
          >
            <EdgeStyleLegend
              edgeStyleConfig={edgeStyleConfig}
              compact={true}
            />
          </CollapsibleSection>
        )}
        {/* Node Legend Section */}
        <CollapsibleSection
          title={effectiveLegendData.title}
          isCollapsed={legendCollapsed}
          onToggle={() => setLegendCollapsed(!legendCollapsed)}
        >
          <Legend
            legendData={effectiveLegendData}
            colorPalette={colorPalette}
            compact={true}
          />
        </CollapsibleSection>
      </div>
    </div>
  );
}

// Re-export sub-components for individual use
export { Legend } from './Legend';
export { HierarchyTree } from './HierarchyTree';
export { GroupingControls } from './GroupingControls';
export { CollapsibleSection } from './CollapsibleSection';
