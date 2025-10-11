/**
 * SearchResults Component
 * Displays search results with highlighting and navigation
 */
import React, { useCallback, useMemo } from "react";
import type { SearchResult } from "../types/core.js";
export interface SearchResultsProps {
  searchResults: readonly SearchResult[];
  currentResultIndex: number;
  onResultClick: (result: SearchResult, index: number) => void;
  onResultHover?: (result: SearchResult, index: number) => void;
  query: string;
  maxResults?: number;
  groupByType?: boolean;
}
interface HighlightedTextProps {
  text: string;
  matchIndices: number[][];
  className?: string;
}
const HighlightedText: React.FC<HighlightedTextProps> = ({
  text,
  matchIndices,
  className = "",
}) => {
  const highlightedText = useMemo(() => {
    if (!matchIndices || matchIndices.length === 0) {
      return [{ text, highlighted: false }];
    }
    const segments: Array<{
      text: string;
      highlighted: boolean;
    }> = [];
    let lastIndex = 0;
    // Sort match indices by start position
    const sortedMatches = [...matchIndices].sort((a, b) => a[0] - b[0]);
    for (const [start, end] of sortedMatches) {
      // Add non-highlighted text before this match
      if (start > lastIndex) {
        segments.push({
          text: text.slice(lastIndex, start),
          highlighted: false,
        });
      }
      // Add highlighted match
      segments.push({
        text: text.slice(start, end),
        highlighted: true,
      });
      lastIndex = end;
    }
    // Add remaining non-highlighted text
    if (lastIndex < text.length) {
      segments.push({
        text: text.slice(lastIndex),
        highlighted: false,
      });
    }
    return segments;
  }, [text, matchIndices]);
  return (
    <span className={className}>
      {highlightedText.map((segment, index) =>
        segment.highlighted ? (
          <mark key={index} className="search-highlight">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </span>
  );
};
interface SearchResultItemProps {
  result: SearchResult;
  index: number;
  isCurrent: boolean;
  onResultClick: (result: SearchResult, index: number) => void;
  onResultHover?: (result: SearchResult, index: number) => void;
}
const SearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  index,
  isCurrent,
  onResultClick,
  onResultHover,
}) => {
  const handleClick = useCallback(() => {
    onResultClick(result, index);
  }, [result, index, onResultClick]);
  const handleHover = useCallback(() => {
    onResultHover?.(result, index);
  }, [result, index, onResultHover]);
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onResultClick(result, index);
      }
    },
    [result, index, onResultClick],
  );
  return (
    <li
      className={`search-result-item ${isCurrent ? "current-result" : ""}`}
      onClick={handleClick}
      onMouseEnter={handleHover}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="listitem"
      aria-selected={isCurrent}
      data-testid={`search-result-${result.id}`}
    >
      <div className="result-content">
        <div className="result-label">
          <HighlightedText
            text={result.label}
            matchIndices={result.matchIndices}
            className="result-text"
          />
        </div>
        <div className="result-type">
          <span className={`type-badge type-${result.type}`}>
            {result.type}
          </span>
        </div>
      </div>
    </li>
  );
};
export const SearchResults: React.FC<SearchResultsProps> = ({
  searchResults,
  currentResultIndex,
  onResultClick,
  onResultHover,
  query: _query,
  maxResults,
  groupByType = false,
}) => {
  const displayedResults = useMemo(() => {
    if (maxResults && searchResults.length > maxResults) {
      return searchResults.slice(0, maxResults);
    }
    return searchResults;
  }, [searchResults, maxResults]);
  const groupedResults = useMemo(() => {
    if (!groupByType) {
      return { all: displayedResults };
    }
    const groups: Record<string, SearchResult[]> = {};
    displayedResults.forEach((result) => {
      const type = result.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(result);
    });
    return groups;
  }, [displayedResults, groupByType]);
  const hiddenResultsCount = useMemo(() => {
    if (!maxResults || searchResults.length <= maxResults) {
      return 0;
    }
    return searchResults.length - maxResults;
  }, [searchResults.length, maxResults]);
  if (searchResults.length === 0) {
    return (
      <div className="search-results-empty">
        <p>No search results</p>
      </div>
    );
  }
  const getResultGlobalIndex = (result: SearchResult): number => {
    return searchResults.findIndex((r) => r.id === result.id);
  };
  return (
    <div className="search-results-container">
      <ul
        className="search-results-list"
        role="list"
        aria-label="Search results"
      >
        {Object.entries(groupedResults).map(([groupType, results]) => (
          <React.Fragment key={groupType}>
            {groupByType && groupType !== "all" && (
              <li className="result-group-header" role="presentation">
                <h3 className="group-title">
                  {groupType === "node" ? "Nodes" : "Containers"}
                </h3>
              </li>
            )}
            {results.map((result) => {
              const globalIndex = getResultGlobalIndex(result);
              return (
                <SearchResultItem
                  key={result.id}
                  result={result}
                  index={globalIndex}
                  isCurrent={globalIndex === currentResultIndex}
                  onResultClick={onResultClick}
                  onResultHover={onResultHover}
                />
              );
            })}
          </React.Fragment>
        ))}
      </ul>

      {hiddenResultsCount > 0 && (
        <div className="more-results-indicator">
          + {hiddenResultsCount} more result
          {hiddenResultsCount !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
};
export default SearchResults;
