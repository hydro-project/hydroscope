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
import { searchNavigationErrorHandler } from "../core/ErrorHandler.js";
import { useErrorFeedback, ErrorFeedback } from "./ErrorFeedback.js";

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
      onClear,
      onNavigate,
      placeholder = "Search (wildcards: * ?)",
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

    // Error feedback integration
    const { feedback, showFeedback, dismissFeedback } = useErrorFeedback();

    // Register error feedback callback with error handler
    useEffect(() => {
      const handleErrorFeedback = (feedbackOptions: any) => {
        showFeedback(feedbackOptions);
      };

      searchNavigationErrorHandler.onUserFeedback(handleErrorFeedback);

      return () => {
        searchNavigationErrorHandler.offUserFeedback(handleErrorFeedback);
      };
    }, [showFeedback]);

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

          // Handle navigation error (async boundary)
          const result = matches[index];
          if (result) {
            searchNavigationErrorHandler
              .handleNavigationFailure(
                result.id,
                {} as any, // No state available in SearchControls
                error as Error,
                {
                  operation: "search_controls_navigation",
                  resultIndex: index,
                  resultId: result.id,
                },
              )
              .catch((handlerError) => {
                console.error(
                  `[SearchControls] Error handler failed:`,
                  handlerError,
                );
              });
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
      focus: () => inputRef.current?.focus(),
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
        try {
          const rx = toRegex(query);
          if (!rx) {
            setMatches([]);
            setCurrentIndex(0);
            // Apply clear operation synchronously to prevent race conditions
            onSearch("", []);
            return;
          }

          // Perform search synchronously (respecting core architecture)
          const next = searchableItems
            .filter((i) => rx.test(i.label))
            .map((i) => ({
              ...i,
              matchIndices: [], // TODO: Implement proper match indices calculation
            }));

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

          // Handle search error through error handler (async boundary)
          searchNavigationErrorHandler
            .handleSearchFailure(
              query,
              {} as any, // No state available in SearchControls
              error as Error,
              {
                operation: "search_controls",
                query,
                itemCount: searchableItems.length,
              },
            )
            .catch((handlerError) => {
              console.error(
                `[SearchControls] Error handler failed:`,
                handlerError,
              );
            });

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

    // Sync with external currentSearchIndex prop
    useEffect(() => {
      if (
        currentSearchIndex !== currentIndex &&
        currentSearchIndex < matches.length
      ) {
        setCurrentIndex(currentSearchIndex);
      }
    }, [currentSearchIndex, matches.length, currentIndex]);

    const navigate = (dir: "prev" | "next") => {
      if (!matches.length) return;
      const idx =
        dir === "next"
          ? (currentIndex + 1) % matches.length
          : (currentIndex - 1 + matches.length) % matches.length;

      navigateToResultIndex(idx, dir);
    };

    const clearAll = () => {
      // Clear any pending debounced search
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      setQuery("");
      setMatches([]);
      setCurrentIndex(0);

      // Apply clear operations synchronously to prevent race conditions
      onClear();
      onSearch("", []);
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
            value={query}
            onChange={(v) => {
              setQuery(v);
              if (v === "") {
                setMatches([]);
                setCurrentIndex(0);
                // Apply clear operations synchronously to prevent race conditions
                onClear();
                onSearch("", []);
              }
            }}
            onSelect={(v) => {
              setQuery(v);
            }}
            placeholder={placeholder}
            options={searchHistory.map((h) => ({ value: h, label: h }))}
            style={{ flex: 1 }}
          >
            <Input
              ref={inputRef}
              allowClear
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

        {/* Error feedback display */}
        <ErrorFeedback
          feedback={feedback}
          onDismiss={dismissFeedback}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 1001, // Above results list
            marginTop: "8px",
          }}
        />
      </div>
    );
  },
);

SearchControls.displayName = "SearchControls";
