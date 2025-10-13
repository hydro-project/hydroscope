/**
 * Utility functions for handling autoFit behavior consistently across the application
 */

export interface AutoFitOptions {
  /** Whether autoFit is enabled globally */
  autoFitEnabled: boolean;
  /** Force fitView regardless of autoFit setting (for critical operations like initial load) */
  force?: boolean;
  /** Custom fitView options */
  fitViewOptions?: {
    padding?: number;
    duration?: number;
  };
}

/**
 * Determines whether fitView should be executed based on autoFit settings
 * 
 * @param options - AutoFit configuration options
 * @returns Whether fitView should be executed
 */
export function shouldExecuteFitView(options: AutoFitOptions): boolean {
  // Force fitView if explicitly requested (e.g., initial load, layout algorithm changes)
  if (options.force) {
    return true;
  }
  
  // Otherwise, respect the autoFit setting
  return options.autoFitEnabled;
}

/**
 * Creates fitView options for AsyncCoordinator operations
 * 
 * @param options - AutoFit configuration options
 * @returns Object with fitView and fitViewOptions for AsyncCoordinator
 */
export function createFitViewOptions(options: AutoFitOptions): {
  fitView: boolean;
  fitViewOptions?: { padding?: number; duration?: number };
} {
  return {
    fitView: shouldExecuteFitView(options),
    fitViewOptions: options.fitViewOptions,
  };
}

/**
 * Common scenarios for autoFit behavior
 */
export const AutoFitScenarios = {
  /** Initial data load - should always fit regardless of setting */
  INITIAL_LOAD: { force: true },
  
  /** File load - should always fit regardless of setting */
  FILE_LOAD: { force: true },
  
  /** Layout algorithm change - should always fit regardless of setting */
  LAYOUT_ALGORITHM_CHANGE: { force: true },
  
  /** Style changes (edge style, colors, etc.) - should respect autoFit setting */
  STYLE_CHANGE: { force: false },
  
  /** Container operations - should respect autoFit setting */
  CONTAINER_OPERATION: { force: false },
  
  /** Search operations - should respect autoFit setting */
  SEARCH_OPERATION: { force: false },
} as const;

/**
 * Helper function to create autoFit options for common scenarios
 * 
 * @param scenario - The scenario type
 * @param autoFitEnabled - Whether autoFit is globally enabled
 * @param customOptions - Custom fitView options
 * @returns Complete AutoFit options
 */
export function createAutoFitOptions(
  scenario: typeof AutoFitScenarios[keyof typeof AutoFitScenarios],
  autoFitEnabled: boolean,
  customOptions?: { padding?: number; duration?: number }
): AutoFitOptions {
  return {
    autoFitEnabled,
    force: scenario.force,
    fitViewOptions: customOptions,
  };
}