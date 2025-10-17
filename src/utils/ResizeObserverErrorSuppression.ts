/**
 * @fileoverview ResizeObserver Error Suppression Utility
 *
 * Provides comprehensive error suppression for ResizeObserver loop errors
 * that commonly occur during dynamic layout changes in React Flow components.
 *
 * This utility implements multiple layers of protection:
 * 1. Global error handler for uncaught ResizeObserver errors
 * 2. Debounced layout operations to prevent rapid-fire changes
 * 3. Error boundary integration for graceful recovery
 * 4. Development vs production error handling
 */
import { hscopeLogger } from "./logger.js";

// Global flag to track if error suppression is active
let isErrorSuppressionActive = false;
let originalErrorHandler: OnErrorEventHandler | null = null;
let originalUnhandledRejectionHandler:
  | ((event: PromiseRejectionEvent) => void)
  | null = null;

/**
 * ResizeObserver error patterns to suppress
 */
const RESIZE_OBSERVER_ERROR_PATTERNS = [
  /ResizeObserver loop limit exceeded/i,
  /ResizeObserver loop completed with undelivered notifications/i,
  /Non-Error promise rejection captured/i,
];

/**
 * Check if an error should be suppressed
 */
function shouldSuppressError(error: Error | string): boolean {
  const errorMessage = typeof error === "string" ? error : error.message;
  return RESIZE_OBSERVER_ERROR_PATTERNS.some((pattern) =>
    pattern.test(errorMessage),
  );
}

/**
 * Log suppressed ResizeObserver errors in development mode
 */
function logSuppressedError(error: Error | string, context?: string): void {
  if (process.env.NODE_ENV === "development") {
    const errorMessage = typeof error === "string" ? error : error.message;
    const contextInfo = context ? ` (${context})` : "";
    hscopeLogger.log(
      "debug",
      `[Hydroscope] Suppressed ResizeObserver error${contextInfo}:`,
      errorMessage,
    );
  }
}

/**
 * Custom error handler that suppresses ResizeObserver errors
 */
function customErrorHandler(event: ErrorEvent): void {
  // Safely extract error information
  const error = event.error;
  const message = event.message;
  const errorToCheck = error || message || "";

  if (shouldSuppressError(errorToCheck)) {
    // Log in development for debugging
    logSuppressedError(errorToCheck, "global error handler");
    event.preventDefault();
    return;
  }

  // Let other errors through to original handler
  if (originalErrorHandler) {
    originalErrorHandler(event);
  }
}

/**
 * Custom unhandled rejection handler for promise-based ResizeObserver errors
 */
function customUnhandledRejectionHandler(event: PromiseRejectionEvent): void {
  const reason = event.reason;
  if (reason && shouldSuppressError(reason)) {
    // Log in development for debugging
    logSuppressedError(reason, "unhandled promise rejection");
    event.preventDefault();
    return;
  }

  // Let other rejections through to original handler
  if (originalUnhandledRejectionHandler) {
    originalUnhandledRejectionHandler(event);
  }
}

/**
 * Enable ResizeObserver error suppression
 */
export function enableResizeObserverErrorSuppression(): void {
  if (isErrorSuppressionActive || typeof window === "undefined") {
    return;
  }

  // Store original handlers
  originalErrorHandler = window.onerror;
  originalUnhandledRejectionHandler = window.onunhandledrejection;

  // Install custom handlers
  window.addEventListener("error", customErrorHandler);
  window.addEventListener(
    "unhandledrejection",
    customUnhandledRejectionHandler,
  );

  isErrorSuppressionActive = true;

  if (process.env.NODE_ENV === "development") {
    hscopeLogger.log(
      "debug",
      "[Hydroscope] ResizeObserver error suppression enabled",
    );
  }
}

/**
 * Disable ResizeObserver error suppression
 */
export function disableResizeObserverErrorSuppression(): void {
  if (!isErrorSuppressionActive || typeof window === "undefined") {
    return;
  }

  // Remove custom handlers
  window.removeEventListener("error", customErrorHandler);
  window.removeEventListener(
    "unhandledrejection",
    customUnhandledRejectionHandler,
  );

  // Restore original handlers
  if (originalErrorHandler) {
    window.onerror = originalErrorHandler;
    originalErrorHandler = null;
  }

  if (originalUnhandledRejectionHandler) {
    window.onunhandledrejection = originalUnhandledRejectionHandler;
    originalUnhandledRejectionHandler = null;
  }

  isErrorSuppressionActive = false;

  if (process.env.NODE_ENV === "development") {
    hscopeLogger.log(
      "debug",
      "[Hydroscope] ResizeObserver error suppression disabled",
    );
  }
}

/**
 * Debounced operation wrapper to prevent rapid-fire layout changes
 */
export class DebouncedOperationManager {
  private timeouts = new Map<string, number>();
  private readonly defaultDelay: number;

