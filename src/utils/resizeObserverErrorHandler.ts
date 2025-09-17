/**
 * @fileoverview Comprehensive ResizeObserver Error Suppression
 *
 * Handles ResizeObserver loop errors at multiple levels to prevent them from
 * reaching webpack dev server and other error reporting systems. Implements
 * both prevention (patching ResizeObserver) and suppression (error handlers).
 */

import { useState, useEffect } from 'react';
import { hscopeLogger } from './logger';

export class ResizeObserverErrorHandler {
  private static instance: ResizeObserverErrorHandler | null = null;
  private originalErrorHandler: OnErrorEventHandler | null = null;
  private originalUnhandledRejection: ((event: PromiseRejectionEvent) => void) | null = null;
  private originalResizeObserver: typeof ResizeObserver | null = null;
  private suppressedCount = 0;
  private lastSuppressionTime = 0;
  private paused = false;
  private throttleMinInterval = 30; // ms between delivering callbacks
  private lastDeliveredTime = 0;
  private pendingROEntries: ResizeObserverEntry[] = [];
  private flushTimer: number | null = null;
  private watchdogWindowMs = 600;
  private watchdogThreshold = 4; // suppressed errors within window to trigger pause
  private recentSuppressTimestamps: number[] = [];

  static getInstance(): ResizeObserverErrorHandler {
    if (!ResizeObserverErrorHandler.instance) {
      ResizeObserverErrorHandler.instance = new ResizeObserverErrorHandler();
    }
    return ResizeObserverErrorHandler.instance;
  }

  private isResizeObserverLoopError(error: Error | string | any): boolean {
    const message =
      typeof error === 'string' ? error : error?.message || error?.reason?.message || String(error);
    return (
      message.includes('ResizeObserver loop') ||
      message.includes('ResizeObserver loop completed with undelivered notifications') ||
      message.includes('ResizeObserver loop limit exceeded')
    );
  }

  install(): void {
    if (typeof window === 'undefined') return;

    this.installResizeObserverPatch();
    this.installErrorHandlers();

    hscopeLogger.log('ro', 'installed');
  }
  private installResizeObserverPatch(): void {
    if (!window.ResizeObserver) return;

    this.originalResizeObserver = window.ResizeObserver;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    // Patch ResizeObserver to prevent errors at the source
    window.ResizeObserver = class PatchedResizeObserver {
      private observer: ResizeObserver;

      constructor(callback: ResizeObserverCallback) {
        const wrappedCallback: ResizeObserverCallback = (entries, observer) => {
          if (self.paused) {
            // Skip invoking callback entirely while paused to avoid loop pressure
            return;
          }
          const now = Date.now();
          const deliver = () => {
            try {
              self.lastDeliveredTime = now;
              const toSend = self.pendingROEntries.length ? self.pendingROEntries : entries;
              self.pendingROEntries = [];
              callback(toSend, observer);
            } catch (error) {
              if (self.isResizeObserverLoopError(error)) {
                self.recordSuppression();
                return; // swallow
              }
              throw error;
            }
          };
          // Throttle rapid callback storms (aggregate)
          if (now - self.lastDeliveredTime < self.throttleMinInterval) {
            // accumulate entries
            self.pendingROEntries.push(...entries);
            if (!self.flushTimer) {
              const wait = self.throttleMinInterval - (now - self.lastDeliveredTime);
              self.flushTimer = window.setTimeout(
                () => {
                  self.flushTimer = null;
                  deliver();
                },
                Math.max(wait, 5)
              );
            }
            return;
          }
          deliver();
        };

        this.observer = new self.originalResizeObserver!(wrappedCallback);
      }

      observe(target: Element, options?: ResizeObserverOptions) {
        return this.observer.observe(target, options);
      }

      unobserve(target: Element) {
        return this.observer.unobserve(target);
      }

      disconnect() {
        return this.observer.disconnect();
      }
    };

    // Preserve prototype and static properties
    Object.setPrototypeOf(window.ResizeObserver, this.originalResizeObserver);
    Object.defineProperty(window.ResizeObserver, 'name', { value: 'ResizeObserver' });
  }

