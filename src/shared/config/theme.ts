/**
 * @fileoverview Theme Configuration
 *
 * Dark mode detection and theme-aware styling system.
 */

export type ThemeMode = "light" | "dark";

/**
 * Detect if the user prefers dark mode
 */
export function detectDarkMode(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.matchMedia) return false; // For test environments

  try {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    return mediaQuery?.matches ?? false;
  } catch {
    return false; // Fallback for environments without matchMedia support
  }
}

/**
 * Listen for theme changes
 */
export function onThemeChange(callback: (isDark: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  if (!window.matchMedia) return () => {}; // For test environments

  try {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    if (!mediaQuery) return () => {};

    const handler = (e: MediaQueryListEvent) => callback(e.matches);

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }

    // Legacy browsers
    if (mediaQuery.addListener) {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener?.(handler);
    }

    return () => {};
  } catch {
    return () => {}; // Fallback for environments without matchMedia support
  }
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
    textSecondary: "#a0a0a0",
    textMuted: "#707070",

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