  constructor(defaultDelay = 100) {
    this.defaultDelay = defaultDelay;
  }

  /**
   * Execute an operation with debouncing
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debounce<T extends (...args: any[]) => any>(
    key: string,
    operation: T,
    delay = this.defaultDelay,
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      // Clear existing timeout
      const existingTimeout = this.timeouts.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new timeout
      const timeoutId = setTimeout(() => {
        this.timeouts.delete(key);
        operation(...args);
      }, delay) as unknown as number;

      this.timeouts.set(key, timeoutId);
    };
  }

  /**
   * Cancel a debounced operation
   */
  cancel(key: string): void {
    const timeoutId = this.timeouts.get(key);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(key);
    }
  }

  /**
   * Cancel all debounced operations
   */
  cancelAll(): void {
    for (const timeoutId of this.timeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.timeouts.clear();
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    this.cancelAll();
  }
}

/**
 * Safe wrapper for operations that might trigger ResizeObserver errors
 */
// Using any for generic function wrapper - needs to accept any function signature
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withResizeObserverErrorSuppression<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends (...args: any[]) => any,
>(operation: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    try {
      return operation(...args);
    } catch (error) {
      if (shouldSuppressError(error as Error)) {
        logSuppressedError(error as Error, "synchronous operation");
        return;
      }
      throw error;
    }
  }) as T;
}

/**
 * Safe async wrapper for operations that might trigger ResizeObserver errors
 */
// Using any for generic async function wrapper - needs to accept any function signature
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withAsyncResizeObserverErrorSuppression<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends (...args: any[]) => Promise<any>,
>(operation: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (async (...args: any[]) => {
    try {
      return await operation(...args);
    } catch (error) {
      if (shouldSuppressError(error as Error)) {
        logSuppressedError(error as Error, "asynchronous operation");
        return;
      }
      throw error;
    }
  }) as T;
}

/**
 * React hook for managing ResizeObserver error suppression lifecycle
 */
export function useResizeObserverErrorSuppression(): {
  enable: () => void;
  disable: () => void;
  isActive: boolean;
} {
  return {
    enable: enableResizeObserverErrorSuppression,
    disable: disableResizeObserverErrorSuppression,
    isActive: isErrorSuppressionActive,
  };
}

/**
 * Enhanced wrapper for DOM manipulation operations that might trigger ResizeObserver errors
 */
export function withDOMResizeObserverErrorSuppression<
  T extends (...args: any[]) => any,
>(operation: T, context?: string): T {
  return ((...args: any[]) => {
    try {
      const result = operation(...args);

      // If the operation returns a promise, handle async errors
      if (result && typeof result.then === "function") {
        return result.catch((error: Error) => {
          if (shouldSuppressError(error)) {
            logSuppressedError(error, context || "DOM operation");
            return;
          }
          throw error;
        });
      }

      return result;
    } catch (error) {
      if (shouldSuppressError(error as Error)) {
        logSuppressedError(error as Error, context || "DOM operation");
        return;
      }
      throw error;
    }
  }) as T;
}

/**
 * Wrapper for layout operations that commonly trigger ResizeObserver errors
 */
export function withLayoutResizeObserverErrorSuppression<
  T extends (...args: any[]) => any,
>(operation: T): T {
  return withDOMResizeObserverErrorSuppression(operation, "layout operation");
}

/**
 * Wrapper for style operations that commonly trigger ResizeObserver errors
 */
export function withStyleResizeObserverErrorSuppression<
  T extends (...args: any[]) => any,
>(operation: T): T {
  return withDOMResizeObserverErrorSuppression(operation, "style operation");
}

/**
 * Wrapper for container operations that commonly trigger ResizeObserver errors
 */
export function withContainerResizeObserverErrorSuppression<
  T extends (...args: any[]) => any,
>(operation: T): T {
  return withDOMResizeObserverErrorSuppression(
    operation,
    "container operation",
  );
}

/**
 * Wrapper for search operations that commonly trigger ResizeObserver errors
 */
export function withSearchResizeObserverErrorSuppression<
  T extends (...args: any[]) => any,
>(operation: T): T {
  return withDOMResizeObserverErrorSuppression(operation, "search operation");
}

/**
 * Batch operation wrapper that suppresses ResizeObserver errors for multiple operations
 */
export function withBatchResizeObserverErrorSuppression<T>(
  operations: Array<() => T>,
  context?: string,
): T[] {
  const results: T[] = [];

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i];
    try {
      const result = withDOMResizeObserverErrorSuppression(
        operation,
        context
          ? `${context} (batch ${i + 1}/${operations.length})`
          : `batch operation ${i + 1}/${operations.length}`,
      )();
      results.push(result);
    } catch (error) {
      // Log the error but continue with other operations
      console.error(`[Hydroscope] Error in batch operation ${i + 1}:`, error);
      // Push undefined for failed operations to maintain array length
      results.push(undefined as T);
    }
  }

  return results;
}
