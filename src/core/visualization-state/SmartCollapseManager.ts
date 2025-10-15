/**
 * SmartCollapseManager - Handles automatic container collapse/expand logic
 * Extracted from VisualizationState for better organization
 */
import { hscopeLogger } from "../../utils/logger.js";
import { LAYOUT_CONSTANTS, SIZES } from "../../shared/config.js";
import type { Container } from "../../types/core.js";
import type { VisualizationState } from "../VisualizationState.js";

export class SmartCollapseManager {
  private state: VisualizationState;
  private _smartCollapseEnabled = true;
  private _smartCollapseOverride = false;

  constructor(state: VisualizationState) {
    this.state = state;
  }

  shouldRunSmartCollapse(): boolean {
    if (this._smartCollapseOverride) {
      this._smartCollapseOverride = false; // Reset after checking
      hscopeLogger.log(
        "op",
        "🎯 SMART COLLAPSE: Override enabled, returning true",
      );
      return true;
    }
    const enabled = this._smartCollapseEnabled;
    const isFirst = this.state.isFirstLayout();
    const result = enabled && isFirst;
    hscopeLogger.log(
      "op",
      `🎯 SMART COLLAPSE CHECK: enabled=${enabled}, isFirstLayout=${isFirst}, result=${result}`,
    );
    return result;
  }

  enableSmartCollapseForNextLayout(): void {
    this._smartCollapseOverride = true;
  }

  disableSmartCollapseForUserOperations(): void {
    this._smartCollapseEnabled = false;
  }

  resetSmartCollapseState(): void {
    this._smartCollapseEnabled = true;
    this._smartCollapseOverride = false;
  }

  getSmartCollapseStatus(): {
    enabled: boolean;
    isFirstLayout: boolean;
    hasOverride: boolean;
  } {
    return {
      enabled: this._smartCollapseEnabled,
      isFirstLayout: this.state.isFirstLayout(),
      hasOverride: this._smartCollapseOverride,
    };
  }

  /**
   * Perform smart collapse operation - automatically collapse containers
   * that meet certain criteria to improve initial layout readability
   *
   * @param budgetOverride - Optional budget override for testing purposes
   */
  performSmartCollapse(budgetOverride?: number): void {
    if (!this.shouldRunSmartCollapse()) {
      return;
    }
    // Step 1: Get all root containers and collapse them initially
    const rootContainers = this.state.getRootContainers();
    if (rootContainers.length === 0) {
      return;
    }
    // Collapse all root containers initially
    let _collapsedCount = 0;
    for (const container of rootContainers) {
      if (!container.collapsed) {
        this.state.collapseContainerSystemOperation(container.id);
        _collapsedCount++;
      }
    }
    // Step 2: Create expansion candidates sorted by cost
    interface ExpansionCandidate {
      containerId: string;
      cost: number;
    }
    const expansionCandidates: ExpansionCandidate[] = [];
    // Add all collapsed root containers as initial candidates
    for (const container of rootContainers) {
      if (container.collapsed) {
        const cost = this.calculateExpansionCost(container.id);
        expansionCandidates.push({ containerId: container.id, cost });
      }
    }
    // Sort candidates by cost (lowest first)
    expansionCandidates.sort((a, b) => a.cost - b.cost);
    // Step 3: Expand containers until budget is reached
    const budget = budgetOverride ?? LAYOUT_CONSTANTS.SMART_COLLAPSE_BUDGET;
    let currentCost = 0;
    let _expandedCount = 0;
    while (expansionCandidates.length > 0) {
      // Get the lowest-cost candidate
      const candidate = expansionCandidates.shift()!;
      // Check if expanding this container would exceed the budget
      if (currentCost + candidate.cost > budget) {
        break;
      }
      // Use internal expansion method (assumes state has this method)
      (this.state as any)._expandContainerInternal(candidate.containerId);
      currentCost += candidate.cost;
      _expandedCount++;
      // Step 4: Add child containers to expansion candidates
      const expandedContainer = this.state.getContainer(candidate.containerId);
      if (expandedContainer) {
        const childContainers: ExpansionCandidate[] = [];
        for (const childId of expandedContainer.children) {
          const childContainer = this.state.getContainer(childId);
          if (childContainer && childContainer.collapsed) {
            const childCost = this.calculateExpansionCost(childId);
            childContainers.push({ containerId: childId, cost: childCost });
          }
        }
        // Add child containers to candidates and re-sort
        expansionCandidates.push(...childContainers);
        expansionCandidates.sort((a, b) => a.cost - b.cost);
      }
    }
  }

  /**
   * Calculate the expansion cost for a container as the net growth in screen area.
   *
   * Key insight: When we expand a container, we're replacing its collapsed footprint
   * with an expanded footprint that contains its children plus border space.
   *
   * Cost = (expanded container size) - (original collapsed container size)
   */
  calculateExpansionCost(containerId: string): number {
    const container = this.state.getContainer(containerId);
    if (!container) {
      return 0;
    }
    // Original footprint: collapsed container size
    const collapsedArea =
      SIZES.COLLAPSED_CONTAINER_WIDTH * SIZES.COLLAPSED_CONTAINER_HEIGHT;
    // Calculate the area needed to contain all direct children
    let childrenArea = 0;
    for (const childId of container.children) {
      const childContainer = this.state.getContainer(childId);
      if (childContainer) {
        // Child containers appear as collapsed units when parent expands
        childrenArea +=
          SIZES.COLLAPSED_CONTAINER_WIDTH * SIZES.COLLAPSED_CONTAINER_HEIGHT;
      } else {
        const childNode = this.state.getGraphNode(childId);
        if (childNode) {
          // Direct node children
          childrenArea +=
            LAYOUT_CONSTANTS.DEFAULT_NODE_WIDTH *
            LAYOUT_CONSTANTS.DEFAULT_NODE_HEIGHT;
        }
      }
    }
    // Expanded container needs to contain children plus border/padding
    const borderPadding = 40; // Rough estimate for container borders and internal padding
    const expandedArea = childrenArea + borderPadding;
    // Net cost is the growth in footprint
    const netCost = Math.max(0, expandedArea - collapsedArea);
    return netCost;
  }
}
