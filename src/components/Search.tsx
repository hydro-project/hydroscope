/**
 * Search Component
 * Integrated search component with input and results display
 */
import React, { useState, useCallback } from "react";
import { SearchInput } from "./SearchInput.js";
import { SearchResults } from "./SearchResults.js";
import type { SearchResult } from "../types/core.js";
export interface SearchProps {
  onSearch: (query: string) => void;
  onClear: () => void;
  onResultSelect: (result: SearchResult) => void;
  searchResults: readonly SearchResult[];
  isSearching?: boolean;
  query?: string;
  placeholder?: string;
  maxResults?: number;
  groupByType?: boolean;
  showResultsPanel?: boolean;
}
export const Search: React.FC<SearchProps> = ({
  onSearch,
  onClear,
  onResultSelect,
  searchResults,
  isSearching = false,
  query = "",
  placeholder,
  maxResults,
  groupByType = false,
  showResultsPanel = true,
}) => {
  // Track search results length to detect changes
  const searchResultsLength = searchResults?.length || 0;
  // Initialize with -1 and derive from searchResultsLength to reset automatically
  const [currentResultIndex, setCurrentResultIndex] = useState(-1);
  // Use a ref to track previous length
  const prevLengthRef = React.useRef(searchResultsLength);

  // Reset navigation when search results change
  if (prevLengthRef.current !== searchResultsLength) {
    prevLengthRef.current = searchResultsLength;
    if (currentResultIndex !== -1) {
      setCurrentResultIndex(-1);
    }
  }
  // Navigation handlers
  const handleNavigateNext = useCallback(() => {
    if (!searchResults || searchResults.length === 0) return;
    setCurrentResultIndex((prevIndex) => {
      if (prevIndex < 0) return 0;
      return (prevIndex + 1) % searchResults.length;
    });
  }, [searchResults]);
  const handleNavigatePrevious = useCallback(() => {
    if (!searchResults || searchResults.length === 0) return;
    setCurrentResultIndex((prevIndex) => {
      if (prevIndex <= 0) return searchResults.length - 1;
      return prevIndex - 1;
    });
  }, [searchResults]);
  // Result selection handlers
  const handleResultClick = useCallback(
    (result: SearchResult, index: number) => {
      setCurrentResultIndex(index);
      onResultSelect(result);
    },
    [onResultSelect],
  );
  const handleResultHover = useCallback(
    (result: SearchResult, index: number) => {
      setCurrentResultIndex(index);
    },
    [],
  );
  // Clear handler that resets navigation
  const handleClear = useCallback(() => {
    setCurrentResultIndex(-1);
    onClear();
  }, [onClear]);
  // Keyboard navigation for current result selection
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (
        event.key === "Enter" &&
        currentResultIndex >= 0 &&
        searchResults &&
        currentResultIndex < searchResults.length
      ) {
        event.preventDefault();
        const currentResult = searchResults[currentResultIndex];
        onResultSelect(currentResult);
      }
    },
    [currentResultIndex, searchResults, onResultSelect],
  );
  const hasResults = searchResults?.length > 0;
  const showResults =
    showResultsPanel && (hasResults || (query && !isSearching));
  return (
    <div className="search-container" onKeyDown={handleKeyDown}>
      <SearchInput
        onSearch={onSearch}
        onClear={handleClear}
        onNavigateNext={handleNavigateNext}
        onNavigatePrevious={handleNavigatePrevious}
        searchResults={searchResults}
        currentResultIndex={currentResultIndex}
        isSearching={isSearching}
        query={query}
        placeholder={placeholder}
      />

      {showResults && (
        <div className="search-results-panel">
          <SearchResults
            searchResults={searchResults}
            currentResultIndex={currentResultIndex}
            onResultClick={handleResultClick}
            onResultHover={handleResultHover}
            query={query}
            maxResults={maxResults}
            groupByType={groupByType}
          />
        </div>
      )}
    </div>
  );
};
export default Search;
