/**
 * @fileoverview Theme Configuration
 *
 * Dark mode detection and theme-aware styling system.
 */

export type ThemeMode = "light" | "dark";

// Cache for theme detection result
let cachedDarkMode: boolean | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 100; // Cache for 100ms to avoid repeated checks in same render cycle

// Cache for luminance calculation to avoid redundant RGB parsing
let cachedLuminance: number | null = null;
let cachedBackgroundColor: string | null = null;

/**
 * Detect if the user prefers dark mode (with caching)
 */
export function detectDarkMode(): boolean {
  // Return cached result if still valid
  const now = Date.now();
  if (cachedDarkMode !== null && now - cacheTimestamp < CACHE_DURATION) {
    return cachedDarkMode;
  }

  // Perform actual detection
  const result = detectDarkModeUncached();

  // Update cache
  cachedDarkMode = result;
  cacheTimestamp = now;

  return result;
}

/**
 * Internal: Detect dark mode without caching
 */
function detectDarkModeUncached(): boolean {
  if (typeof window === "undefined") return false;

  // In test environments (jsdom), force light mode for deterministic results
  // to avoid relying on missing VS Code classes or computed styles.
  try {
    // Check for test environment (jsdom, etc.)
    if (
      typeof globalThis.process !== "undefined" &&
      globalThis.process?.env?.NODE_ENV === "test"
    ) {
      return false;
    }
  } catch (error) {
    // In development, log the error for debugging
    if (
      typeof process !== "undefined" &&
      process.env?.NODE_ENV === "development"
    ) {
      console.warn("[Hydroscope] Theme detection test check failed:", error);
    }
  }

  // Check for VS Code webview theme (takes precedence)
  if (
    document.body.classList.contains("vscode-dark") ||
    document.body.classList.contains("vscode-high-contrast")
  ) {
    return true;
  }
  if (document.body.classList.contains("vscode-light")) {
    return false;
  }

  // Heuristic: infer from computed background luminance when classes aren't ready yet
  // This helps on first render when VS Code hasn't applied body classes to the webview.
  const luminance = getBackgroundLuminance();
  if (luminance !== null) {
    // Threshold tuned to VS Code webview dark backgrounds
    return luminance < 128;
  }

  // Fallback to browser preference
  if (!window.matchMedia) return false; // For test environments

  try {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    return mediaQuery?.matches ?? false;
  } catch (error) {
    // In development, log the error for debugging
    if (
      typeof process !== "undefined" &&
      process.env?.NODE_ENV === "development"
    ) {
      console.warn("[Hydroscope] matchMedia detection failed:", error);
    }
    return false; // Fallback for environments without matchMedia support
  }
}

/**
 * Calculate luminance from document body background color with caching
 * @returns Luminance value (0-255) or null if calculation fails
 */
function getBackgroundLuminance(): number | null {
  try {
    const bg = getComputedStyle(document.body).backgroundColor;
    if (!bg) return null;

    // Check if we have a cached result for this background color
    if (cachedBackgroundColor === bg && cachedLuminance !== null) {
      return cachedLuminance;
    }

    // Parse RGB values
    const m = bg.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!m) return null;

    const r = parseInt(m[1], 10);
    const g = parseInt(m[2], 10);
    const b = parseInt(m[3], 10);

    // Perceived luminance approximation
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    if (Number.isNaN(luminance)) return null;

    // Cache the result
    cachedBackgroundColor = bg;
    cachedLuminance = luminance;

    return luminance;
  } catch (error) {
    // In development, log the error for debugging
    if (
      typeof process !== "undefined" &&
      process.env?.NODE_ENV === "development"
    ) {
      console.warn("[Hydroscope] Theme luminance detection failed:", error);
    }
    return null;
  }
}

/**
 * Listen for theme changes
 */
