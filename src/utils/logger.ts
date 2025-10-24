/**
 * Lightweight category-based logger to reduce console noise.
 *
 * ## Usage
 * Instead of `console.log()`, use `hscopeLogger.log(category, ...args)`:
 *
 * ```typescript
 * import { hscopeLogger } from './utils/logger';
 *
 * // Debug logging (suppressed by default)
 * hscopeLogger.log('coordinator', 'Operation completed', { id, status });
 *
 * // Errors and warnings (use console.error/warn directly - these are never suppressed)
 * console.error('[Component] Critical error:', error);
 * console.warn('[Component] Unexpected state:', state);
 * ```
 *
 * ## Enabling Logs
 * By default, all debug logs are suppressed. To enable specific categories:
 *
 * - **Browser**: Set `(window as any).__HYDRO_LOGS = 'coordinator,bridge,op'`
 * - **Node/Build**: Set `HYDRO_LOGS=coordinator,bridge,op` environment variable
 * - **Tests**: Set `ENABLE_TEST_LOGS=true` to see test console output
 *
 * ## Available Categories
 * - `coordinator` - AsyncCoordinator operations
 * - `bridge` - ReactFlow/ELK bridge operations
 * - `op` - General operations (VisualizationState, etc.)
 * - `layout` - Layout calculations
 * - `interaction` - User interactions
 * - `debug` - General debugging
 * - And more (see HydroLogCategory type)
 *
 * In production builds, all logs are suppressed unless explicitly enabled.
 * This provides a clean, quiet experience for end users while allowing
 * developers to enable specific diagnostic categories when needed.
 */
export type HydroLogCategory =
  | "layout"
  | "lock"
  | "op"
  | "retry"
  | "toggle"
  | "fit"
  | "metrics"
  | "ro"
  | "orchestrator"
  | "pack"
  | "bridge"
  | "coordinator"
  | "interaction"
  | "validation"
  | "performance"
  | "panel"
  | "search"
  | "container"
  | "style"
  | "debug";

function getEnabled(): Set<string> {
  if (typeof window !== "undefined" && (window as any).__HYDRO_LOGS) {
    return new Set(
      String((window as any).__HYDRO_LOGS)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
  if (typeof process !== "undefined" && process.env.HYDRO_LOGS) {
    return new Set(
      process.env.HYDRO_LOGS.split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
  // In production, default to empty set (no logs)
  // In development/test, allow specific categories
  if (
    typeof process !== "undefined" &&
    process.env.NODE_ENV === "development"
  ) {
    return new Set(["error"]); // Only show errors by default in dev
  }
  return new Set();
}

let enabled = getEnabled();

export function refreshLoggerConfig() {
  enabled = getEnabled();
}

function base(
  category: HydroLogCategory,
  level: "log" | "warn" | "error" | "info",
  args: any[],
) {
  if (!enabled.has(category)) return;

  (console as any)[level](`[${category}]`, ...args);
}

export const hscopeLogger = {
  log: (cat: HydroLogCategory, ...args: any[]) => base(cat, "log", args),
  info: (cat: HydroLogCategory, ...args: any[]) => base(cat, "info", args),
  warn: (cat: HydroLogCategory, ...args: any[]) => base(cat, "warn", args),
  error: (cat: HydroLogCategory, ...args: any[]) => base(cat, "error", args),
};

// Developer-friendly browser hooks
// These globals make it easy to enable logging from the DevTools console without code changes.
if (typeof window !== "undefined") {
  // Refresh function hook (advanced)
  (window as any).__HYDRO_REFRESH_LOGGER = refreshLoggerConfig;

  // Simple helper: enable categories and refresh in one call
  (window as any).hydroEnableLogs = (categories: string | string[]) => {
    const cats = Array.isArray(categories)
      ? categories.join(",")
      : String(categories || "");
    (window as any).__HYDRO_LOGS = cats;
    try {
      refreshLoggerConfig();
      // Provide immediate feedback in console
      console.warn(
        "[hydroscope] Logging enabled for categories:",
        cats || "<none>",
      );
    } catch (e) {
      console.warn("[hydroscope] Failed to refresh logger config:", e);
    }
  };

  // Helper to inspect currently enabled categories
  (window as any).hydroShowLogCategories = () => {
    // We can't access the internal Set directly in a type-safe way; re-evaluate via refresh
    try {
      refreshLoggerConfig();
    } catch {}
    // Re-run detection similar to getEnabled()
    const current = (window as any).__HYDRO_LOGS
      ? String((window as any).__HYDRO_LOGS)
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];
    console.warn("[hydroscope] Current __HYDRO_LOGS:", current);
    return current;
  };
}
