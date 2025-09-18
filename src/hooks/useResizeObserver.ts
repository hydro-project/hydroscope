/**
 * @fileoverview Robust ResizeObserver Hook
 *
 * Provides a safer ResizeObserver implementation that prevents cascading updates
 * and ResizeObserver loops by implementing proper debouncing and state management.
 */

import { useRef, useEffect, useCallback } from 'react';
import { UI_CONSTANTS } from '../shared/config';
import { hscopeLogger } from '../utils/logger';

export interface ResizeObserverEntry {
  width: number;
  height: number;
  timestamp: number;
}

export interface UseResizeObserverOptions {
  /**
   * Minimum time between resize callbacks (ms)
   */
  debounceMs?: number;
  /**
   * Minimum pixel change to trigger callback
   */
  threshold?: number;
  /**
   * Prevent callbacks during specified operations
   */
  preventDuring?: () => boolean;
  /**
   * Enable detailed logging
   */
  debug?: boolean;
}

/**
 * Safe ResizeObserver hook that prevents loops and excessive callbacks
 */
export function useResizeObserver(
  callback: (entry: ResizeObserverEntry) => void,
  options: UseResizeObserverOptions = {}
) {
  const {
    debounceMs = UI_CONSTANTS.LAYOUT_DELAY_SHORT,
    threshold = 1,
    preventDuring,
    debug = false,
  } = options;

  const observerRef = useRef<ResizeObserver | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEntryRef = useRef<ResizeObserverEntry | null>(null);
  const callCountRef = useRef(0);

  // Store options in refs to avoid recreating callbacks
  const callbackRef = useRef(callback);
  const optionsRef = useRef({ debounceMs, threshold, preventDuring, debug });

  // Update refs when values change
  useEffect(() => {
    callbackRef.current = callback;
    optionsRef.current = { debounceMs, threshold, preventDuring, debug };
  }, [callback, debounceMs, threshold, preventDuring, debug]);

  const debouncedCallback = useCallback(
    (entry: ResizeObserverEntry) => {
      const lastEntry = lastEntryRef.current;
      const now = Date.now();
      const { debounceMs, threshold, preventDuring, debug } = optionsRef.current;

      // Skip if prevention function returns true
      if (preventDuring?.()) {
        if (debug) {
          console.log(`[useResizeObserver] Skipping callback - preventDuring() returned true`);
        }
        return;
      }

      // Skip if change is too small
      if (lastEntry) {
        const widthDelta = Math.abs(entry.width - lastEntry.width);
        const heightDelta = Math.abs(entry.height - lastEntry.height);

        if (widthDelta < threshold && heightDelta < threshold) {
          if (debug) {
            console.log(`[useResizeObserver] Skipping callback - change too small:`, {
              widthDelta,
              heightDelta,
              threshold,
            });
          }
          return;
        }

        // Skip if too soon after last callback
        const timeDelta = now - lastEntry.timestamp;
        if (timeDelta < debounceMs) {
          if (debug) {
            console.log(`[useResizeObserver] Skipping callback - too soon:`, {
              timeDelta,
              debounceMs,
            });
          }
          return;
        }
      }

      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Schedule the callback
      timeoutRef.current = setTimeout(() => {
        callCountRef.current++;
        lastEntryRef.current = { ...entry, timestamp: now };

        if (debug) {
          console.log(`[useResizeObserver] Executing callback #${callCountRef.current}:`, entry);
        }

        try {
          callbackRef.current(entry);
        } catch (error) {
          hscopeLogger.error('resize', 'Callback error', error);
        }

        timeoutRef.current = null;
      }, debounceMs);

      if (debug) {
        console.log(`[useResizeObserver] Scheduled callback in ${debounceMs}ms`);
      }
    },
    [] // No dependencies - use refs for all values
  );

  const observe = useCallback(
    (element: Element) => {
      if (!element) {
        console.warn('[useResizeObserver] Cannot observe null element');
        return;
      }

      // Disconnect any existing observer
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      // Skip if ResizeObserver is not available
      if (typeof ResizeObserver === 'undefined') {
        console.warn('[useResizeObserver] ResizeObserver not available');
        return;
      }

      const { debug } = optionsRef.current;
      if (debug) {
        console.log(`[useResizeObserver] Starting observation of element:`, element.tagName);
      }

      // Create new observer
      observerRef.current = new ResizeObserver(entries => {
        if (entries.length === 0) return;

        const entry = entries[0];
        const rect = entry.contentRect;

        const resizeEntry: ResizeObserverEntry = {
          width: rect.width,
          height: rect.height,
          timestamp: Date.now(),
        };

        const { debug } = optionsRef.current;
        if (debug) {
          console.log(`[useResizeObserver] ResizeObserver triggered:`, resizeEntry);
        }

        debouncedCallback(resizeEntry);
      });

      // Start observing
      observerRef.current.observe(element);

      // Set initial size
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const initialEntry: ResizeObserverEntry = {
          width: rect.width,
          height: rect.height,
          timestamp: Date.now(),
        };

        if (debug) {
          console.log(`[useResizeObserver] Initial size:`, initialEntry);
        }

        // Set initial entry without calling callback
        lastEntryRef.current = initialEntry;
      }
    },
    [debouncedCallback] // Only depend on debouncedCallback, which is now stable
  );

  const disconnect = useCallback(() => {
    if (observerRef.current) {
      const { debug } = optionsRef.current;
      if (debug) {
        console.log(`[useResizeObserver] Disconnecting observer`);
      }
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    lastEntryRef.current = null;
    callCountRef.current = 0;
  }, []); // No dependencies - use refs for all values

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { observe, disconnect };
}
