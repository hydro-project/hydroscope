/**
 * @fileoverview Theme Hook
 *
 * React hook for detecting and responding to dark mode changes.
 */

import { useState, useEffect } from "react";
import {
  detectDarkMode,
  onThemeChange,
  getThemeColors,
} from "../shared/config/theme.js";

export function useTheme() {
  const [isDark, setIsDark] = useState(() => detectDarkMode());

  useEffect(() => {
    // Listen for changes
    const cleanup = onThemeChange(setIsDark);
    return cleanup;
  }, []);

  return {
    isDark,
    colors: getThemeColors(isDark),
  };
}