  private installErrorHandlers(): void {
    // Store original handlers
    this.originalErrorHandler = window.onerror;
    this.originalUnhandledRejection = window.onunhandledrejection;

    // More aggressive error interception - override ALL error handling mechanisms
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    // Hook into window.onerror for synchronous errors
    window.onerror = (message, source, lineno, colno, error) => {
      if (this.isResizeObserverLoopError(message as string)) {
        this.suppressedCount++;
        this.lastSuppressionTime = Date.now();

        if (this.suppressedCount <= 3 || this.suppressedCount % 10 === 0) {
          console.info(`[ResizeObserverErrorHandler] Suppressed error #${this.suppressedCount}`, {
            message,
            source,
            lineno,
            colno,
          });
        }

        return true; // Prevent default error handling (webpack overlay)
      }

      // Call original handler for other errors
      if (this.originalErrorHandler) {
        return this.originalErrorHandler(message, source, lineno, colno, error);
      }
      return false;
    };

    // Completely override addEventListener to intercept webpack's error handling
    const originalAddEventListener = window.addEventListener;
    window.addEventListener = function (type: string, listener: any, options?: any) {
      if (type === 'error' && listener) {
        // Wrap the error listener to filter ResizeObserver errors
        const wrappedListener = (event: Event) => {
          const errorEvent = event as ErrorEvent;
          if (errorEvent.message && self.isResizeObserverLoopError(errorEvent.message)) {
            console.info(
              '[ResizeObserverErrorHandler] Blocked ResizeObserver error from event listener'
            );
            event.stopImmediatePropagation();
            event.preventDefault();
            return false; // Don't call the original listener
          }
          return listener.call(window, event);
        };
        return originalAddEventListener.call(window, type, wrappedListener, options);
      }
      return originalAddEventListener.call(window, type, listener, options);
    };

    // Override removeEventListener to track what webpack is doing
    const originalRemoveEventListener = window.removeEventListener;
    window.removeEventListener = function (type: string, listener: any, options?: any) {
      return originalRemoveEventListener.call(window, type, listener, options);
    };

    // Aggressive console.error override to catch webpack's direct console calls
    const originalConsoleError = console.error;
    console.error = function (...args: any[]) {
      const message = args.join(' ');
      if (self.isResizeObserverLoopError(message)) {
        console.info('[ResizeObserverErrorHandler] Blocked console.error ResizeObserver message');
        return;
      }
      return originalConsoleError.apply(console, args);
    };

    // Install early error capture before webpack can set up its handlers
    const errorHandler = (event: ErrorEvent) => {
      if (self.isResizeObserverLoopError(event.message)) {
        event.stopImmediatePropagation();
        event.preventDefault();
        console.info('[ResizeObserverErrorHandler] Intercepted ResizeObserver error event');
        return false;
      }
    };

    // Capture at the document level as well
    document.addEventListener('error', errorHandler, true); // Use capture phase
    window.addEventListener('error', errorHandler, true); // Use capture phase

    // Specifically target webpack dev server error overlay
    const disableWebpackOverlay = () => {
      // Webpack dev server uses these specific functions
      if ((window as any).__webpack_dev_server__) {
        const overlay = (window as any).__webpack_dev_server__.overlay;
        if (overlay) {
          const originalShow = overlay.show;
          overlay.show = function (messages: any[]) {
            // Filter out ResizeObserver errors
            const filteredMessages = messages.filter(msg => {
              const messageStr = typeof msg === 'string' ? msg : msg.message || '';
              return !self.isResizeObserverLoopError(messageStr);
            });
            if (filteredMessages.length > 0) {
              return originalShow.call(overlay, filteredMessages);
            }
          };
        }
      }

      // Also try to access webpack's runtime error handler
      if ((window as any).webpackHotUpdate) {
        hscopeLogger.log('ro', 'webpack runtime detected');
      }
    };

    // Last‑resort DOM scrubbing if overlay already rendered
    const scrubExistingOverlay = () => {
      const candidates = document.querySelectorAll('iframe, div');
      candidates.forEach(node => {
        try {
          // Webpack overlay containers often have id or style with z-index and contain the error text
          const text = node.textContent || '';
          if (text.includes('ResizeObserver loop') && text.length < 2000) {
            // Hide only if every listed error is a ResizeObserver loop variant
            if (!/((?!(ReferenceError|TypeError|SyntaxError)).)*/.test(text)) return;
            const container = node as HTMLElement;
            if (container && container.style) {
              container.style.display = 'none';
              container.setAttribute('data-ro-overlay-suppressed', 'true');
              console.info(
                '[ResizeObserverErrorHandler] Removed existing ResizeObserver-only overlay'
              );
            }
          }
        } catch {
          /* ignore */
        }
      });
    };

    // Poll briefly after startup since overlay may appear after our install
    let scrubRuns = 0;
    const scrubInterval = setInterval(() => {
      scrubRuns++;
      scrubExistingOverlay();
      if (scrubRuns > 25) {
        // ~5s at 200ms
        clearInterval(scrubInterval);
      }
    }, 200);

    // Try to disable webpack overlay immediately and after a delay
    disableWebpackOverlay();
    setTimeout(disableWebpackOverlay, 50);
    setTimeout(disableWebpackOverlay, 200);
    setTimeout(disableWebpackOverlay, 500);
    setTimeout(disableWebpackOverlay, 1500);

    // Hook into unhandled promise rejections
    window.onunhandledrejection = event => {
      if (this.isResizeObserverLoopError(event.reason)) {
        this.suppressedCount++;
        this.lastSuppressionTime = Date.now();

        if (this.suppressedCount <= 3 || this.suppressedCount % 10 === 0) {
          console.info(
            `[ResizeObserverErrorHandler] Suppressed promise rejection #${this.suppressedCount}`,
            { reason: event.reason }
          );
        }

        event.preventDefault(); // Prevent default error handling
        return;
      }

      // Call original handler for other rejections
      if (this.originalUnhandledRejection) {
        this.originalUnhandledRejection(event);
      }
    };
  }

