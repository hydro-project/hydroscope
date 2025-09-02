/**
 * SearchControls
 * - Debounced wildcard search over provided items
 * - Prev/Next navigation among matche        value={query}
        onChange={(e) => {
          const val = e.target.value;
          setQuery(val);
          if (!val) {
            setMatches([]);
            setCurrentIndex(0);
            onClear();
            onSearch('', []);
          }
        }}
        placeholder={placeholder}
        ref={inputRef}
        allowClearcount display and clear
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

    // Debounced search
    useEffect(() => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        const rx = toRegex(query);
        if (!rx) {
          setMatches([]);
          setCurrentIndex(0);
          onSearch('', []);
          return;
        }
        const next = searchableItems.filter(i => rx.test(i.label)).map(i => ({ ...i }));
        setMatches(next);
        setCurrentIndex(0);
        onSearch(query, next);

        // Add to history when we get results
        if (next.length > 0) {
          addToHistory(query);
        }
      }, 150);
      return () => {
        if (timerRef.current) window.clearTimeout(timerRef.current);
      };
    }, [query, searchableItems]);

    // Keep index in range
    useEffect(() => {
      if (!matches.length && currentIndex !== 0) setCurrentIndex(0);
      if (currentIndex >= matches.length && matches.length) setCurrentIndex(0);
    }, [matches]);

    const navigate = (dir: 'prev' | 'next') => {
      if (!matches.length) return;
      const idx =
        dir === 'next'
          ? (currentIndex + 1) % matches.length
          : (currentIndex - 1 + matches.length) % matches.length;
      setCurrentIndex(idx);
      onNavigate(dir, matches[idx]);
    };

    const clearAll = () => {
      setQuery('');
      setMatches([]);
      setCurrentIndex(0);
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
