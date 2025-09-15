/**
 * SearchControls
 * - Debounced wildcard search over provided items
 * - Prev/Next navigation among matches
 * - Search result count display and clear
 * 
 * IMPORTANT: Race Condition Prevention:
 * - Search operations execute synchronously to prevent layout race conditions
 * - Search highlighting animations use box-shadow instead of transform
 * - All operations coordinate with the GlobalLayoutLock system
 */

import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import { Input, Button, Tooltip, AutoComplete } from 'antd';
import { PANEL_CONSTANTS } from '../shared/config';

export type SearchableItem = { id: string; label: string; type: 'container' | 'node' };
export type SearchMatch = {
  id: string;
  label: string;
  type: 'container' | 'node';
  matchIndices?: number[][];
};

export interface SearchControlsRef {
  focus: () => void;
  clear: () => void;
}

type Props = {
  searchableItems: SearchableItem[];
  onSearch: (query: string, matches: SearchMatch[]) => void;
  onClear: () => void;
  onNavigate: (dir: 'prev' | 'next', current: SearchMatch) => void;
  placeholder?: string;
  compact?: boolean;
};

// Convert wildcard pattern (* ?) to case-insensitive regex (substring match)
function toRegex(pattern: string): RegExp | null {
  const raw = pattern.trim();
  if (!raw) return null;
  const escaped = raw
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // escape regex chars
    .replace(/\\\*/g, '.*') // * -> .*
    .replace(/\\\?/g, '.'); // ? -> .
  try {
    return new RegExp(escaped, 'i');
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
      placeholder = 'Search (wildcards: * ?)',
      compact = false,
    },
    ref
  ) => {
    const [query, setQuery] = useState('');
    const [matches, setMatches] = useState<SearchMatch[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [_showHistory, _setShowHistory] = useState(false);
    const timerRef = useRef<number | null>(null);
    const inputRef = useRef<any>(null);

    // Load search history from localStorage on mount
    useEffect(() => {
      try {
        const stored = localStorage.getItem('hydroscope_search_history');
        if (stored) {
          const history = JSON.parse(stored);
          if (Array.isArray(history)) {
            setSearchHistory(history.slice(0, 10)); // Keep only last 10
          }
        }
      } catch (e) {
        console.warn('Failed to load search history:', e);
      }
    }, []);

    // Add to search history when query is executed
    const addToHistory = (searchQuery: string) => {
      if (!searchQuery.trim()) return;

      setSearchHistory(currentHistory => {
        const newHistory = [searchQuery, ...currentHistory.filter(h => h !== searchQuery)].slice(
          0,
          10
        ); // Keep only last 10 unique searches

        // Save to localStorage
        try {
          localStorage.setItem('hydroscope_search_history', JSON.stringify(newHistory));
        } catch (e) {
          console.warn('Failed to save search history:', e);
        }

        return newHistory;
      });
    };

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      clear: () => clearAll(),
    }));

    // Debounced search with batched result application
    useEffect(() => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        const rx = toRegex(query);
        if (!rx) {
          setMatches([]);
          setCurrentIndex(0);
          // Apply clear operation synchronously to prevent race conditions
          onSearch('', []);
          return;
        }
        const next = searchableItems.filter(i => rx.test(i.label)).map(i => ({ ...i }));
        setMatches(next);
        setCurrentIndex(0);

        // Apply search results synchronously to prevent race conditions with layout operations
        // The async batching was causing visibility state inconsistency during search
        onSearch(query, next);

        // Add to history when we get results
        if (next.length > 0) {
          addToHistory(query);
        }
      }, 300); // Increased from 150ms to 300ms to prevent layout race conditions
      return () => {
        if (timerRef.current) window.clearTimeout(timerRef.current);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- onSearch dependency causes graph layout issues and repositioning problems
    }, [query, searchableItems]);

    // Keep index in range
    useEffect(() => {
      if (!matches.length && currentIndex !== 0) setCurrentIndex(0);
      if (currentIndex >= matches.length && matches.length) setCurrentIndex(0);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- currentIndex dependency would create infinite loop since effect calls setCurrentIndex
    }, [matches]);

    const navigate = (dir: 'prev' | 'next') => {
      if (!matches.length) return;
      const idx =
        dir === 'next'
          ? (currentIndex + 1) % matches.length
          : (currentIndex - 1 + matches.length) % matches.length;
      setCurrentIndex(idx);

      // Apply navigation synchronously to prevent race conditions
      onNavigate(dir, matches[idx]);
    };

    const clearAll = () => {
      setQuery('');
      setMatches([]);
      setCurrentIndex(0);

      // Apply clear operations synchronously to prevent race conditions
      onClear();
      onSearch('', []);
    };

    const countText = useMemo(() => {
      if (!query.trim()) return '';
      if (!matches.length) return '0 / 0';
      return `${Math.min(currentIndex + 1, matches.length)} / ${matches.length}`;
    }, [query, matches, currentIndex]);

    return (
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: compact ? 6 : 10 }}
      >
        <AutoComplete
          value={query}
          onChange={v => {
            setQuery(v);
            if (v === '') {
              setMatches([]);
              setCurrentIndex(0);
              // Apply clear operations synchronously to prevent race conditions
              onClear();
              onSearch('', []);
            }
          }}
          onSelect={v => {
            setQuery(v);
          }}
          placeholder={placeholder}
          options={searchHistory.map(h => ({ value: h, label: h }))}
          style={{ flex: 1 }}
        >
          <Input
            ref={inputRef}
            allowClear
            onKeyDown={e => {
              if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                navigate('prev');
              } else if (e.key === 'Enter') {
                e.preventDefault();
                navigate('next');
              } else if (e.key === 'Escape') {
                clearAll();
              }
            }}
            style={{ height: compact ? 28 : undefined }}
          />
        </AutoComplete>
        <span
          style={{
            minWidth: PANEL_CONSTANTS.SEARCH_MIN_WIDTH,
            textAlign: 'center',
            fontSize: PANEL_CONSTANTS.FONT_SIZE_SMALL,
            color: '#666',
          }}
        >
          {countText}
        </span>
        <Tooltip title="Previous match">
          <Button
            size={compact ? 'small' : 'middle'}
            onClick={() => navigate('prev')}
            disabled={!matches.length}
          >
            ↑
          </Button>
        </Tooltip>
        <Tooltip title="Next match">
          <Button
            size={compact ? 'small' : 'middle'}
            onClick={() => navigate('next')}
            disabled={!matches.length}
          >
            ↓
          </Button>
        </Tooltip>
        <Tooltip title="Clear">
          <Button size={compact ? 'small' : 'middle'} onClick={clearAll} disabled={!query}>
            ✕
          </Button>
        </Tooltip>
      </div>
    );
  }
);

SearchControls.displayName = 'SearchControls';
