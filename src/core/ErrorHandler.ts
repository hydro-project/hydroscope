/**
 * ErrorHandler - Comprehensive error handling and recovery for search and navigation
 * Handles graceful degradation, fallback highlighting, timeouts, and user feedback
 */

import type { VisualizationState } from "./VisualizationState.js";
import type { SearchResult } from "../types/core.js";

export interface ErrorHandlerOptions {
  timeout?: number;
  maxRetries?: number;
  enableFallbacks?: boolean;
  enableUserFeedback?: boolean;
}

export interface OperationError {
  type: 'timeout' | 'expansion_failure' | 'highlighting_failure' | 'navigation_failure' | 'search_failure';
  message: string;
  originalError?: Error;
  context?: Record<string, any>;
  timestamp: number;
  retryable: boolean;
}

export interface ErrorRecoveryResult {
  success: boolean;
  fallbackApplied: boolean;
  userFeedbackShown: boolean;
  error?: OperationError;
}

export interface UserFeedbackOptions {
  message: string;
  type: 'error' | 'warning' | 'info';
  retryAction?: () => Promise<void>;
  dismissible?: boolean;
  duration?: number; // Auto-dismiss after duration (ms)
}

export class SearchNavigationErrorHandler {
  private errorHistory: OperationError[] = [];
  private maxErrorHistory = 100;
  private userFeedbackCallbacks: ((feedback: UserFeedbackOptions) => void)[] = [];
  private fallbackState = new Map<string, any>();

  constructor(private options: ErrorHandlerOptions = {}) {
    this.options = {
      timeout: 10000, // 10 seconds default
      maxRetries: 2,
      enableFallbacks: true,
      enableUserFeedback: true,
      ...options,
    };
  }

  /**
   * Register callback for user feedback display
   */
  onUserFeedback(callback: (feedback: UserFeedbackOptions) => void): void {
    this.userFeedbackCallbacks.push(callback);
  }

  /**
   * Remove user feedback callback
   */
  offUserFeedback(callback: (feedback: UserFeedbackOptions) => void): void {
    const index = this.userFeedbackCallbacks.indexOf(callback);
    if (index > -1) {
      this.userFeedbackCallbacks.splice(index, 1);
    }
  }

  /**
   * Handle container expansion failures with graceful degradation
   */
  async handleContainerExpansionFailure(
    containerIds: string[],
    state: VisualizationState,
    originalError: Error,
    context?: Record<string, any>
  ): Promise<ErrorRecoveryResult> {
    const error: OperationError = {
      type: 'expansion_failure',
      message: `Failed to expand containers: ${containerIds.join(', ')}`,
      originalError,
      context: { containerIds, ...context },
      timestamp: Date.now(),
      retryable: true,
    };

    this.recordError(error);

    console.warn(`[ErrorHandler] Container expansion failed for ${containerIds.length} containers:`, originalError);

    let fallbackApplied = false;
    let userFeedbackShown = false;

    if (this.options.enableFallbacks) {
      // Fallback 1: Try expanding containers individually
      const successfulExpansions: string[] = [];
      const failedExpansions: string[] = [];

      for (const containerId of containerIds) {
        try {
          // Try individual expansion synchronously (respecting core architecture)
          if (state.expandTreeNodes) {
            state.expandTreeNodes([containerId]);
            successfulExpansions.push(containerId);
          } else {
            failedExpansions.push(containerId);
            console.warn(`[ErrorHandler] expandTreeNodes method not available for ${containerId}`);
          }
        } catch (individualError) {
          failedExpansions.push(containerId);
          console.warn(`[ErrorHandler] Individual expansion failed for ${containerId}:`, individualError);
        }
      }

      if (successfulExpansions.length > 0) {
        fallbackApplied = true;
        console.log(`[ErrorHandler] Partial expansion recovery: ${successfulExpansions.length}/${containerIds.length} containers expanded`);
        
        // Store fallback state for potential retry
        this.fallbackState.set('partial_expansion', {
          successful: successfulExpansions,
          failed: failedExpansions,
          timestamp: Date.now(),
        });
      }

      // Fallback 2: Highlight containers that couldn't be expanded
      if (failedExpansions.length > 0) {
        try {
          this.applyFallbackHighlighting(failedExpansions, state, 'expansion_failed');
          fallbackApplied = true;
        } catch (highlightError) {
          console.error(`[ErrorHandler] Fallback highlighting failed:`, highlightError);
        }
      }
    }

    // Show user feedback if enabled
    if (this.options.enableUserFeedback) {
      const partialSuccess = fallbackApplied && this.fallbackState.has('partial_expansion');
      const feedback: UserFeedbackOptions = {
        message: partialSuccess 
          ? `Some containers couldn't be expanded. ${this.fallbackState.get('partial_expansion').successful.length} of ${containerIds.length} expanded successfully.`
          : `Failed to expand containers. ${containerIds.length} containers affected.`,
        type: partialSuccess ? 'warning' : 'error',
        retryAction: async () => {
          const failedIds = partialSuccess 
            ? this.fallbackState.get('partial_expansion').failed 
            : containerIds;
          await this.retryContainerExpansion(failedIds, state);
        },
        dismissible: true,
        duration: partialSuccess ? 5000 : undefined, // Auto-dismiss warnings
      };

      this.showUserFeedback(feedback);
      userFeedbackShown = true;
    }

    return {
      success: fallbackApplied,
      fallbackApplied,
      userFeedbackShown,
      error: fallbackApplied ? undefined : error,
    };
  }

