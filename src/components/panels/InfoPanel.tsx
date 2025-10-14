/**
 * @fileoverview InfoPanel Component
 *
 * Combined info panel that displays grouping controls, legend, and container hierarchy
 * with collapsible sections for organizing the interface.
 */
import React, {
  useState,
  useMemo,
  useRef,
  useImperativeHandle,
  forwardRef,
  memo,
  useEffect,
} from "react";
import { Button } from "antd";
import { InfoPanelProps, LegendData } from "../types";
import { CollapsibleSection } from "../CollapsibleSection";
import { GroupingControls } from "../GroupingControls";
import { HierarchyTree } from "../HierarchyTree";
import { Legend } from "../Legend";
import {
  SearchControls,
  SearchMatch,
  SearchControlsRef,
} from "../SearchControls";
import { EdgeStyleLegend } from "../EdgeStyleLegend";
import { TYPOGRAPHY, PANEL_CONSTANTS } from "../../shared/config";
import { clearSearchPanelImperatively } from "../../utils/searchClearUtils.js";
import { togglePanelImperatively } from "../../utils/panelOperationUtils.js";

/**
 * Link icon component - shows a chain link when sync is enabled
 */
const LinkIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    style={{ display: "block" }}
  >
    <path d="M6.879 9.934a.81.81 0 0 1-.575-.238 3.818 3.818 0 0 1 0-5.392l3-3C10.024.584 10.982.187 12 .187s1.976.397 2.696 1.117a3.818 3.818 0 0 1 0 5.392l-1.371 1.371a.813.813 0 0 1-1.149-1.149l1.371-1.371A2.19 2.19 0 0 0 12 1.812c-.584 0-1.133.228-1.547.641l-3 3a2.19 2.19 0 0 0 0 3.094.813.813 0 0 1-.575 1.387z" />
    <path d="M4 15.813a3.789 3.789 0 0 1-2.696-1.117 3.818 3.818 0 0 1 0-5.392l1.371-1.371a.813.813 0 0 1 1.149 1.149l-1.371 1.371A2.19 2.19 0 0 0 4 14.187c.584 0 1.133-.228 1.547-.641l3-3a2.19 2.19 0 0 0 0-3.094.813.813 0 0 1 1.149-1.149 3.818 3.818 0 0 1 0 5.392l-3 3A3.789 3.789 0 0 1 4 15.813z" />
  </svg>
);

/**
 * Broken link icon component - shows a broken chain link when sync is disabled
 */
const BrokenLinkIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    style={{ display: "block" }}
  >
    <path d="M13.547 2.453a3.789 3.789 0 0 0-2.696-1.117h-.038a.813.813 0 0 0 0 1.625h.038c.584 0 1.133.228 1.547.641a2.19 2.19 0 0 1 0 3.094l-1.371 1.371a.813.813 0 0 0 1.149 1.149l1.371-1.371a3.818 3.818 0 0 0 0-5.392z" />
    <path d="M4 15.813a3.789 3.789 0 0 1-2.696-1.117 3.818 3.818 0 0 1 0-5.392l1.371-1.371a.813.813 0 0 1 1.149 1.149l-1.371 1.371A2.19 2.19 0 0 0 4 14.187c.584 0 1.133-.228 1.547-.641l3-3a2.19 2.19 0 0 0 0-3.094.813.813 0 0 1 1.149-1.149 3.818 3.818 0 0 1 0 5.392l-3 3A3.789 3.789 0 0 1 4 15.813z" />
    <path
      d="M3.5 4.5L5 6M11 10l1.5 1.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export interface InfoPanelRef {
  focusSearch: () => void;
  clearSearch: () => void;
}
const InfoPanelInternal = forwardRef<
  InfoPanelRef,
  InfoPanelProps & {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onSearchUpdate?: (
      query: string,
      matches: SearchMatch[],
      current?: SearchMatch,
    ) => void;
    syncTreeAndGraph?: boolean;
    onSyncTreeAndGraphChange?: (enabled: boolean) => void;
  }
