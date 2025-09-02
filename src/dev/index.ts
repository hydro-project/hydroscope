/**
 * @fileoverview Development and debugging utilities
 *
 * This module contains performance profilers, debugging tools, and development-only
 * components that should not be included in production builds.
 */

// Performance profiling utilities
export { PerformanceProfiler } from './profiling/PerformanceProfiler';
export { ExpandAllProfiler } from './profiling/ExpandAllProfiler';
export { PaxosPerformanceAnalyzer } from './profiling/PaxosPerformanceAnalyzer';

// Performance testing utilities
export * from './profiling/performanceTests';

// Dev-only UI components
export { default as PerformanceDashboard } from './components/PerformanceDashboard';

// Environment check utility
export const isDevelopment = () => {
  // Check Node.js environment variables
  if (typeof process !== 'undefined' && process.env) {
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.REACT_APP_ENABLE_PROFILING === 'true'
    ) {
      return true;
    }
  }

  // Check browser URL parameters (only if window is available)
  if (typeof window !== 'undefined' && window.location) {
    return window.location.search.includes('debug=true');
  }

  return false;
};

// Conditional profiler accessor - returns null in production
export const getProfiler = () => {
  if (!isDevelopment()) {
    return null;
  }
  try {
    const { PerformanceProfiler } = require('./profiling/PerformanceProfiler');
    return PerformanceProfiler.getInstance();
  } catch (error) {
    console.warn('Profiler not available:', error);
    return null;
  }
};

// Conditional expand all profiler accessor
export const getExpandAllProfiler = () => {
  if (!isDevelopment()) {
    return null;
  }
  try {
    const { ExpandAllProfiler } = require('./profiling/ExpandAllProfiler');
    return ExpandAllProfiler.getInstance();
  } catch (error) {
    console.warn('ExpandAllProfiler not available:', error);
    return null;
  }
};
