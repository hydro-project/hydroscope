/**
 * ResizeObserver Debouncing Utility
 *
 * Patches the global ResizeObserver to debounce callbacks and prevent cascading loops.
 * This fixes the "ResizeObserver loop completed with undelivered notifications" error
 * that occurs when many elements are measured rapidly (e.g., during search operations).
 *
 * The debouncing accumulates entries over a 16ms window (one animation frame) and
 * delivers them in a single batch, preventing the cascade that triggers the error.
 */

let isPatched = false;
let originalResizeObserver: typeof ResizeObserver | null = null;

/**
 * Enable ResizeObserver debouncing globally
 * This should be called once when the application initializes
 */
export function enableResizeObserverDebouncing(): void {
  if (typeof window === "undefined" || isPatched) {
    return;
  }

  originalResizeObserver = window.ResizeObserver;

  class DebouncedResizeObserver extends originalResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      let pendingEntries: ResizeObserverEntry[] = [];
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;

      super((entries, observer) => {
        // Always accumulate entries for batching
        pendingEntries.push(...entries);

        // Clear existing timer
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        // Batch all callbacks with 0ms delay (same event loop tick)
        // This prevents cascading loops while still allowing measurements to complete
        debounceTimer = setTimeout(() => {
          if (pendingEntries.length > 0) {
            callback(pendingEntries, observer);
            pendingEntries = [];
          }
          debounceTimer = null;
        }, 0);
      });
    }
  }

  window.ResizeObserver = DebouncedResizeObserver as any;
  isPatched = true;
}

/**
 * Disable ResizeObserver debouncing and restore original behavior
 */
export function disableResizeObserverDebouncing(): void {
  if (typeof window === "undefined" || !isPatched || !originalResizeObserver) {
    return;
  }

  window.ResizeObserver = originalResizeObserver;
  isPatched = false;
}

/**
 * Check if ResizeObserver debouncing is currently enabled
 */
export function isResizeObserverDebouncingEnabled(): boolean {
  return isPatched;
}