  /**
   * Handle highlighting failures with fallback highlighting
   */
  async handleHighlightingFailure(
    elementIds: string[],
    highlightType: 'search' | 'navigation',
    state: VisualizationState,
    originalError: Error,
    context?: Record<string, any>
  ): Promise<ErrorRecoveryResult> {
    const error: OperationError = {
      type: 'highlighting_failure',
      message: `Failed to apply ${highlightType} highlighting to ${elementIds.length} elements`,
      originalError,
      context: { elementIds, highlightType, ...context },
      timestamp: Date.now(),
      retryable: true,
    };

    this.recordError(error);

    console.warn(`[ErrorHandler] ${highlightType} highlighting failed for ${elementIds.length} elements:`, originalError);

    let fallbackApplied = false;
    let userFeedbackShown = false;

    if (this.options.enableFallbacks) {
      try {
        // Fallback: Apply basic highlighting without advanced features
        this.applyFallbackHighlighting(elementIds, state, highlightType);
        fallbackApplied = true;
        console.log(`[ErrorHandler] Applied fallback highlighting for ${elementIds.length} elements`);
      } catch (fallbackError) {
        console.error(`[ErrorHandler] Fallback highlighting also failed:`, fallbackError);
      }
    }

    // Show user feedback for highlighting failures only if fallback also failed
    if (this.options.enableUserFeedback && !fallbackApplied) {
      const feedback: UserFeedbackOptions = {
        message: `Unable to highlight ${highlightType} results. Visual feedback may be limited.`,
        type: 'warning',
        dismissible: true,
        duration: 3000, // Auto-dismiss after 3 seconds
      };

      this.showUserFeedback(feedback);
      userFeedbackShown = true;
    }

    return {
      success: fallbackApplied,
      fallbackApplied,
      userFeedbackShown,
      error: fallbackApplied ? undefined : error,
    };
  }

  /**
   * Handle search operation failures
   */
  async handleSearchFailure(
    query: string,
    state: VisualizationState,
    originalError: Error,
    context?: Record<string, any>
  ): Promise<ErrorRecoveryResult> {
    const error: OperationError = {
      type: 'search_failure',
      message: `Search operation failed for query: "${query}"`,
      originalError,
      context: { query, ...context },
      timestamp: Date.now(),
      retryable: true,
    };

    this.recordError(error);

    console.warn(`[ErrorHandler] Search failed for query "${query}":`, originalError);

    let fallbackApplied = false;
    let userFeedbackShown = false;

    if (this.options.enableFallbacks) {
      try {
        // Fallback: Simple substring search without advanced features
        const fallbackResults = this.performFallbackSearch(query, state);
        if (fallbackResults.length > 0) {
          // Apply basic highlighting to fallback results
          const elementIds = fallbackResults.map(r => r.id);
          this.applyFallbackHighlighting(elementIds, state, 'search');
          fallbackApplied = true;
          console.log(`[ErrorHandler] Fallback search found ${fallbackResults.length} results`);
        }
      } catch (fallbackError) {
        console.error(`[ErrorHandler] Fallback search also failed:`, fallbackError);
      }
    }

    // Show user feedback
    if (this.options.enableUserFeedback) {
      const feedback: UserFeedbackOptions = {
        message: fallbackApplied 
          ? `Search completed with limited functionality. Some features may not be available.`
          : `Search failed for "${query}". Please try a different search term.`,
        type: fallbackApplied ? 'warning' : 'error',
        retryAction: async () => {
          await this.retrySearch(query, state);
        },
        dismissible: true,
        duration: fallbackApplied ? 4000 : undefined,
      };

      this.showUserFeedback(feedback);
      userFeedbackShown = true;
    }

    return {
      success: fallbackApplied,
      fallbackApplied,
      userFeedbackShown,
      error: fallbackApplied ? undefined : error,
    };
  }

