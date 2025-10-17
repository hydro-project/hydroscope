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
import { hscopeLogger } from "../../utils/logger.js";
import { Button } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { InfoPanelProps, LegendData } from "../types";
import { CollapsibleSection } from "../CollapsibleSection";
import { GroupingControls } from "../GroupingControls";
import { HierarchyTree, getSearchableItemsInTreeOrder } from "../HierarchyTree";
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
      onTreeExpansion,
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
    // Track update counter to force re-renders when visibility changes
    const [_updateCounter, setUpdateCounter] = useState(0);
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
              hscopeLogger.log(
                "debug",
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
      // Get items in tree hierarchy order so search navigation scrolls in the right direction
      if (visualizationState) {
        return getSearchableItemsInTreeOrder(visualizationState);
      }
      return [];
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSearchMatches: setSearchMatches as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCurrentSearchMatch: setCurrentSearchMatch as any,
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
      // Don't call onSearchUpdate for navigation - it triggers expandAll which does fitView
      // onSearchUpdate is for when the query changes, not for navigating results
      // onSearchUpdate?.(searchQuery, searchMatches, current);

      // Trigger navigation to highlight the element in the graph
      onElementNavigation?.(current.id, current.type);
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
                  {/* Control Buttons Row */}
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginBottom: "8px",
                    }}
                  >
                    {/* Sync Control Button */}
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
                        flex: 1,
                        padding: "4px 8px",
                        height: "auto",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        backgroundColor: syncTreeAndGraph
                          ? "rgba(59, 130, 246, 0.05)"
                          : "rgba(128, 128, 128, 0.05)",
                        borderRadius: "4px",
                        border: `1px solid ${syncTreeAndGraph ? "rgba(59, 130, 246, 0.2)" : "rgba(128, 128, 128, 0.2)"}`,
                        color: syncTreeAndGraph ? "#3b82f6" : "#888",
                      }}
                    >
                      {syncTreeAndGraph ? <LinkIcon /> : <BrokenLinkIcon />}
                      <span
                        style={{
                          fontSize: TYPOGRAPHY.INFOPANEL_HIERARCHY_DETAILS,
                          fontWeight: syncTreeAndGraph ? 500 : 400,
                        }}
                      >
                        {syncTreeAndGraph ? "Linked" : "Unlinked"}
                      </span>
                    </Button>

                    {/* Show All Button */}
                    <Button
                      type="text"
                      size="small"
                      onClick={async () => {
                        if (!visualizationState || !asyncCoordinator) return;

                        // Show all manually hidden nodes
                        const hiddenNodes = visualizationState.allNodes.filter(
                          (node) =>
                            visualizationState.isNodeManuallyHidden(node.id),
                        );

                        // Show all manually hidden containers
                        const hiddenContainers =
                          visualizationState.allContainers.filter((container) =>
                            visualizationState.isContainerManuallyHidden(
                              container.id,
                            ),
                          );

                        // Toggle visibility for all hidden items
                        for (const node of hiddenNodes) {
                          visualizationState.toggleNodeVisibility(node.id);
                        }

                        for (const container of hiddenContainers) {
                          visualizationState.toggleContainerVisibility(
                            container.id,
                          );
                        }

                        // Force re-render
                        setUpdateCounter((c) => c + 1);

                        // Trigger layout update
                        try {
                          await asyncCoordinator.executeLayoutAndRenderPipeline(
                            visualizationState,
                            {
                              relayoutEntities: undefined, // Full layout
                              fitView: false,
                            },
                          );
                        } catch (error) {
                          console.warn(
                            "[InfoPanel] Layout update failed for show all:",
                            error,
                          );
                        }
                      }}
                      title="Show all hidden nodes and containers"
                      style={{
                        flex: 1,
                        padding: "4px 8px",
                        height: "auto",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        backgroundColor: "rgba(34, 197, 94, 0.05)",
                        borderRadius: "4px",
                        border: "1px solid rgba(34, 197, 94, 0.2)",
                        color: "#22c55e",
                      }}
                    >
                      <EyeOutlined style={{ fontSize: "14px" }} />
                      <span
                        style={{
                          fontSize: TYPOGRAPHY.INFOPANEL_HIERARCHY_DETAILS,
                          fontWeight: 500,
                        }}
                      >
                        Show All
                      </span>
                    </Button>
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
                    onToggleNodeVisibility={async (nodeId) => {
                      // Toggle node visibility in VisualizationState
                      visualizationState?.toggleNodeVisibility(nodeId);

                      // Force re-render to show updated icon
                      setUpdateCounter((c) => c + 1);

                      // Trigger layout update to reflect the change
                      if (visualizationState && asyncCoordinator) {
                        try {
                          await asyncCoordinator.executeLayoutAndRenderPipeline(
                            visualizationState,
                            {
                              relayoutEntities: [nodeId],
                              fitView: false,
                            },
                          );
                        } catch (error) {
                          console.warn(
                            `[InfoPanel] Layout update failed for node ${nodeId}:`,
                            error,
                          );
                        }
                      }
                    }}
                    onToggleContainerVisibility={async (
                      containerId,
                      shiftKey,
                    ) => {
                      if (!visualizationState || !asyncCoordinator) return;

                      // Check if the container is currently visible (not manually hidden)
                      const isCurrentlyHidden =
                        visualizationState.isContainerManuallyHidden(
                          containerId,
                        );

                      // When showing a hidden container, ensure all ancestors are visible and expanded
                      if (isCurrentlyHidden) {
                        // Get all ancestors (returns [parent, grandparent, ..., root])
                        const ancestors =
                          visualizationState.getContainerAncestors(containerId);

                        // CRITICAL: First, make sure all hidden ancestors are visible
                        // Parents must be visible in ReactFlow before children can be added
                        const hiddenAncestors = ancestors.filter((id) =>
                          visualizationState.isContainerManuallyHidden(id),
                        );

                        // Show hidden ancestors from root to leaf
                        for (const ancestorId of hiddenAncestors.reverse()) {
                          visualizationState.toggleContainerVisibility(
                            ancestorId,
                          );
                        }

                        // Check if the container itself is collapsed
                        const container =
                          visualizationState.getContainer(containerId);
                        const isCollapsed = container && container.collapsed;

                        // Collect containers that need to be expanded
                        // Filter ancestors to only collapsed ones
                        const collapsedAncestors = ancestors.filter((id) => {
                          const c = visualizationState.getContainer(id);
                          return c && c.collapsed;
                        });

                        // Reverse to get root-to-leaf order [root, ..., grandparent, parent]
                        // This respects the invariant that parents must be expanded before children
                        const containersToExpand = collapsedAncestors.reverse();

                        // Add the container itself at the end if it's collapsed
                        if (isCollapsed) {
                          containersToExpand.push(containerId);
                        }

                        // Expand collapsed containers if any exist
                        if (containersToExpand.length > 0) {
                          try {
                            await asyncCoordinator.expandContainers(
                              visualizationState,
                              containersToExpand,
                              {
                                relayoutEntities: undefined, // Full layout
                                fitView: false,
                              },
                            );
                          } catch (error) {
                            console.warn(
                              `[InfoPanel] Failed to expand containers for ${containerId}:`,
                              error,
                            );
                          }
                        }

                        // Now toggle visibility to show the container
                        visualizationState.toggleContainerVisibility(
                          containerId,
                        );
                      } else if (shiftKey) {
                        // Shift-click on an open eye (visible container) hides all others
                        // Get ancestors and descendants of this container
                        const ancestors =
                          visualizationState.getContainerAncestors(containerId);
                        const descendants =
                          visualizationState.getContainerDescendants(
                            containerId,
                          );
                        const related = new Set([
                          containerId,
                          ...ancestors,
                          ...descendants,
                        ]);

                        // Hide all other containers
                        const allContainers =
                          visualizationState.visibleContainers;
                        const containersToHide = allContainers.filter(
                          (c) => !related.has(c.id),
                        );

                        for (const container of containersToHide) {
                          if (
                            !visualizationState.isContainerManuallyHidden(
                              container.id,
                            )
                          ) {
                            visualizationState.toggleContainerVisibility(
                              container.id,
                            );
                          }
                        }
                      } else {
                        // Normal click - just toggle this container
                        visualizationState.toggleContainerVisibility(
                          containerId,
                        );
                      }

                      // Force re-render to show updated icons
                      setUpdateCounter((c) => c + 1);

                      // Trigger layout update to reflect the changes
                      if (asyncCoordinator) {
                        try {
                          await asyncCoordinator.executeLayoutAndRenderPipeline(
                            visualizationState,
                            {
                              relayoutEntities: [containerId],
                              fitView: false,
                            },
                          );
                        } catch (error) {
                          console.warn(
                            `[InfoPanel] Layout update failed for container ${containerId}:`,
                            error,
                          );
                        }
                      }
                    }}
                    onTreeExpansion={onTreeExpansion}
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
