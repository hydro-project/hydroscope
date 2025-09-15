/**
 * @fileoverview InfoPanel Component
 *
 * Combined info panel that displays grouping controls, legend, and container hierarchy
 * with collapsible sections for organizing the interface.
 */

import React, { useState, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { Button } from 'antd';
import { InfoPanelProps, LegendData } from './types';
import { CollapsibleSection } from './CollapsibleSection';
import { GroupingControls } from './GroupingControls';
import { HierarchyTree } from './HierarchyTree';
import { Legend } from './Legend';
import { EdgeStyleLegend } from './EdgeStyleLegend';
import { SearchControls, type SearchMatch, type SearchControlsRef } from './SearchControls';
import { TYPOGRAPHY, PANEL_CONSTANTS } from '../shared/config';

interface VisualizationNode {
  id: string;
  nodeType?: string;
  style?: string;
  label?: string;
  data?: {
    nodeType?: string;
    label?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface VisualizationContainer {
  id: string;
  label?: string;
  data?: {
    label?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface InfoPanelRef {
  focusSearch: () => void;
  clearSearch: () => void;
}

export const InfoPanel = forwardRef<
  InfoPanelRef,
  InfoPanelProps & {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onSearchUpdate?: (query: string, matches: SearchMatch[], current?: SearchMatch) => void;
  }
>(
  (
    {
      visualizationState,
      legendData,
      edgeStyleConfig,
      hierarchyChoices = [],
      currentGrouping,
      onGroupingChange,
      collapsedContainers = new Set(),
      onToggleContainer,
      colorPalette = 'Set3',
      defaultCollapsed: _defaultCollapsed = false,
      className: _className = '',
      style: _style,
      open = true,
      onOpenChange,
      onSearchUpdate,
    },
    ref
  ) => {
    const [legendCollapsed, setLegendCollapsed] = useState(true); // Start expanded so users can see it
    const [edgeStyleCollapsed, setEdgeStyleCollapsed] = useState(true);
    const [groupingCollapsed, setGroupingCollapsed] = useState(false);
    // Search state (containers-only to start)
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
    const [currentSearchMatch, setCurrentSearchMatch] = useState<SearchMatch | undefined>(
      undefined
    );
    const searchControlsRef = useRef<SearchControlsRef>(null);

    useImperativeHandle(ref, () => ({
      focusSearch: () => searchControlsRef.current?.focus(),
      clearSearch: () => searchControlsRef.current?.clear(),
    }));

    // Get default legend data if none provided
    const defaultLegendData: LegendData = {
      title: 'Node Types',
      items: [],
    };

    // Generate legend data from actual node types in the visualization
    const generateLegendFromState = (): LegendData => {
      if (!visualizationState) return defaultLegendData;

      const nodeTypes = new Set<string>();

      // Collect all unique node types from visible nodes
      visualizationState.visibleNodes.forEach((node: VisualizationNode) => {
        // Support nodeType possibly nested under a data field
        const nodeType = node.nodeType || node?.data?.nodeType || node.style || 'default';
        nodeTypes.add(nodeType);
      });

      return {
        title: 'Node Types',
        items: Array.from(nodeTypes).map(nodeType => ({
          type: nodeType,
          label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1),
        })),
      };
    };

    // Ensure we always have valid legend data
    const effectiveLegendData =
      legendData && legendData.items && Array.isArray(legendData.items)
        ? legendData
        : generateLegendFromState();

    // Ensure hierarchyChoices is always an array
    const safeHierarchyChoices = Array.isArray(hierarchyChoices) ? hierarchyChoices : [];

    // Get the current grouping name for the section title
    const currentGroupingName =
      safeHierarchyChoices.find(choice => choice.id === currentGrouping)?.name || 'Container';

    // Build searchable items from hierarchy (containers) and visible nodes
    const searchableItems = useMemo(() => {
      const items: Array<{ id: string; label: string; type: 'container' | 'node' }> = [];
      // Containers from visualizationState
      if (visualizationState) {
        visualizationState.visibleContainers.forEach((container: VisualizationContainer) => {
          const label = container?.data?.label || container?.label || container.id;
          items.push({ id: container.id, label, type: 'container' });
        });
        // All nodes from visualization state (not just visible ones, so users can search for nodes in collapsed containers)
        visualizationState.allNodes.forEach((node: VisualizationNode) => {
          const label = node?.data?.label || node?.label || node?.id;
          items.push({ id: node.id, label, type: 'node' });
        });
      }
      return items;
    }, [visualizationState]);

    // Handlers from SearchControls
    const handleSearch = (query: string, matches: SearchMatch[]) => {
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
      top: PANEL_CONSTANTS.PANEL_TOP,
      right: PANEL_CONSTANTS.PANEL_RIGHT,
      zIndex: 1200,
      minWidth: PANEL_CONSTANTS.INFO_PANEL_MIN_WIDTH,
      maxWidth: PANEL_CONSTANTS.INFO_PANEL_MAX_WIDTH,
      background: '#fff',
      boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      borderRadius: 2,
      border: '1px solid #eee',
      padding: PANEL_CONSTANTS.INFO_PANEL_PADDING,
      transition: 'transform 0.3s cubic-bezier(.4,0,.2,1), opacity 0.2s',
      transform: open ? 'translateX(0)' : 'translateX(120%)', // slide from right
      opacity: open ? 1 : 0,
      pointerEvents: open ? 'auto' : 'none',
    };

    // Custom button style for open/close, matching CustomControls
    const controlButtonStyle: React.CSSProperties = {
      fontSize: PANEL_CONSTANTS.FONT_SIZE_LARGE,
      color: '#222',
      marginLeft: PANEL_CONSTANTS.COMPONENT_PADDING / 1.5, // 8px
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      border: '1px solid #3b82f6',
      borderRadius: PANEL_CONSTANTS.COMPONENT_BORDER_RADIUS,
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
      backgroundColor:
        btnHover || btnFocus ? 'rgba(59,130,246,0.18)' : controlButtonStyle.backgroundColor,
      boxShadow:
        btnHover || btnFocus ? '0 2px 8px rgba(59,130,246,0.16)' : controlButtonStyle.boxShadow,
      borderColor: btnHover || btnFocus ? '#2563eb' : '#3b82f6',
    };

    return (
      <div style={panelStyle}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: PANEL_CONSTANTS.FONT_SIZE_MEDIUM }}>
            Graph Info
          </span>
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
        <div
          style={{
            fontSize: TYPOGRAPHY.INFOPANEL_BASE,
            maxHeight: '68vh',
            overflowY: 'auto',
            paddingRight: 4,
          }}
        >
          {/* Grouping & Hierarchy Section */}
          {(safeHierarchyChoices.length > 0 ||
            (visualizationState && visualizationState.visibleContainers.length > 0)) && (
            <CollapsibleSection
              title="Grouping"
              isCollapsed={groupingCollapsed}
              onToggle={() => setGroupingCollapsed(!groupingCollapsed)}
            >
              {/* Grouping Controls */}
              {safeHierarchyChoices.length > 0 && (
                <div style={{ marginBottom: PANEL_CONSTANTS.COMPONENT_PADDING / 1.5 }}>
                  {' '}
                  {/* 8px */}
                  <GroupingControls
                    hierarchyChoices={safeHierarchyChoices}
                    currentGrouping={currentGrouping}
                    onGroupingChange={onGroupingChange}
                    compact={true}
                  />
                </div>
              )}
              {/* Search + Hierarchy Tree */}
              {visualizationState && visualizationState.visibleContainers.length > 0 && (
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
                    collapsedContainers={collapsedContainers}
                    visualizationState={visualizationState}
                    onToggleContainer={containerId => {
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
              <EdgeStyleLegend edgeStyleConfig={edgeStyleConfig} compact={true} />
            </CollapsibleSection>
          )}
          {/* Node Legend Section */}
          <CollapsibleSection
            title={effectiveLegendData.title}
            isCollapsed={legendCollapsed}
            onToggle={() => setLegendCollapsed(!legendCollapsed)}
          >
            <Legend legendData={effectiveLegendData} colorPalette={colorPalette} compact={true} />
          </CollapsibleSection>
        </div>
      </div>
    );
  }
);

InfoPanel.displayName = 'InfoPanel';

// Re-export sub-components for individual use
export { Legend } from './Legend';
export { HierarchyTree } from './HierarchyTree';
export { GroupingControls } from './GroupingControls';
export { CollapsibleSection } from './CollapsibleSection';