  /**
   * Handle navigation operation failures
   */
  async handleNavigationFailure(
    elementId: string,
    state: VisualizationState,
    originalError: Error,
    context?: Record<string, any>
  ): Promise<ErrorRecoveryResult> {
    const error: OperationError = {
      type: 'navigation_failure',
      message: `Navigation failed for element: ${elementId}`,
      originalError,
      context: { elementId, ...context },
      timestamp: Date.now(),
      retryable: true,
    };

    this.recordError(error);

    console.warn(`[ErrorHandler] Navigation failed for element ${elementId}:`, originalError);

    let fallbackApplied = false;
    let userFeedbackShown = false;

    if (this.options.enableFallbacks) {
      try {
        // Fallback: Apply highlighting without viewport changes
        this.applyFallbackHighlighting([elementId], state, 'navigation');
        fallbackApplied = true;
        console.log(`[ErrorHandler] Applied fallback navigation highlighting for ${elementId}`);
      } catch (fallbackError) {
        console.error(`[ErrorHandler] Fallback navigation highlighting failed:`, fallbackError);
      }
    }

    // Show user feedback
    if (this.options.enableUserFeedback) {
      const feedback: UserFeedbackOptions = {
        message: fallbackApplied 
          ? `Navigation completed with limited functionality. Viewport may not have updated.`
          : `Unable to navigate to the selected item. Please try again.`,
        type: fallbackApplied ? 'warning' : 'error',
        retryAction: async () => {
          await this.retryNavigation(elementId, state);
        },
        dismissible: true,
        duration: fallbackApplied ? 3000 : undefined,
      };

      this.showUserFeedback(feedback);
      userFeedbackShown = true;
    }

    return {
      success: fallbackApplied,
      fallbackApplied,
      userFeedbackShown,
      error: fallbackApplied ? undefined : error,
    };
  }

  /**
   * Handle timeout errors for any operation
   */
  async handleTimeout(
    operationType: string,
    timeoutMs: number,
    context?: Record<string, any>
  ): Promise<ErrorRecoveryResult> {
    const error: OperationError = {
      type: 'timeout',
      message: `Operation "${operationType}" timed out after ${timeoutMs}ms`,
      context: { operationType, timeoutMs, ...context },
      timestamp: Date.now(),
      retryable: true,
    };

    this.recordError(error);

    console.warn(`[ErrorHandler] Operation "${operationType}" timed out after ${timeoutMs}ms`);

    let userFeedbackShown = false;

    // Show user feedback for timeouts
    if (this.options.enableUserFeedback) {
      const feedback: UserFeedbackOptions = {
        message: `Operation timed out. The system may be under heavy load.`,
        type: 'warning',
        retryAction: async () => {
          // Retry with longer timeout
          console.log(`[ErrorHandler] Retrying ${operationType} with extended timeout`);
        },
        dismissible: true,
        duration: 5000,
      };

      this.showUserFeedback(feedback);
      userFeedbackShown = true;
    }

    return {
      success: false,
      fallbackApplied: false,
      userFeedbackShown,
      error,
    };
  }

  /**
   * Execute operation with timeout handling
   */
  async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number = this.options.timeout!
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Apply fallback highlighting with basic styles
   */
  private applyFallbackHighlighting(
    elementIds: string[],
    state: VisualizationState,
    highlightType: 'search' | 'navigation' | 'expansion_failed'
  ): void {
    console.log(`[ErrorHandler] Applying fallback highlighting for ${elementIds.length} elements (${highlightType})`);

    // Store fallback highlighting state
    const fallbackKey = `fallback_${highlightType}_${Date.now()}`;
    this.fallbackState.set(fallbackKey, {
      elementIds,
      highlightType,
      timestamp: Date.now(),
    });

    // Apply basic highlighting through state
    switch (highlightType) {
      case 'search':
        for (const elementId of elementIds) {
          state.searchNavigationState.treeSearchHighlights.add(elementId);
          state.searchNavigationState.graphSearchHighlights.add(elementId);
        }
        break;
      case 'navigation':
        for (const elementId of elementIds) {
          state.searchNavigationState.treeNavigationHighlights.add(elementId);
          state.searchNavigationState.graphNavigationHighlights.add(elementId);
        }
        break;
      case 'expansion_failed':
        // Add visual indicator for failed expansions
        for (const elementId of elementIds) {
          state.searchNavigationState.treeSearchHighlights.add(elementId);
        }
        break;
    }
  }

