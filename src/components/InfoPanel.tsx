/**
 * @fileoverview InfoPanel Component
 * 
 * Combined info panel that displays grouping controls, legend, and container hierarchy
 * with collapsible sections for organizing the interface.
 */

import React, { useState, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { Button } from 'antd';
import { InfoPanelProps, HierarchyTreeNode, LegendData } from './types';
import { CollapsibleSection } from './CollapsibleSection';
import { GroupingControls } from './GroupingControls';
import { HierarchyTree } from './HierarchyTree';
import { Legend } from './Legend';
import { EdgeStyleLegend } from './EdgeStyleLegend';
import { SearchControls, type SearchMatch, type SearchControlsRef } from './SearchControls';
import { COMPONENT_COLORS, TYPOGRAPHY } from '../shared/config';

export interface InfoPanelRef {
  focusSearch: () => void;
  clearSearch: () => void;
}

export const InfoPanel = forwardRef<InfoPanelRef, InfoPanelProps & { 
  open?: boolean; 
  onOpenChange?: (open: boolean) => void; 
  onSearchUpdate?: (query: string, matches: SearchMatch[], current?: SearchMatch) => void 
}>(({
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
  onOpenChange,
  onSearchUpdate
}, ref) => {
  const [legendCollapsed, setLegendCollapsed] = useState(true); // Start expanded so users can see it
  const [edgeStyleCollapsed, setEdgeStyleCollapsed] = useState(true);
  const [groupingCollapsed, setGroupingCollapsed] = useState(false);
  // Search state (containers-only to start)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [currentSearchMatch, setCurrentSearchMatch] = useState<SearchMatch | undefined>(undefined);
  const searchControlsRef = useRef<SearchControlsRef>(null);

  useImperativeHandle(ref, () => ({
    focusSearch: () => searchControlsRef.current?.focus(),
    clearSearch: () => searchControlsRef.current?.clear(),
  }));

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

  // Index all containers (including nested, even if hidden due to collapse)
  // Build parent relationships from visualizationState
  const parentMap = useMemo(() => {
    const result = new Map<string, string>();
    if (!visualizationState) return result;

    // Build parent relationships by scanning container children
    visualizationState.visibleContainers.forEach((container: any) => {
      const children = visualizationState.getContainerChildren?.(container.id);
      if (children) {
        children.forEach((childId: string) => {
          const childContainer = visualizationState.getContainer?.(childId);
          if (childContainer) {
            // Record parent relationship based on actual container graph
            result.set(childId, container.id);
          }
        });
      }
    });
    return result;
  }, [visualizationState]);

  // Build hierarchy tree from full container graph starting at roots (parent=null)
  const hierarchyTree = useMemo((): HierarchyTreeNode[] => {
    if (!visualizationState || visualizationState.visibleContainers.length === 0) return [];

    const buildNode = (containerId: string): HierarchyTreeNode => {
      // Only build the container hierarchy structure - all display data comes from visualizationState
      const childrenIds: string[] = [];
      const cc = visualizationState.getContainerChildren?.(containerId);
      cc?.forEach((childId: string) => {
        if (visualizationState.getContainer?.(childId)) childrenIds.push(childId);
      });
      const children: HierarchyTreeNode[] = childrenIds.map(buildNode);
      return { id: containerId, children };
    };

    // Find root containers (containers with no parent)
    const roots: string[] = [];
    visualizationState.visibleContainers.forEach((container: any) => {
      if (!parentMap.has(container.id)) roots.push(container.id);
    });
    return roots.map(buildNode);
  }, [visualizationState, parentMap]);

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

  // Build searchable items from hierarchy (containers) and visible nodes
  const searchableItems = useMemo(() => {
    const items: Array<{ id: string; label: string; type: 'container' | 'node' }> = [];
    // Containers from visualizationState
    if (visualizationState) {
      visualizationState.visibleContainers.forEach((container: any) => {
        const label = container?.data?.label || container?.label || container.id;
        items.push({ id: container.id, label, type: 'container' });
      });
      // Visible nodes from visualization state
      visualizationState.visibleNodes.forEach((node: any) => {
        const label = node?.data?.label || node?.label || node?.id;
        items.push({ id: node.id, label, type: 'node' });
      });
    }
    return items;
  }, [visualizationState]);

  // Map node matches to their parent container matches for tree highlighting
  const toContainerMatches = useMemo(() => {
    // Build reverse index of node -> parent containers by scanning container children
    const nodeParents = new Map<string, Set<string>>();
    if (visualizationState) {
      visualizationState.visibleContainers.forEach((container: any) => {
        const cc = visualizationState.getContainerChildren?.(container.id);
        cc?.forEach((childId: string) => {
          // if child is NOT a container, treat as node
          const isContainer = !!visualizationState.getContainer?.(childId);
          if (!isContainer) {
            if (!nodeParents.has(childId)) nodeParents.set(childId, new Set());
            nodeParents.get(childId)!.add(container.id);
          }
        });
      });
    }
    return (matches: SearchMatch[]): SearchMatch[] => {
      const out: SearchMatch[] = [];
      const seen = new Set<string>();
      for (const m of matches) {
        if (m.type === 'container') {
          if (!seen.has(m.id)) { out.push(m); seen.add(m.id); }
        } else {
          const parents = Array.from(nodeParents.get(m.id) || []);
          parents.forEach(cid => {
            if (!seen.has(cid)) { out.push({ id: cid, label: cid, type: 'container' }); seen.add(cid); }
          });
        }
      }
      return out;
    };
  }, [visualizationState]);

  // Handlers from SearchControls
  const handleSearch = (query: string, matches: SearchMatch[]) => {
    // DEBUG: Log search results to help debug highlighting issues
    console.log('🔍 InfoPanel handleSearch:', { query, matches });
    console.log('🔍 Container matches:', matches.filter(m => m.type === 'container'));
    console.log('🔍 Node matches:', matches.filter(m => m.type === 'node'));
    
    setSearchQuery(query);
    setSearchMatches(matches);
    setCurrentSearchMatch(matches.length ? matches[0] : undefined);
  onSearchUpdate?.(query, matches, matches.length ? matches[0] : undefined);
  };
  const handleSearchClear = () => {
    setSearchQuery('');
    setSearchMatches([]);
    setCurrentSearchMatch(undefined);
  onSearchUpdate?.('', [], undefined);
  };
  const handleSearchNavigate = (_dir: 'prev' | 'next', current: SearchMatch) => {
    setCurrentSearchMatch(current);
  onSearchUpdate?.(searchQuery, searchMatches, current);
  };

  // Panel style
  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    top: 10, // position to occlude the button
    right: 8, // right side instead of left
    zIndex: 1200,
    minWidth: 280,
    maxWidth: 340,
    background: '#fff',
    boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
    borderRadius: 2,
    border: '1px solid #eee',
    padding: 20,
    transition: 'transform 0.3s cubic-bezier(.4,0,.2,1), opacity 0.2s',
    transform: open ? 'translateX(0)' : 'translateX(120%)', // slide from right
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
            {/* Search + Hierarchy Tree */}
            {hierarchyTree.length > 0 && (
              <div>
                <SearchControls
                  ref={searchControlsRef}
                  searchableItems={searchableItems}
                  onSearch={handleSearch}
                  onClear={handleSearchClear}
                  onNavigate={handleSearchNavigate}
                  placeholder="Search containers (wildcards: * ?)"
                  compact
                />
                <HierarchyTree
                  hierarchyTree={hierarchyTree}
                  collapsedContainers={collapsedContainers}
                  visualizationState={visualizationState}
                  onToggleContainer={(containerId) => {
                    // Ensure both tree and graph stay in sync
                    if (onToggleContainer) {
                      onToggleContainer(containerId);
                    }
                  }}
                  title={`${currentGroupingName} Hierarchy`}
                  showNodeCounts={true}
                  truncateLabels={true}
                  maxLabelLength={15}
                  // search integration - pass ALL matches (containers + nodes), not just containers
                  searchQuery={searchQuery}
                  searchMatches={searchMatches}
                  currentSearchMatch={currentSearchMatch}
                />
              </div>
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
});

// Re-export sub-components for individual use
export { Legend } from './Legend';
export { HierarchyTree } from './HierarchyTree';
export { GroupingControls } from './GroupingControls';
export { CollapsibleSection } from './CollapsibleSection';