>(
  (
    {
      visualizationState,
      legendData,
      edgeStyleConfig,
      nodeTypeConfig,
      hierarchyChoices = [],
      currentGrouping,
      onGroupingChange,
      collapsedContainers = new Set(),
      onToggleContainer,
      onElementNavigation,
      layoutOrchestrator,
      asyncCoordinator,
      colorPalette = "Set3",
      defaultCollapsed: _defaultCollapsed = false,
      className: _className = "",
      style: _style,
      open = true,
      onOpenChange,
      onSearchUpdate,
      syncTreeAndGraph = true,
      onSyncTreeAndGraphChange,
    },
    ref,
  ) => {
    const [legendCollapsed, setLegendCollapsed] = useState(true); // Start expanded so users can see it
    const [edgeStyleCollapsed, setEdgeStyleCollapsed] = useState(true);
    const [groupingCollapsed, setGroupingCollapsed] = useState(false);
    // Search state (containers-only to start)
    const [searchQuery, setSearchQuery] = useState("");
    const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
    const [currentSearchMatch, setCurrentSearchMatch] = useState<
      SearchMatch | undefined
    >(undefined);
    const searchControlsRef = useRef<SearchControlsRef>(null);
    useImperativeHandle(ref, () => ({
      focusSearch: () => searchControlsRef.current?.focus(),
      clearSearch: () => searchControlsRef.current?.clear(),
    }));

    // ResizeObserver error suppression during panel operations
    useEffect(() => {
      let suppressionTimer: NodeJS.Timeout | null = null;

      const suppressResizeObserverErrors = () => {
        const originalError = window.console.error;
        const suppressedError = (...args: any[]) => {
          const message = args[0]?.toString() || "";
          if (message.includes("ResizeObserver loop limit exceeded")) {
            // Suppress ResizeObserver loop errors during panel operations
            if (process.env.NODE_ENV === "development") {
              console.log(
                "[InfoPanel] Suppressed ResizeObserver error during panel operation",
              );
            }
            return;
          }
          originalError.apply(console, args);
        };

        window.console.error = suppressedError;

        // Clear any existing timer
        if (suppressionTimer) {
          clearTimeout(suppressionTimer);
        }

        // Restore original error handler after panel operations settle
        suppressionTimer = setTimeout(() => {
          window.console.error = originalError;
          suppressionTimer = null;
        }, 300);
      };

      // Suppress errors when any panel section state changes
      suppressResizeObserverErrors();

      return () => {
        if (suppressionTimer) {
          clearTimeout(suppressionTimer);
        }
      };
    }, [legendCollapsed, groupingCollapsed, edgeStyleCollapsed, open]);
    // Get default legend data if none provided
    const defaultLegendData: LegendData = {
      title: "Node Types",
      items: [],
    };
    // Generate legend data from actual node types in the visualization
    const generateLegendFromState = (): LegendData => {
      if (!visualizationState) {
        return defaultLegendData;
      }
      const nodeTypes = new Set<string>();
      // Collect all unique node types from visible nodes
      const visibleNodes = visualizationState.visibleNodes || [];
      visibleNodes.forEach((node) => {
        // Support type property (standard) and nodeType (legacy) possibly nested under a data field
        const nodeType =
          (node as any).type ||
          (node as any).nodeType ||
          (node as any)?.data?.nodeType ||
          (node as any).style ||
          "default";
        nodeTypes.add(nodeType);
      });
      // If no visible nodes or no node types found, fall back to nodeTypeConfig
      if (
        nodeTypes.size === 0 &&
        nodeTypeConfig?.types &&
        Array.isArray(nodeTypeConfig.types)
      ) {
        nodeTypeConfig.types.forEach(
          (typeConfig: {
            id: string;
            label?: string;
            colorIndex?: number;
            description?: string;
          }) => {
            nodeTypes.add(typeConfig.id);
          },
        );
      }
      // Create legend items, using nodeTypeConfig if available
      const items = Array.from(nodeTypes).map((nodeType) => {
        // Look for this node type in nodeTypeConfig
        const typeConfig =
          nodeTypeConfig?.types && Array.isArray(nodeTypeConfig.types)
            ? nodeTypeConfig.types.find(
                (t: {
                  id: string;
                  label?: string;
                  colorIndex?: number;
                  description?: string;
                }) => t.id === nodeType,
              )
            : undefined;
        return {
          type: nodeType,
          label:
            typeConfig?.label ||
            nodeType.charAt(0).toUpperCase() + nodeType.slice(1),
          description: typeConfig?.description,
          color:
            typeConfig?.colorIndex !== undefined
              ? `color-${typeConfig.colorIndex}`
              : undefined,
        };
      });
      return {
        title: "Node Types",
        items,
      };
    };
    // Ensure we always have valid legend data
    const effectiveLegendData =
      legendData && legendData.items && Array.isArray(legendData.items)
        ? legendData
        : generateLegendFromState();
    // Ensure hierarchyChoices is always an array
    const safeHierarchyChoices = Array.isArray(hierarchyChoices)
      ? hierarchyChoices
      : [];
    // Get the current grouping name for the section title
    const currentGroupingName =
      safeHierarchyChoices.find((choice) => choice.id === currentGrouping)
        ?.name || "Container";
    // Build searchable items from hierarchy (containers) and visible nodes
    const searchableItems = useMemo(() => {
      const items: Array<{
        id: string;
        label: string;
        type: "container" | "node";
      }> = [];
      // Containers from visualizationState
      if (visualizationState) {
        visualizationState.visibleContainers?.forEach((container) => {
          const label =
            (container as any)?.data?.label || container?.label || container.id;
          items.push({ id: container.id, label, type: "container" });
        });
        // Use visible nodes since allNodes doesn't exist in v1.0.0
        const visibleNodes = visualizationState.visibleNodes || [];
        visibleNodes.forEach((node) => {
          const label =
            (node as any)?.data?.label || (node as any)?.label || node.id;
          items.push({ id: node.id, label, type: "node" });
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
      clearSearchPanelImperatively({
        setSearchQuery,
        setSearchMatches,
        setCurrentSearchMatch,
        debug: process.env.NODE_ENV === "development",
      });
    };

    // Imperative panel section toggle handlers
    const handleLegendToggle = () => {
      togglePanelImperatively({
        panelId: "legend",
        setState: setLegendCollapsed,
        currentState: legendCollapsed,
        debounce: true,
        debug: process.env.NODE_ENV === "development",
      });
    };

    const handleGroupingToggle = () => {
      togglePanelImperatively({
        panelId: "grouping",
        setState: setGroupingCollapsed,
        currentState: groupingCollapsed,
        debounce: true,
        debug: process.env.NODE_ENV === "development",
      });
    };

    const handleEdgeStyleToggle = () => {
      togglePanelImperatively({
        panelId: "edgeStyles",
        setState: setEdgeStyleCollapsed,
        currentState: edgeStyleCollapsed,
        debounce: true,
        debug: process.env.NODE_ENV === "development",
      });
    };

    // Batched panel operations for bulk actions

    const handleSearchNavigate = (
      _dir: "prev" | "next",
      current: SearchMatch,
    ) => {
      setCurrentSearchMatch(current);
      onSearchUpdate?.(searchQuery, searchMatches, current);
    };
    // Panel style with ResizeObserver loop prevention
    const panelStyle: React.CSSProperties = {
      position: "absolute",
      top: PANEL_CONSTANTS.PANEL_TOP,
      right: PANEL_CONSTANTS.PANEL_RIGHT,
      zIndex: 1200,
      minWidth: PANEL_CONSTANTS.INFO_PANEL_MIN_WIDTH,
      maxWidth: PANEL_CONSTANTS.INFO_PANEL_MAX_WIDTH,
      background: "#fff",
      boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
      borderRadius: 2,
      border: "1px solid #eee",
      padding: PANEL_CONSTANTS.INFO_PANEL_PADDING,
      transition: "transform 0.3s cubic-bezier(.4,0,.2,1), opacity 0.2s",
      transform: open ? "translateX(0)" : "translateX(120%)", // slide from right
      opacity: open ? 1 : 0,
      pointerEvents: open ? "auto" : "none",
      // Prevent layout thrashing during panel operations
      containIntrinsicSize: "auto 400px", // Provide size hint to prevent layout shifts
      contentVisibility: open ? "visible" : "hidden", // Optimize rendering for closed panels
    };
    // Custom button style for open/close, matching CustomControls
    const controlButtonStyle: React.CSSProperties = {
      fontSize: PANEL_CONSTANTS.FONT_SIZE_LARGE,
      color: "#222",
      marginLeft: PANEL_CONSTANTS.COMPONENT_PADDING / 1.5, // 8px
      backgroundColor: "rgba(59, 130, 246, 0.1)",
      border: "1px solid #3b82f6",
      borderRadius: PANEL_CONSTANTS.COMPONENT_BORDER_RADIUS,
      boxShadow: "0 1px 4px rgba(59,130,246,0.08)",
      transition: "background 0.18s, box-shadow 0.18s",
      padding: "2px 8px",
      outline: "none",
      cursor: "pointer",
    };
    // Add hover/focus effect via inline event handlers
    const [btnHover, setBtnHover] = useState(false);
    const [btnFocus, setBtnFocus] = useState(false);
    const mergedButtonStyle = {
      ...controlButtonStyle,
      backgroundColor:
        btnHover || btnFocus
          ? "rgba(59,130,246,0.18)"
          : controlButtonStyle.backgroundColor,
      boxShadow:
        btnHover || btnFocus
          ? "0 2px 8px rgba(59,130,246,0.16)"
          : controlButtonStyle.boxShadow,
      borderColor: btnHover || btnFocus ? "#2563eb" : "#3b82f6",
    };
    return (
      <div style={panelStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontWeight: 600,
              fontSize: PANEL_CONSTANTS.FONT_SIZE_MEDIUM,
            }}
          >
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
            maxHeight: "68vh",
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          {/* Grouping & Hierarchy Section */}
          {(safeHierarchyChoices.length > 0 || visualizationState) && (
            <CollapsibleSection
              title="Grouping"
              isCollapsed={groupingCollapsed}
              onToggle={handleGroupingToggle}
            >
              {/* Grouping Controls */}
              {safeHierarchyChoices.length > 0 && (
                <div
                  style={{
                    marginBottom: PANEL_CONSTANTS.COMPONENT_PADDING / 1.5,
                  }}
                >
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
              {visualizationState && (
                <div>
                  {/* Sync Control Button */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "8px",
                      padding: "4px 8px",
                      backgroundColor: syncTreeAndGraph
                        ? "rgba(59, 130, 246, 0.05)"
                        : "rgba(128, 128, 128, 0.05)",
                      borderRadius: "4px",
                      border: `1px solid ${syncTreeAndGraph ? "rgba(59, 130, 246, 0.2)" : "rgba(128, 128, 128, 0.2)"}`,
                    }}
                  >
                    <Button
                      type="text"
                      size="small"
                      onClick={() =>
                        onSyncTreeAndGraphChange?.(!syncTreeAndGraph)
                      }
                      title={
                        syncTreeAndGraph
                          ? "Tree and graph are synced - click to unlink"
                          : "Tree and graph are independent - click to link"
                      }
                      style={{
                        padding: "2px 6px",
                        height: "auto",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: syncTreeAndGraph ? "#3b82f6" : "#888",
                      }}
                    >
                      {syncTreeAndGraph ? <LinkIcon /> : <BrokenLinkIcon />}
                    </Button>
                    <span
                      style={{
                        fontSize: TYPOGRAPHY.INFOPANEL_HIERARCHY_DETAILS,
                        color: syncTreeAndGraph ? "#3b82f6" : "#888",
                        fontWeight: syncTreeAndGraph ? 500 : 400,
                      }}
                    >
                      {syncTreeAndGraph
                        ? "Tree and graph linked"
                        : "Tree and graph independent"}
                    </span>
                  </div>
                  <SearchControls
                    ref={searchControlsRef}
                    searchableItems={searchableItems}
                    onSearch={handleSearch}
                    onClear={handleSearchClear}
                    onNavigate={handleSearchNavigate}
                    placeholder="Search nodes and containers..."
                    compact
                    visualizationState={visualizationState}
                    asyncCoordinator={asyncCoordinator}
                  />
                  <HierarchyTree
                    collapsedContainers={collapsedContainers}
                    visualizationState={visualizationState}
                    onToggleContainer={(containerId) => {
                      // Only sync when enabled
                      if (syncTreeAndGraph && onToggleContainer) {
                        onToggleContainer(containerId);
                      }
                    }}
                    onElementNavigation={onElementNavigation}
                    layoutOrchestrator={layoutOrchestrator}
                    title={`${currentGroupingName} Hierarchy`}
                    showNodeCounts={true}
                    truncateLabels={true}
                    maxLabelLength={15}
                    // search integration - pass ALL matches (containers + nodes), not just containers
                    searchQuery={searchQuery}
                    searchResults={searchMatches}
                    currentSearchResult={currentSearchMatch}
                    syncEnabled={syncTreeAndGraph}
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
              onToggle={handleEdgeStyleToggle}
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
            onToggle={handleLegendToggle}
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
  },
);
InfoPanelInternal.displayName = "InfoPanelInternal";
// Memoized component for performance optimization
export const InfoPanel = memo(InfoPanelInternal);
// Re-export sub-components for individual use
export { Legend } from "../Legend";
export { HierarchyTree } from "../HierarchyTree";
export { GroupingControls } from "../GroupingControls";
export { CollapsibleSection } from "../CollapsibleSection";
// Export types for compatibility
export type { InfoPanelProps, LegendData } from "../types";
export type { SearchMatch } from "../SearchControls";

// Export imperative operation functions for external use
export {
  togglePanelImperatively,
  expandPanelImperatively,
  collapsePanelImperatively,
} from "../../utils/panelOperationUtils.js";
// Additional type exports for compatibility
export type LegendItem = {
  type: string;
  label: string;
  description?: string;
  color?: string;
};
export type EdgeStyleConfig = {
  [key: string]: {
    color?: string;
    width?: number;
    style?: "solid" | "dashed" | "dotted";
    type?: "bezier" | "straight" | "smoothstep";
  };
};
export type GroupingOption = {
  id: string;
  name: string;
  description?: string;
};
