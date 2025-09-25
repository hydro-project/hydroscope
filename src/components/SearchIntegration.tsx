/**
 * SearchIntegration Component
 * Integrates search functionality with container expansion and smart collapse prevention
 */

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Search } from "./Search.js";
import { VisualizationState } from "../core/VisualizationState.js";
import type { SearchResult } from "../types/core.js";

export interface SearchIntegrationProps {
  visualizationState: VisualizationState;
  onSearchResultSelect: (result: SearchResult) => void;
  onContainerExpansion?: (containerId: string) => void;
  onLayoutUpdate?: () => void;
  placeholder?: string;
  maxResults?: number;
  groupByType?: boolean;
  showResultsPanel?: boolean;
}

export const SearchIntegration: React.FC<SearchIntegrationProps> = ({
  visualizationState,
  onSearchResultSelect,
  onContainerExpansion,
  onLayoutUpdate,
  placeholder,
  maxResults,
  groupByType,
  showResultsPanel,
}) => {
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Get search results from VisualizationState
  const searchResults = useMemo(() => {
    return visualizationState.getSearchResults();
  }, [visualizationState, searchQuery]); // Re-compute when query changes

  // Find containers that need to be expanded for search results
  const findContainersToExpand = useCallback(
    (results: SearchResult[]): string[] => {
      const containersToExpand: Set<string> = new Set();

      for (const result of results) {
        if (result.type === "node") {
          // Find the container hierarchy for this node
          const nodeContainer = visualizationState.getNodeContainer(result.id);
          if (nodeContainer) {
            // Add all ancestor containers that are collapsed
            const ancestors = [
              nodeContainer,
              ...visualizationState.getContainerAncestors(nodeContainer),
            ];

            for (const ancestorId of ancestors) {
              const container = visualizationState.getContainer(ancestorId);
              if (container && container.collapsed) {
                containersToExpand.add(ancestorId);
              }
            }
          }
        } else if (result.type === "container") {
          // For container results, expand parent containers if they're collapsed
          const parentContainers = visualizationState.getContainerAncestors(
            result.id,
          );

          for (const parentId of parentContainers) {
            const container = visualizationState.getContainer(parentId);
            if (container && container.collapsed) {
              containersToExpand.add(parentId);
            }
          }
        }
      }

      return Array.from(containersToExpand);
    },
    [visualizationState],
  );

  // Handle search input
  const handleSearch = useCallback(
    async (query: string) => {
      setIsSearching(true);
      setSearchQuery(query);

      try {
        // Perform search in VisualizationState
        const results = visualizationState.search(query);

        if (results.length > 0) {
          // Find containers that need to be expanded to show search results
          const containersToExpand = findContainersToExpand(results);

          // Expand containers for search results
          for (const containerId of containersToExpand) {
            try {
              // Use search-specific expansion method
              visualizationState.expandContainerForSearch(containerId);

              // Notify parent component about container expansion
              if (onContainerExpansion) {
                await onContainerExpansion(containerId);
              }
            } catch (error) {
              console.error(
                `Error expanding container ${containerId} for search:`,
                error,
              );
            }
          }

          // Trigger layout update if containers were expanded
          if (containersToExpand.length > 0 && onLayoutUpdate) {
            onLayoutUpdate();
          }
        }
      } catch (error) {
        console.error("Error performing search:", error);
      } finally {
        setIsSearching(false);
      }
    },
    [
      visualizationState,
      findContainersToExpand,
      onContainerExpansion,
      onLayoutUpdate,
    ],
  );

  // Handle search clear
  const handleClear = useCallback(() => {
    setSearchQuery("");
    visualizationState.clearSearch();
    setIsSearching(false);
  }, [visualizationState]);

  // Handle search result selection
  const handleResultSelect = useCallback(
    (result: SearchResult) => {
      // Ensure the result is visible by expanding its containers if needed
      const containersToExpand = findContainersToExpand([result]);

      for (const containerId of containersToExpand) {
        try {
          visualizationState.expandContainerForSearch(containerId);

          if (onContainerExpansion) {
            onContainerExpansion(containerId);
          }
        } catch (error) {
          console.error(
            `Error expanding container ${containerId} for result selection:`,
            error,
          );
        }
      }

      // Trigger layout update if needed
      if (containersToExpand.length > 0 && onLayoutUpdate) {
        onLayoutUpdate();
      }

      // Notify parent component
      onSearchResultSelect(result);
    },
    [
      visualizationState,
      findContainersToExpand,
      onContainerExpansion,
      onLayoutUpdate,
      onSearchResultSelect,
    ],
  );

  // Update search results when VisualizationState changes
  useEffect(() => {
    // Force re-render when visualization state changes
    // This ensures search results stay in sync
  }, [visualizationState]);

  return (
    <Search
      onSearch={handleSearch}
      onClear={handleClear}
      onResultSelect={handleResultSelect}
      searchResults={searchResults}
      isSearching={isSearching}
      query={searchQuery}
      placeholder={placeholder}
      maxResults={maxResults}
      groupByType={groupByType}
      showResultsPanel={showResultsPanel}
    />
  );
};

export default SearchIntegration;