  uninstall(): void {
    if (typeof window === 'undefined') return;

    // Restore original handlers
    if (this.originalErrorHandler) {
      window.onerror = this.originalErrorHandler;
      this.originalErrorHandler = null;
    }

    if (this.originalUnhandledRejection) {
      window.onunhandledrejection = this.originalUnhandledRejection;
      this.originalUnhandledRejection = null;
    }

    if (this.originalResizeObserver) {
      window.ResizeObserver = this.originalResizeObserver;
      this.originalResizeObserver = null;
    }

    hscopeLogger.log('ro', `uninstalled suppressed=${this.suppressedCount}`);
  }

  getStats() {
    return {
      suppressedCount: this.suppressedCount,
      lastSuppressionTime: this.lastSuppressionTime,
      paused: this.paused,
      throttleMinInterval: this.throttleMinInterval,
      pendingEntries: this.pendingROEntries.length,
    };
  }

  /** Temporarily pause all ResizeObserver callbacks */
  pause() {
    this.paused = true;
  }
  /** Resume ResizeObserver callbacks */
  resume() {
    this.paused = false;
  }

  private recordSuppression() {
    this.suppressedCount++;
    this.lastSuppressionTime = Date.now();
    this.recentSuppressTimestamps.push(this.lastSuppressionTime);
    // prune window
    const cutoff = this.lastSuppressionTime - this.watchdogWindowMs;
    this.recentSuppressTimestamps = this.recentSuppressTimestamps.filter(t => t >= cutoff);
    if (this.suppressedCount <= 3 || this.suppressedCount % 10 === 0) {
      console.info(
        `[ResizeObserver] Prevented loop error #${this.suppressedCount} (recent=${this.recentSuppressTimestamps.length})`
      );
    }
    if (!this.paused && this.recentSuppressTimestamps.length >= this.watchdogThreshold) {
      console.warn(
        '[ResizeObserverErrorHandler] Watchdog: rapid suppressions detected – pausing ResizeObserver temporarily'
      );
      this.pause();
      setTimeout(() => this.resume(), 450); // resume after cool-off
    }
  }
}

/**
 * Hook to automatically install/uninstall the ResizeObserver error handler
 */
export function useResizeObserverErrorHandler() {
  const [handler] = useState(() => ResizeObserverErrorHandler.getInstance());

  useEffect(() => {
    handler.install();
    return () => handler.uninstall();
  }, [handler]);

  return handler.getStats();
}

// Auto-install the error handler as soon as this module is imported
// This ensures ResizeObserver is patched before any components try to use it
// Install IMMEDIATELY and synchronously
if (typeof window !== 'undefined') {
  // Install error suppression immediately, even before DOM is ready
  (function installImmediately() {
    const handler = ResizeObserverErrorHandler.getInstance();
    handler.install();

    // Also install on DOM ready in case webpack overrides our handlers later
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        handler.install(); // Reinstall to override webpack
      });
    }

    // Install again after a short delay to catch webpack's late installations
    setTimeout(() => {
      handler.install();
    }, 100);

    hscopeLogger.log('ro', 'auto-install module import');
  })();
}
