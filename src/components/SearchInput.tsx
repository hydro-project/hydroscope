/**
 * SearchInput Component
 * Provides search input with real-time feedback and navigation controls
 */
import React, { useState, useCallback, useEffect, useRef } from "react";
import type { SearchResult } from "../types/core.js";
import { SEARCH_CONFIG } from "../shared/config/search.js";
export interface SearchInputProps {
  onSearch: (query: string) => void;
  onClear: () => void;
  onNavigateNext: () => void;
  onNavigatePrevious: () => void;
  searchResults: readonly SearchResult[];
  currentResultIndex: number;
  isSearching?: boolean;
  query?: string;
  placeholder?: string;
  debounceMs?: number;
}
export const SearchInput: React.FC<SearchInputProps> = ({
  onSearch,
  onClear,
  onNavigateNext,
  onNavigatePrevious,
  searchResults,
  currentResultIndex,
  isSearching = false,
  query = "",
  placeholder = "Search nodes and containers...",
  debounceMs = SEARCH_CONFIG.DEFAULT_DEBOUNCE_MS,
}) => {
  const [inputValue, setInputValue] = useState(query);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);
  // Update input value when query prop changes
  useEffect(() => {
    setInputValue(query);
  }, [query]);
  // Debounced search function
  const debouncedSearch = useCallback(
    (value: string) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        onSearch(value);
      }, debounceMs);
    },
    [onSearch, debounceMs],
  );
  // Handle input change
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setInputValue(value);
      debouncedSearch(value);
    },
    [debouncedSearch],
  );
  // Handle clear button click
  const handleClear = useCallback(() => {
    setInputValue("");
    onClear();
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [onClear]);
  // Handle keyboard events
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      switch (event.key) {
        case "Enter":
          event.preventDefault();
          onSearch(inputValue);
          break;
        case "ArrowDown":
          event.preventDefault();
          if (searchResults && searchResults.length > 0) {
            onNavigateNext();
          }
          break;
        case "ArrowUp":
          event.preventDefault();
          if (searchResults && searchResults.length > 0) {
            onNavigatePrevious();
          }
          break;
        case "Escape":
          event.preventDefault();
          if (inputValue) {
            handleClear();
          }
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      inputValue,
      searchResults?.length,
      onSearch,
      onNavigateNext,
      onNavigatePrevious,
      handleClear,
    ],
  );
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);
  const hasResults = searchResults?.length > 0;
  const hasQuery = inputValue.trim().length > 0;
  const showResultCount = hasQuery || hasResults;
  const isAtFirstResult = currentResultIndex === 0;
  const isAtLastResult =
    currentResultIndex === (searchResults?.length ?? 0) - 1;
  return (
    <div className="search-input-container">
      <div className="search-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isSearching}
          className="search-input"
          aria-label="Search nodes and containers"
          role="textbox"
        />

        {isSearching && (
          <div className="search-loading" aria-live="polite">
            Searching...
          </div>
        )}

        <div className="search-buttons">
          <button
            type="button"
            onClick={() => onSearch(inputValue)}
            disabled={isSearching}
            className="search-button"
            aria-label="Search"
          >
            🔍
          </button>

          {hasQuery && (
            <button
              type="button"
              onClick={handleClear}
              disabled={isSearching}
              className="clear-button"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {showResultCount && (
        <div className="search-results-info">
          {hasResults ? (
            <div className="result-count">
              {searchResults?.length ?? 0} result
              {(searchResults?.length ?? 0) !== 1 ? "s" : ""}
            </div>
          ) : hasQuery ? (
            <div className="no-results">No results</div>
          ) : null}

          {hasResults && (
            <div className="navigation-controls">
              <div className="result-position">
                {currentResultIndex + 1} of {searchResults?.length ?? 0}
              </div>

              <div className="navigation-buttons">
                <button
                  type="button"
                  onClick={onNavigatePrevious}
                  disabled={isAtFirstResult || isSearching}
                  className="nav-button"
                  aria-label="Previous result"
                >
                  ↑
                </button>

                <button
                  type="button"
                  onClick={onNavigateNext}
                  disabled={isAtLastResult || isSearching}
                  className="nav-button"
                  aria-label="Next result"
                >
                  ↓
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default SearchInput;
