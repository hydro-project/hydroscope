/**
 * SearchControls
 * - Debounced wildcard search over provided items
 * - Prev/Next navigation among matches
 * - Search result count display and clear
 *
 * IMPORTANT: Race Condition Prevention:
 * - Search operations execute synchronously to prevent layout race conditions
 * - Search highlighting animations use box-shadow instead of transform
 * - All operations coordinate with the ConsolidatedOperationManager system
 */
import {
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useMemo,
  useCallback,
} from "react";
import { Input, Button, Tooltip, AutoComplete, List, Typography } from "antd";
import { PANEL_CONSTANTS } from "../shared/config";
import type { SearchResult } from "../types/core.js";
import { clearSearchImperatively } from "../utils/searchClearUtils.js";
export type SearchableItem = {
  id: string;
  label: string;
  type: "container" | "node";
};
export type SearchMatch = {
  id: string;
  label: string;
  type: "container" | "node";
  matchIndices: number[][];
};
export interface SearchControlsRef {
  focus: () => void;
  clear: () => void;
  navigateToResult: (index: number) => void;
  announceResults: (count: number, current?: number) => void;
}
type Props = {
  searchableItems: SearchableItem[];
  onSearch: (query: string, matches: SearchMatch[]) => void;
  onClear: () => void;
  onNavigate: (dir: "prev" | "next", current: SearchMatch) => void;
  placeholder?: string;
  compact?: boolean;
  // Add VisualizationState for delegated search
  visualizationState?: any;
  // Add AsyncCoordinator for coordinated operations
  asyncCoordinator?: any;
  // Enhanced navigation and accessibility props
  onResultNavigation?: (result: SearchResult) => void;
  onViewportFocus?: (elementId: string) => void;
  showHierarchyPath?: boolean;
  showElementType?: boolean;
  searchResults?: SearchResult[]; // Enhanced search results with hierarchy info
  currentSearchIndex?: number;
  // Accessibility props
  ariaLabel?: string;
  announceResults?: boolean;
};
// Convert wildcard pattern (* ?) to case-insensitive regex (substring match)
function toRegex(pattern: string): RegExp | null {
  const raw = pattern.trim();
  if (!raw) return null;
  const escaped = raw
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // escape regex chars
    .replace(/\\\*/g, ".*") // * -> .*
    .replace(/\\\?/g, "."); // ? -> .
  try {
    return new RegExp(escaped, "i");
  } catch {
    return null;
  }
}
export const SearchControls = forwardRef<SearchControlsRef, Props>(
  (
    {
      searchableItems,
      onSearch,
      onClear: _onClear,
      onNavigate,
      placeholder = "Search (wildcards: * ?)",
      visualizationState,
      asyncCoordinator,
      compact = false,
      onResultNavigation,
      onViewportFocus,
      showHierarchyPath = true,
      showElementType = true,
      searchResults,
      currentSearchIndex = 0,
      ariaLabel = "Search controls",
      announceResults = true,
    },
    ref,
  ) => {
    const [query, setQuery] = useState("");
    const [matches, setMatches] = useState<SearchMatch[]>([]);
    const [currentIndex, setCurrentIndex] = useState(currentSearchIndex);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [_showHistory, _setShowHistory] = useState(false);
    const [showResultsList, setShowResultsList] = useState(false);
    const [focusedResultIndex, setFocusedResultIndex] = useState(-1);
    const timerRef = useRef<number | null>(null);
    const inputRef = useRef<any>(null);
    const resultsListRef = useRef<HTMLDivElement>(null);
    const ariaLiveRef = useRef<HTMLDivElement>(null);
    const lastProcessedQuery = useRef<string>("");
    const isNavigatingRef = useRef(false); // Track if user is actively navigating
    // Error handling is done through console logging
    // Load search history from localStorage on mount
    useEffect(() => {
      try {
        const stored = localStorage.getItem("hydroscope_search_history");
        if (stored) {
          const history = JSON.parse(stored);
          if (Array.isArray(history)) {
            setSearchHistory(history.slice(0, 10)); // Keep only last 10
          }
        }
      } catch (e) {
        console.warn("Failed to load search history:", e);
      }
    }, []);
    // Add to search history when query is executed
    const addToHistory = (searchQuery: string) => {
      if (!searchQuery.trim()) return;
      setSearchHistory((currentHistory) => {
        const newHistory = [
          searchQuery,
          ...currentHistory.filter((h) => h !== searchQuery),
        ].slice(0, 10); // Keep only last 10 unique searches
        // Save to localStorage
        try {
          localStorage.setItem(
            "hydroscope_search_history",
            JSON.stringify(newHistory),
          );
        } catch (e) {
          console.warn("Failed to save search history:", e);
        }
        return newHistory;
      });
    };
    // Accessibility announcement function
    const announceToScreenReader = useCallback(
      (message: string) => {
        if (ariaLiveRef.current && announceResults) {
          ariaLiveRef.current.textContent = message;
          // Clear after a delay to allow for re-announcements
          setTimeout(() => {
            if (ariaLiveRef.current) {
              ariaLiveRef.current.textContent = "";
            }
          }, 1000);
        }
      },
      [announceResults],
    );
    // Navigate to specific result index with error handling (keeping synchronous core operations)
    const navigateToResultIndex = useCallback(
      (index: number, direction: "prev" | "next" = "next") => {
        try {
          if (index >= 0 && index < matches.length) {
            setCurrentIndex(index);
            const result = matches[index];
            // Execute navigation synchronously (respecting core architecture)
            onNavigate(direction, result);
            // Enhanced navigation with SearchResult if available
            if (onResultNavigation && searchResults && searchResults[index]) {
              onResultNavigation(searchResults[index]);
            }
            // Announce navigation
            announceToScreenReader(
              `Navigated to result ${index + 1} of ${matches.length}: ${result.label}`,
            );
          }
        } catch (error) {
          console.error(
            `[SearchControls] Navigation failed for result ${index}:`,
            error,
          );
          // Log navigation error
          const result = matches[index];
          if (result) {
            console.error(
              `[SearchControls] Navigation failed for element: ${result.id}`,
              error,
            );
          }
          // Announce error for accessibility
          announceToScreenReader("Navigation failed. Please try again.");
        }
      },
      [
        matches,
        onNavigate,
        onResultNavigation,
        searchResults,
        announceToScreenReader,
      ],
    );
    useImperativeHandle(ref, () => ({
      focus: () => {
        // For React 19 compatibility, focus the AutoComplete component
        // which will delegate to the internal Input
        if (inputRef.current?.focus) {
          inputRef.current.focus();
        } else if (inputRef.current?.input?.focus) {
          // Fallback for Ant Design's internal structure
          inputRef.current.input.focus();
        }
      },
      clear: () => clearAll(),
      navigateToResult: navigateToResultIndex,
      announceResults: (count: number, current?: number) => {
        const message =
          current !== undefined
            ? `${count} results found. Currently on result ${current + 1}.`
            : `${count} results found.`;
        announceToScreenReader(message);
      },
    }));
    // Debounced search with error handling (keeping synchronous core operations)
    useEffect(() => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        // Prevent processing the same query multiple times
        if (lastProcessedQuery.current === query) {
          return;
        }
        lastProcessedQuery.current = query;
        try {
          const rx = toRegex(query);
          if (!rx) {
            // Use AsyncCoordinator if available for coordinated clear
            if (asyncCoordinator && visualizationState) {
              try {
                // Use AsyncCoordinator for coordinated clear (async but don't await to prevent blocking)
                asyncCoordinator
                  .clearSearch(visualizationState, {
                    fitView: false,
                  })
                  .catch((error: any) => {
                    console.error(
                      "[SearchControls] Coordinated search clear failed in debounced effect:",
                      error,
                    );
                  });
              } catch (error) {
                console.error(
                  "[SearchControls] AsyncCoordinator clear failed:",
                  error,
                );
              }
            } else {
              // Fallback to direct VisualizationState clear
              if (
                visualizationState &&
                visualizationState.clearSearchEnhanced
              ) {
                try {
                  visualizationState.clearSearchEnhanced();
                  // ReactFlow regeneration will be handled by Hydroscope component
                } catch (_error) {
                  // Silently handle clear errors
                }
              }
            }

            setMatches([]);
            setCurrentIndex(0);
            // Apply clear operation synchronously to prevent race conditions
            onSearch("", []);
            return;
          }
          // Delegate search to VisualizationState if available
          let next: SearchMatch[] = [];
          if (visualizationState && visualizationState.performSearch) {
            try {
              // Use VisualizationState's search which handles graph highlighting
              const searchResults = visualizationState.performSearch(query);
              next = searchResults.map((result: any) => ({
                id: result.id,
                label: result.label,
                type: result.type,
                matchIndices: result.matchIndices || [],
              }));
              // ReactFlow regeneration will be handled by Hydroscope component
              // after onSearch callback is executed
            } catch (_error) {
              // Fallback to local search
              next = searchableItems
                .filter((i) => rx.test(i.label))
                .map((i) => ({
                  ...i,
                  matchIndices: [], // TODO: Implement proper match indices calculation
                }));
            }
          } else {
            // Fallback to local search when VisualizationState is not available
            next = searchableItems
              .filter((i) => rx.test(i.label))
              .map((i) => ({
                ...i,
                matchIndices: [], // TODO: Implement proper match indices calculation
              }));
          }
          setMatches(next);
          setCurrentIndex(0);
          // Apply search results synchronously to prevent race conditions with layout operations
          // The async batching was causing visibility state inconsistency during search
          onSearch(query, next);
          // Add to history when we get results
          if (next.length > 0) {
            addToHistory(query);
          }
          // Announce search results for accessibility
          if (announceResults) {
            const message =
              next.length === 0
                ? "No search results found"
                : `${next.length} search result${next.length === 1 ? "" : "s"} found`;
            announceToScreenReader(message);
          }
        } catch (error) {
          console.error(
            `[SearchControls] Search failed for query "${query}":`,
            error,
          );
          // Log search error
          console.error(
            `[SearchControls] Search failed for query: "${query}"`,
            error,
          );
          // Clear results on error
          setMatches([]);
          setCurrentIndex(0);
          onSearch("", []);
          // Announce error for accessibility
          if (announceResults) {
            announceToScreenReader("Search failed. Please try again.");
          }
        }
      }, 300); // 300ms debounce delay to prevent excessive operations
      return () => {
        if (timerRef.current) window.clearTimeout(timerRef.current);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- onSearch dependency causes graph layout issues and repositioning problems
    }, [
      query,
      searchableItems,
      announceResults,
      announceToScreenReader,
      addToHistory,
      onSearch,
    ]);
    // Keep index in range and sync with external currentSearchIndex
    useEffect(() => {
      if (!matches.length && currentIndex !== 0) setCurrentIndex(0);
      if (currentIndex >= matches.length && matches.length) setCurrentIndex(0);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- currentIndex dependency would create infinite loop since effect calls setCurrentIndex
    }, [matches]);
    // Sync with external currentSearchIndex prop (but not when user is navigating)
    useEffect(() => {
      if (
        !isNavigatingRef.current &&
        currentSearchIndex !== currentIndex &&
        currentSearchIndex < matches.length
      ) {
        setCurrentIndex(currentSearchIndex);
      }
    }, [currentSearchIndex, matches.length, currentIndex]);

    const navigate = useCallback(
      (dir: "prev" | "next") => {
        if (!matches.length) return;
        // Set flag to prevent external sync from interfering
        isNavigatingRef.current = true;
        // Use functional setState to get the truly current value
        setCurrentIndex((prevIndex) => {
          const idx =
            dir === "next"
              ? (prevIndex + 1) % matches.length
              : (prevIndex - 1 + matches.length) % matches.length;
          // Navigate to the new result (do this in a microtask to ensure state is updated)
          Promise.resolve().then(() => {
            navigateToResultIndex(idx, dir);
            // Clear flag after navigation completes
            setTimeout(() => {
              isNavigatingRef.current = false;
            }, 100);
          });
          return idx;
        });
      },
      [matches, navigateToResultIndex],
    );
    const clearAll = () => {
      clearSearchImperatively({
        visualizationState,
        inputRef,
        setQuery,
        setMatches,
        setCurrentIndex,
        clearTimer: () => {
          if (timerRef.current) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        },
        debug: process.env.NODE_ENV === "development",
      });
    };
    // Cleanup effect to clear timers on unmount
    useEffect(() => {
      return () => {
        if (timerRef.current) {
          window.clearTimeout(timerRef.current);
        }
      };
    }, []);
    const countText = useMemo(() => {
      if (!query.trim()) return "";
      if (!matches.length) return "0 / 0";
      return `${Math.min(currentIndex + 1, matches.length)} / ${matches.length}`;
    }, [query, matches, currentIndex]);
    // Enhanced result display with hierarchical context
    const renderResultItem = (result: SearchResult, index: number) => {
      const isCurrentResult = index === currentIndex;
      const hierarchyPath = result.hierarchyPath?.join(" > ") || "";
      return (
        <List.Item
          key={result.id}
          style={{
            padding: "8px 12px",
            cursor: "pointer",
            backgroundColor: isCurrentResult ? "#e6f7ff" : "transparent",
            borderLeft: isCurrentResult
              ? "3px solid #1890ff"
              : "3px solid transparent",
          }}
          onClick={() => {
            navigateToResultIndex(index);
            if (onViewportFocus) {
              onViewportFocus(result.id);
            }
            setShowResultsList(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigateToResultIndex(index);
              if (onViewportFocus) {
                onViewportFocus(result.id);
              }
              setShowResultsList(false);
            }
          }}
          tabIndex={0}
          role="option"
          aria-selected={isCurrentResult}
        >
          <div>
            <div style={{ fontWeight: isCurrentResult ? "bold" : "normal" }}>
              {showElementType && (
                <span
                  style={{
                    color: "#666",
                    fontSize: "0.85em",
                    marginRight: "8px",
                    textTransform: "uppercase",
                  }}
                >
                  {result.type}
                </span>
              )}
              {result.label}
            </div>
            {showHierarchyPath && hierarchyPath && (
              <Typography.Text
                type="secondary"
                style={{ fontSize: "0.85em" }}
                title={`Full path: ${hierarchyPath}`}
              >
                {hierarchyPath}
              </Typography.Text>
            )}
          </div>
        </List.Item>
      );
    };
    return (
      <div
        style={{
          position: "relative",
          marginBottom: compact ? 6 : 10,
        }}
        role="search"
        aria-label={ariaLabel}
      >
        {/* Screen reader announcements */}
        <div
          ref={ariaLiveRef}
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: "absolute",
            left: "-10000px",
            width: "1px",
            height: "1px",
            overflow: "hidden",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <AutoComplete
            ref={inputRef}
            value={query}
            onChange={(v) => {
              setQuery(v);
              // Note: When the X button is clicked, onClear will handle the clearing
              // This onChange is primarily for typing changes
              // If v === "", it could be from typing or from the X button
              // We'll let the debounced effect handle empty queries to avoid double-clearing
            }}
            onSelect={(v) => {
              setQuery(v);
            }}
            placeholder={placeholder}
            options={searchHistory.map((h) => ({ value: h, label: h }))}
            style={{ flex: 1 }}
          >
            <Input
              allowClear
              onClear={clearAll}
              data-testid="search-input"
              aria-label="Search input"
              aria-describedby="search-results-count"
              aria-expanded={showResultsList}
              aria-haspopup="listbox"
              role="combobox"
              onKeyDown={(e) => {
                // Enhanced keyboard navigation
                if (e.key === "Enter" && e.shiftKey) {
                  e.preventDefault();
                  navigate("prev");
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  navigate("next");
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  clearAll();
                } else if (e.key === "ArrowDown" && e.ctrlKey) {
                  e.preventDefault();
                  navigate("next");
                } else if (e.key === "ArrowUp" && e.ctrlKey) {
                  e.preventDefault();
                  navigate("prev");
                } else if (e.key === "F3" && !e.shiftKey) {
                  e.preventDefault();
                  navigate("next");
                } else if (e.key === "F3" && e.shiftKey) {
                  e.preventDefault();
                  navigate("prev");
                } else if (
                  e.key === "Tab" &&
                  showResultsList &&
                  matches.length > 0
                ) {
                  e.preventDefault();
                  setShowResultsList(true);
                  setFocusedResultIndex(0);
                }
              }}
              onFocus={() => {
                if (matches.length > 0 && showHierarchyPath) {
                  setShowResultsList(true);
                }
              }}
              onBlur={(e) => {
                // Only hide results list if focus is not moving to the results list
                if (
                  !resultsListRef.current?.contains(e.relatedTarget as Node)
                ) {
                  setTimeout(() => setShowResultsList(false), 150);
                }
              }}
              style={{ height: compact ? 28 : undefined }}
            />
          </AutoComplete>
          <span
            id="search-results-count"
            data-testid="search-results"
            style={{
              minWidth: PANEL_CONSTANTS.SEARCH_MIN_WIDTH,
              textAlign: "center",
              fontSize: PANEL_CONSTANTS.FONT_SIZE_SMALL,
              color: "#666",
            }}
            aria-live="polite"
            aria-label={`Search results: ${countText}`}
          >
            {countText}
          </span>
          <Tooltip title="Previous match (Shift+Enter, Ctrl+↑, Shift+F3)">
            <Button
              size={compact ? "small" : "middle"}
              onClick={() => navigate("prev")}
              disabled={!matches.length}
              data-testid="search-prev-button"
              aria-label="Previous search result"
            >
              ↑
            </Button>
          </Tooltip>
          <Tooltip title="Next match (Enter, Ctrl+↓, F3)">
            <Button
              size={compact ? "small" : "middle"}
              onClick={() => navigate("next")}
              disabled={!matches.length}
              data-testid="search-next-button"
              aria-label="Next search result"
            >
              ↓
            </Button>
          </Tooltip>
          <Tooltip title="Clear search (Escape)">
            <Button
              size={compact ? "small" : "middle"}
              onClick={clearAll}
              disabled={!query}
              data-testid="search-clear-button"
            >
              ✕
            </Button>
          </Tooltip>

          {/* Toggle results list button */}
          {(matches.length > 0 ||
            (searchResults && searchResults.length > 0)) &&
            (showHierarchyPath || showElementType) && (
              <Tooltip title="Show search results list">
                <Button
                  size={compact ? "small" : "middle"}
                  onClick={() => setShowResultsList(!showResultsList)}
                  style={{
                    backgroundColor: showResultsList ? "#e6f7ff" : undefined,
                  }}
                >
                  📋
                </Button>
              </Tooltip>
            )}
        </div>

        {/* Enhanced results list with hierarchical context */}
        {showResultsList &&
          (matches.length > 0 || (searchResults && searchResults.length > 0)) &&
          searchResults && (
            <div
              ref={resultsListRef}
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 1000,
                backgroundColor: "white",
                border: "1px solid #d9d9d9",
                borderRadius: "6px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                maxHeight: "300px",
                overflow: "auto",
              }}
              role="listbox"
              aria-label="Search results"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowResultsList(false);
                  inputRef.current?.focus();
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  const nextIndex = Math.min(
                    focusedResultIndex + 1,
                    matches.length - 1,
                  );
                  setFocusedResultIndex(nextIndex);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  const prevIndex = Math.max(focusedResultIndex - 1, 0);
                  setFocusedResultIndex(prevIndex);
                }
              }}
            >
              <List
                size="small"
                dataSource={searchResults || []}
                renderItem={(result, index) => renderResultItem(result, index)}
                style={{ margin: 0 }}
              />
            </div>
          )}
      </div>
    );
  },
);
SearchControls.displayName = "SearchControls";