export function onThemeChange(callback: (isDark: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const cleanupFunctions: Array<() => void> = [];

  // Listen for VS Code theme changes via MutationObserver
  try {
    const observer = new MutationObserver(() => {
      // Invalidate cache when theme changes
      cachedDarkMode = null;
      callback(detectDarkMode());
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    cleanupFunctions.push(() => observer.disconnect());
  } catch (error) {
    // In development, log the error for debugging
    if (
      typeof process !== "undefined" &&
      process.env?.NODE_ENV === "development"
    ) {
      console.warn("[Hydroscope] MutationObserver setup failed:", error);
    }
  }

  // Also listen for browser preference changes
  if (window.matchMedia) {
    try {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      if (mediaQuery) {
        const handler = (e: MediaQueryListEvent) => {
          // Invalidate cache when theme changes
          cachedDarkMode = null;
          callback(e.matches);
        };

        // Modern browsers
        if (mediaQuery.addEventListener) {
          mediaQuery.addEventListener("change", handler);
          cleanupFunctions.push(() =>
            mediaQuery.removeEventListener("change", handler),
          );
        }
        // Legacy browsers
        else if (mediaQuery.addListener) {
          mediaQuery.addListener(handler);
          cleanupFunctions.push(() => mediaQuery.removeListener?.(handler));
        }
      }
    } catch (error) {
      // In development, log the error for debugging
      if (
        typeof process !== "undefined" &&
        process.env?.NODE_ENV === "development"
      ) {
        console.warn("[Hydroscope] matchMedia listener setup failed:", error);
      }
    }
  }

  // Return cleanup function that calls all cleanup functions
  return () => {
    cleanupFunctions.forEach((cleanup) => cleanup());
  };
}

/**
 * Theme-aware colors for UI components
 */
export const THEME_COLORS = {
  light: {
    // Panel backgrounds
    panelBackground: "#ffffff",
    panelBorder: "#eeeeee",
    panelShadow: "rgba(0, 0, 0, 0.18)",

    // Text colors
    textPrimary: "#222222",
    textSecondary: "#718096",
    textMuted: "#a0aec0",

    // Input controls
    inputBackground: "#ffffff",
    inputBorder: "#ced4da",
    inputText: "#222222",
    inputPlaceholder: "#a0aec0",

    // Buttons
    buttonBackground: "rgba(59, 130, 246, 0.1)",
    buttonBorder: "#3b82f6",
    buttonText: "#222222",
    buttonHoverBackground: "rgba(59, 130, 246, 0.18)",
    buttonHoverBorder: "#2563eb",

    // File upload
    uploadAreaBackground: "#f7fafc",
    uploadAreaBorder: "#cbd5e0",
    uploadAreaHoverBackground: "#ebf8ff",
    uploadAreaHoverBorder: "#4299e1",
    uploadAreaDragBackground: "#bee3f8",
    uploadAreaDragBorder: "#3182ce",

    // Status messages
    errorBackground: "#fed7d7",
    errorBorder: "#feb2b2",
    errorText: "#c53030",
    successBackground: "#c6f6d5",
    successBorder: "#9ae6b4",
    successText: "#22543d",

    // File path display
    filePathBackground: "#f7fafc",
    filePathBorder: "#e2e8f0",
    filePathCodeBackground: "#e8f5e8",
    filePathCodeBorder: "#c8e6c9",
    filePathCodeText: "#2e7d32",

    // Dividers
    dividerColor: "#e2e8f0",

    // Collapsible sections
    sectionHeaderBackground: "transparent",
    sectionHeaderHoverBackground: "#f7fafc",
  },
  dark: {
    // Panel backgrounds
    panelBackground: "#1e1e1e",
    panelBorder: "#3a3a3a",
    panelShadow: "rgba(0, 0, 0, 0.5)",

    // Text colors
    textPrimary: "#e0e0e0",
    textSecondary: "#b8b8b8",
    textMuted: "#8a8a8a",

    // Input controls
    inputBackground: "#2a2a2a",
    inputBorder: "#4a4a4a",
    inputText: "#e0e0e0",
    inputPlaceholder: "#707070",

    // Buttons
    buttonBackground: "rgba(96, 165, 250, 0.15)",
    buttonBorder: "#60a5fa",
    buttonText: "#e0e0e0",
    buttonHoverBackground: "rgba(96, 165, 250, 0.25)",
    buttonHoverBorder: "#3b82f6",

    // File upload
    uploadAreaBackground: "#2a2a2a",
    uploadAreaBorder: "#4a4a4a",
    uploadAreaHoverBackground: "#1e3a5f",
    uploadAreaHoverBorder: "#60a5fa",
    uploadAreaDragBackground: "#2563eb33",
    uploadAreaDragBorder: "#60a5fa",

    // Status messages
    errorBackground: "#4a1f1f",
    errorBorder: "#7a2f2f",
    errorText: "#ff8a8a",
    successBackground: "#1f4a2f",
    successBorder: "#2f7a4f",
    successText: "#8affaa",

    // File path display
    filePathBackground: "#2a2a2a",
    filePathBorder: "#4a4a4a",
    filePathCodeBackground: "#1f3a1f",
    filePathCodeBorder: "#3a5a3a",
    filePathCodeText: "#8affaa",

    // Dividers
    dividerColor: "#3a3a3a",

    // Collapsible sections
    sectionHeaderBackground: "transparent",
    sectionHeaderHoverBackground: "#2a2a2a",
  },
} as const;

/**
 * Get theme colors based on current mode
 */
export function getThemeColors(isDark: boolean) {
  return isDark ? THEME_COLORS.dark : THEME_COLORS.light;
}

// Semantic edge color tokens
export type EdgeColorToken =
  | "default"
  | "muted"
  | "light"
  | "highlight-1"
  | "highlight-2"
  | "highlight-3"
  | "success"
  | "warning"
  | "danger";

// Token palette for edges; chosen for good contrast in both light and dark themes.
// Note: These are UI defaults; renderers may choose to theme-map these later.
const EDGE_COLOR_TOKEN_MAP = {
  light: {
    default: "#4b5563", // slate-600
    muted: "#9ca3af", // gray-400
    light: "#93c5fd", // sky-300
    "highlight-1": "#2563eb", // blue-600
    "highlight-2": "#10b981", // emerald-500
    "highlight-3": "#f59e0b", // amber-500
    success: "#16a34a", // green-600
    warning: "#d97706", // amber-600
    danger: "#dc2626", // red-600
  },
  dark: {
    // Increase contrast for edge strokes against dark background
    default: "#cbd5e1", // slate-300 (brighter for readability)
    muted: "#94a3b8", // slate-400 (kept slightly dimmer than default)
    light: "#bfdbfe", // sky-200
    "highlight-1": "#93c5fd", // sky-300
    "highlight-2": "#34d399", // emerald-400
    "highlight-3": "#fbbf24", // amber-400
    success: "#4ade80", // green-400 (brighter)
    warning: "#fbbf24", // amber-400 (brighter)
    danger: "#fca5a5", // red-300/400 (brighter)
  },
} as const;

/**
 * Map a semantic edge color token to a concrete hex color.
 * Currently uses a static palette that works in both themes; if runtime theme is available,
 * pass isDark=true for dark mapping.
 */
export function getEdgeColorForToken(
  token: EdgeColorToken,
  isDark: boolean = false,
): string {
  const palette = isDark
    ? EDGE_COLOR_TOKEN_MAP.dark
    : EDGE_COLOR_TOKEN_MAP.light;
  return palette[token] ?? palette["default"];
}