  /**
   * Perform fallback search with simple substring matching
   */
  private performFallbackSearch(query: string, state: VisualizationState): SearchResult[] {
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    // Search visible nodes
    for (const node of state.visibleNodes) {
      if (node.label.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: node.id,
          type: 'node',
          label: node.label,
          matchIndices: [[node.label.toLowerCase().indexOf(lowerQuery), lowerQuery.length]],
          hierarchyPath: [], // Simplified - no hierarchy path in fallback
        });
      }
    }

    // Search visible containers
    for (const container of state.visibleContainers) {
      if (container.label.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: container.id,
          type: 'container',
          label: container.label,
          matchIndices: [[container.label.toLowerCase().indexOf(lowerQuery), lowerQuery.length]],
          hierarchyPath: [], // Simplified - no hierarchy path in fallback
        });
      }
    }

    return results;
  }

  /**
   * Retry container expansion with error handling
   */
  private async retryContainerExpansion(containerIds: string[], state: VisualizationState): Promise<void> {
    try {
      console.log(`[ErrorHandler] Retrying expansion for ${containerIds.length} containers`);
      
      // Retry synchronously (respecting core architecture)
      if (state.expandTreeNodes) {
        state.expandTreeNodes(containerIds);
        console.log(`[ErrorHandler] Retry successful for container expansion`);
        
        // Clear fallback state on successful retry
        this.fallbackState.delete('partial_expansion');
      } else {
        throw new Error('expandTreeNodes method not available');
      }
    } catch (retryError) {
      console.error(`[ErrorHandler] Retry failed for container expansion:`, retryError);
      await this.handleContainerExpansionFailure(containerIds, state, retryError as Error, { isRetry: true });
    }
  }

  /**
   * Retry search operation with error handling
   */
  private async retrySearch(query: string, state: VisualizationState): Promise<void> {
    try {
      console.log(`[ErrorHandler] Retrying search for query: "${query}"`);
      
      // Retry synchronously (respecting core architecture)
      if (state.performSearch) {
        const results = state.performSearch(query);
        console.log(`[ErrorHandler] Retry successful for search, found ${results.length} results`);
      } else {
        throw new Error('performSearch method not available');
      }
    } catch (retryError) {
      console.error(`[ErrorHandler] Retry failed for search:`, retryError);
      await this.handleSearchFailure(query, state, retryError as Error, { isRetry: true });
    }
  }

  /**
   * Retry navigation operation with error handling
   */
  private async retryNavigation(elementId: string, state: VisualizationState): Promise<void> {
    try {
      console.log(`[ErrorHandler] Retrying navigation for element: ${elementId}`);
      
      // Retry synchronously (respecting core architecture)
      if (state.navigateToElement) {
        state.navigateToElement(elementId);
        console.log(`[ErrorHandler] Retry successful for navigation`);
      } else {
        throw new Error('navigateToElement method not available');
      }
    } catch (retryError) {
      console.error(`[ErrorHandler] Retry failed for navigation:`, retryError);
      await this.handleNavigationFailure(elementId, state, retryError as Error, { isRetry: true });
    }
  }

  /**
   * Show user feedback through registered callbacks
   */
  private showUserFeedback(feedback: UserFeedbackOptions): void {
    for (const callback of this.userFeedbackCallbacks) {
      try {
        callback(feedback);
      } catch (error) {
        console.error(`[ErrorHandler] User feedback callback failed:`, error);
      }
    }
  }

  /**
   * Record error in history
   */
  private recordError(error: OperationError): void {
    this.errorHistory.push(error);
    
    // Limit error history size
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory.shift();
    }

    console.error(`[ErrorHandler] Recorded error:`, error);
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: OperationError[];
    errorRate: number; // errors per minute
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentErrors = this.errorHistory.filter(e => e.timestamp > oneMinuteAgo);
    
    const errorsByType: Record<string, number> = {};
    for (const error of this.errorHistory) {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
    }

    return {
      totalErrors: this.errorHistory.length,
      errorsByType,
      recentErrors: recentErrors.slice(-10), // Last 10 recent errors
      errorRate: recentErrors.length, // errors in last minute
    };
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
    this.fallbackState.clear();
  }

  /**
   * Check if system is experiencing high error rate
   */
  isHighErrorRate(): boolean {
    const stats = this.getErrorStatistics();
    return stats.errorRate > 5; // More than 5 errors per minute
  }

  /**
   * Get recovery suggestions based on error patterns
   */
  getRecoverySuggestions(): string[] {
    const stats = this.getErrorStatistics();
    const suggestions: string[] = [];

    if (stats.errorsByType.timeout > 3) {
      suggestions.push("System may be under heavy load. Try reducing the number of simultaneous operations.");
    }

    if (stats.errorsByType.expansion_failure > 2) {
      suggestions.push("Container expansion issues detected. Try expanding containers individually.");
    }

    if (stats.errorsByType.highlighting_failure > 2) {
      suggestions.push("Highlighting issues detected. Visual feedback may be limited.");
    }

    if (stats.errorRate > 10) {
      suggestions.push("High error rate detected. Consider refreshing the page or reducing system load.");
    }

    return suggestions;
  }
}

// Export singleton instance
export const searchNavigationErrorHandler = new SearchNavigationErrorHandler();