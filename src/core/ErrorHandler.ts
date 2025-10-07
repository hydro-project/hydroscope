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
  type:
    | "timeout"
    | "expansion_failure"
    | "highlighting_failure"
    | "navigation_failure"
    | "search_failure"
    | "edge_validation_failure"
    | "edge_restoration_failure"
    | "container_expansion_validation_failure"
    | "post_expansion_validation_failure"
    | "edge_aggregation_failure";
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
  type: "error" | "warning" | "info";
  retryAction?: () => Promise<void>;
  dismissible?: boolean;
  duration?: number; // Auto-dismiss after duration (ms)
}

// ENHANCEMENT: Specific error types for edge validation scenarios
export interface EdgeValidationError extends OperationError {
  type: "edge_validation_failure";
  edgeId: string;
  validationFailures: Array<{
    reason: string;
    severity: "critical" | "warning" | "info";
    suggestedFix?: string;
  }>;
  sourceExists: boolean;
  targetExists: boolean;
  crossHierarchy: boolean;
}

export interface EdgeRestorationError extends OperationError {
  type: "edge_restoration_failure";
  containerId: string;
  failedEdges: Array<{
    edgeId: string;
    reason: string;
    recoverable: boolean;
  }>;
  successfulEdges: string[];
  rollbackAvailable: boolean;
  operationId?: string;
}

export interface ContainerExpansionValidationError extends OperationError {
  type: "container_expansion_validation_failure";
  containerId: string;
  validationIssues: Array<{
    issue: string;
    severity: "critical" | "warning";
    affectedEdges: string[];
  }>;
  canProceed: boolean;
  suggestedActions: string[];
}

export class SearchNavigationErrorHandler {
  private errorHistory: OperationError[] = [];
  private maxErrorHistory = 100;
  private userFeedbackCallbacks: ((feedback: UserFeedbackOptions) => void)[] =
    [];
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
    context?: Record<string, any>,
  ): Promise<ErrorRecoveryResult> {
    const error: OperationError = {
      type: "expansion_failure",
      message: `Failed to expand containers: ${containerIds.join(", ")}`,
      originalError,
      context: { containerIds, ...context },
      timestamp: Date.now(),
      retryable: true,
    };

    this.recordError(error);

    console.warn(
      `[ErrorHandler] Container expansion failed for ${containerIds.length} containers:`,
      originalError,
    );

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
            console.warn(
              `[ErrorHandler] expandTreeNodes method not available for ${containerId}`,
            );
          }
        } catch (individualError) {
          failedExpansions.push(containerId);
          console.warn(
            `[ErrorHandler] Individual expansion failed for ${containerId}:`,
            individualError,
          );
        }
      }

      if (successfulExpansions.length > 0) {
        fallbackApplied = true;
        console.log(
          `[ErrorHandler] Partial expansion recovery: ${successfulExpansions.length}/${containerIds.length} containers expanded`,
        );

        // Store fallback state for potential retry
        this.fallbackState.set("partial_expansion", {
          successful: successfulExpansions,
          failed: failedExpansions,
          timestamp: Date.now(),
        });
      }

      // Fallback 2: Highlight containers that couldn't be expanded
      if (failedExpansions.length > 0) {
        try {
          this.applyFallbackHighlighting(
            failedExpansions,
            state,
            "expansion_failed",
          );
          fallbackApplied = true;
        } catch (highlightError) {
          console.error(
            `[ErrorHandler] Fallback highlighting failed:`,
            highlightError,
          );
        }
      }
    }

    // Show user feedback if enabled
    if (this.options.enableUserFeedback) {
      const partialSuccess =
        fallbackApplied && this.fallbackState.has("partial_expansion");
      const feedback: UserFeedbackOptions = {
        message: partialSuccess
          ? `Some containers couldn't be expanded. ${this.fallbackState.get("partial_expansion").successful.length} of ${containerIds.length} expanded successfully.`
          : `Failed to expand containers. ${containerIds.length} containers affected.`,
        type: partialSuccess ? "warning" : "error",
        retryAction: async () => {
          const failedIds = partialSuccess
            ? this.fallbackState.get("partial_expansion").failed
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
    highlightType: "search" | "navigation",
    state: VisualizationState,
    originalError: Error,
    context?: Record<string, any>,
  ): Promise<ErrorRecoveryResult> {
    const error: OperationError = {
      type: "highlighting_failure",
      message: `Failed to apply ${highlightType} highlighting to ${elementIds.length} elements`,
      originalError,
      context: { elementIds, highlightType, ...context },
      timestamp: Date.now(),
      retryable: true,
    };

    this.recordError(error);

    console.warn(
      `[ErrorHandler] ${highlightType} highlighting failed for ${elementIds.length} elements:`,
      originalError,
    );

    let fallbackApplied = false;
    let userFeedbackShown = false;

    if (this.options.enableFallbacks) {
      try {
        // Fallback: Apply basic highlighting without advanced features
        this.applyFallbackHighlighting(elementIds, state, highlightType);
        fallbackApplied = true;
        console.log(
          `[ErrorHandler] Applied fallback highlighting for ${elementIds.length} elements`,
        );
      } catch (fallbackError) {
        console.error(
          `[ErrorHandler] Fallback highlighting also failed:`,
          fallbackError,
        );
      }
    }

    // Show user feedback for highlighting failures only if fallback also failed
    if (this.options.enableUserFeedback && !fallbackApplied) {
      const feedback: UserFeedbackOptions = {
        message: `Unable to highlight ${highlightType} results. Visual feedback may be limited.`,
        type: "warning",
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
    context?: Record<string, any>,
  ): Promise<ErrorRecoveryResult> {
    const error: OperationError = {
      type: "search_failure",
      message: `Search operation failed for query: "${query}"`,
      originalError,
      context: { query, ...context },
      timestamp: Date.now(),
      retryable: true,
    };

    this.recordError(error);

    console.warn(
      `[ErrorHandler] Search failed for query "${query}":`,
      originalError,
    );

    let fallbackApplied = false;
    let userFeedbackShown = false;

    if (this.options.enableFallbacks) {
      try {
        // Fallback: Simple substring search without advanced features
        const fallbackResults = this.performFallbackSearch(query, state);
        if (fallbackResults.length > 0) {
          // Apply basic highlighting to fallback results
          const elementIds = fallbackResults.map((r) => r.id);
          this.applyFallbackHighlighting(elementIds, state, "search");
          fallbackApplied = true;
          console.log(
            `[ErrorHandler] Fallback search found ${fallbackResults.length} results`,
          );
        }
      } catch (fallbackError) {
        console.error(
          `[ErrorHandler] Fallback search also failed:`,
          fallbackError,
        );
      }
    }

    // Show user feedback
    if (this.options.enableUserFeedback) {
      const feedback: UserFeedbackOptions = {
        message: fallbackApplied
          ? `Search completed with limited functionality. Some features may not be available.`
          : `Search failed for "${query}". Please try a different search term.`,
        type: fallbackApplied ? "warning" : "error",
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
    context?: Record<string, any>,
  ): Promise<ErrorRecoveryResult> {
    const error: OperationError = {
      type: "navigation_failure",
      message: `Navigation failed for element: ${elementId}`,
      originalError,
      context: { elementId, ...context },
      timestamp: Date.now(),
      retryable: true,
    };

    this.recordError(error);

    console.warn(
      `[ErrorHandler] Navigation failed for element ${elementId}:`,
      originalError,
    );

    let fallbackApplied = false;
    let userFeedbackShown = false;

    if (this.options.enableFallbacks) {
      try {
        // Fallback: Apply highlighting without viewport changes
        this.applyFallbackHighlighting([elementId], state, "navigation");
        fallbackApplied = true;
        console.log(
          `[ErrorHandler] Applied fallback navigation highlighting for ${elementId}`,
        );
      } catch (fallbackError) {
        console.error(
          `[ErrorHandler] Fallback navigation highlighting failed:`,
          fallbackError,
        );
      }
    }

    // Show user feedback
    if (this.options.enableUserFeedback) {
      const feedback: UserFeedbackOptions = {
        message: fallbackApplied
          ? `Navigation completed with limited functionality. Viewport may not have updated.`
          : `Unable to navigate to the selected item. Please try again.`,
        type: fallbackApplied ? "warning" : "error",
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
    context?: Record<string, any>,
  ): Promise<ErrorRecoveryResult> {
    const error: OperationError = {
      type: "timeout",
      message: `Operation "${operationType}" timed out after ${timeoutMs}ms`,
      context: { operationType, timeoutMs, ...context },
      timestamp: Date.now(),
      retryable: true,
    };

    this.recordError(error);

    console.warn(
      `[ErrorHandler] Operation "${operationType}" timed out after ${timeoutMs}ms`,
    );

    let userFeedbackShown = false;

    // Show user feedback for timeouts
    if (this.options.enableUserFeedback) {
      const feedback: UserFeedbackOptions = {
        message: `Operation timed out. The system may be under heavy load.`,
        type: "warning",
        retryAction: async () => {
          // Retry with longer timeout
          console.log(
            `[ErrorHandler] Retrying ${operationType} with extended timeout`,
          );
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
    timeoutMs: number = this.options.timeout!,
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
    highlightType: "search" | "navigation" | "expansion_failed",
  ): void {
    console.log(
      `[ErrorHandler] Applying fallback highlighting for ${elementIds.length} elements (${highlightType})`,
    );

    // Store fallback highlighting state
    const fallbackKey = `fallback_${highlightType}_${Date.now()}`;
    this.fallbackState.set(fallbackKey, {
      elementIds,
      highlightType,
      timestamp: Date.now(),
    });

    // Apply basic highlighting through state
    switch (highlightType) {
      case "search":
        for (const elementId of elementIds) {
          state.searchNavigationState.treeSearchHighlights.add(elementId);
          state.searchNavigationState.graphSearchHighlights.add(elementId);
        }
        break;
      case "navigation":
        for (const elementId of elementIds) {
          state.searchNavigationState.treeNavigationHighlights.add(elementId);
          state.searchNavigationState.graphNavigationHighlights.add(elementId);
        }
        break;
      case "expansion_failed":
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
  private performFallbackSearch(
    query: string,
    state: VisualizationState,
  ): SearchResult[] {
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    // Search visible nodes
    for (const node of state.visibleNodes) {
      if (node.label.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: node.id,
          type: "node",
          label: node.label,
          matchIndices: [
            [node.label.toLowerCase().indexOf(lowerQuery), lowerQuery.length],
          ],
          hierarchyPath: [], // Simplified - no hierarchy path in fallback
        });
      }
    }

    // Search visible containers
    for (const container of state.visibleContainers) {
      if (container.label.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: container.id,
          type: "container",
          label: container.label,
          matchIndices: [
            [
              container.label.toLowerCase().indexOf(lowerQuery),
              lowerQuery.length,
            ],
          ],
          hierarchyPath: [], // Simplified - no hierarchy path in fallback
        });
      }
    }

    return results;
  }

  /**
   * Retry container expansion with error handling
   */
  private async retryContainerExpansion(
    containerIds: string[],
    state: VisualizationState,
  ): Promise<void> {
    try {
      console.log(
        `[ErrorHandler] Retrying expansion for ${containerIds.length} containers`,
      );

      // Retry synchronously (respecting core architecture)
      if (state.expandTreeNodes) {
        state.expandTreeNodes(containerIds);
        console.log(`[ErrorHandler] Retry successful for container expansion`);

        // Clear fallback state on successful retry
        this.fallbackState.delete("partial_expansion");
      } else {
        throw new Error("expandTreeNodes method not available");
      }
    } catch (retryError) {
      console.error(
        `[ErrorHandler] Retry failed for container expansion:`,
        retryError,
      );
      await this.handleContainerExpansionFailure(
        containerIds,
        state,
        retryError as Error,
        { isRetry: true },
      );
    }
  }

  /**
   * Retry search operation with error handling
   */
  private async retrySearch(
    query: string,
    state: VisualizationState,
  ): Promise<void> {
    try {
      console.log(`[ErrorHandler] Retrying search for query: "${query}"`);

      // Retry synchronously (respecting core architecture)
      if (state.performSearch) {
        const results = state.performSearch(query);
        console.log(
          `[ErrorHandler] Retry successful for search, found ${results.length} results`,
        );
      } else {
        throw new Error("performSearch method not available");
      }
    } catch (retryError) {
      console.error(`[ErrorHandler] Retry failed for search:`, retryError);
      await this.handleSearchFailure(query, state, retryError as Error, {
        isRetry: true,
      });
    }
  }

  /**
   * Retry navigation operation with error handling
   */
  private async retryNavigation(
    elementId: string,
    state: VisualizationState,
  ): Promise<void> {
    try {
      console.log(
        `[ErrorHandler] Retrying navigation for element: ${elementId}`,
      );

      // Retry synchronously (respecting core architecture)
      if (state.navigateToElement) {
        state.navigateToElement(elementId);
        console.log(`[ErrorHandler] Retry successful for navigation`);
      } else {
        throw new Error("navigateToElement method not available");
      }
    } catch (retryError) {
      console.error(`[ErrorHandler] Retry failed for navigation:`, retryError);
      await this.handleNavigationFailure(
        elementId,
        state,
        retryError as Error,
        { isRetry: true },
      );
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
   * ENHANCEMENT: Record error with comprehensive logging and structured reporting
   * Requirements: 4.2, 2.2
   */
  private recordError(error: OperationError): void {
    this.errorHistory.push(error);

    // Limit error history size
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory.shift();
    }

    // Comprehensive structured error logging
    console.group(`[ErrorHandler] ❌ ERROR RECORDED: ${error.type}`);
    console.error(`Message: ${error.message}`);
    console.error(`Timestamp: ${new Date(error.timestamp).toISOString()}`);
    console.error(`Retryable: ${error.retryable}`);

    if (error.originalError) {
      console.error(`Original Error:`, error.originalError);
      if (error.originalError.stack) {
        console.error(`Stack Trace:`, error.originalError.stack);
      }
    }

    if (error.context && Object.keys(error.context).length > 0) {
      console.error(`Context:`, error.context);
    }

    // Type-specific detailed logging
    switch (error.type) {
      case "edge_validation_failure":
        this.logEdgeValidationError(error as EdgeValidationError);
        break;
      case "edge_restoration_failure":
        this.logEdgeRestorationError(error as EdgeRestorationError);
        break;
      case "container_expansion_validation_failure":
        this.logContainerExpansionValidationError(
          error as ContainerExpansionValidationError,
        );
        break;
      default:
        console.error(`Error Details:`, {
          type: error.type,
          message: error.message,
          context: error.context,
        });
    }

    console.groupEnd();

    // Generate debugging utilities for complex errors
    this.generateErrorDebuggingUtilities(error);
  }

  /**
   * ENHANCEMENT: Detailed logging for edge validation errors
   */
  private logEdgeValidationError(error: EdgeValidationError): void {
    console.error(`Edge ID: ${error.edgeId}`);
    console.error(`Source Exists: ${error.sourceExists}`);
    console.error(`Target Exists: ${error.targetExists}`);
    console.error(`Cross Hierarchy: ${error.crossHierarchy}`);

    if (error.validationFailures && error.validationFailures.length > 0) {
      console.error(
        `Validation Failures (${error.validationFailures.length}):`,
      );
      error.validationFailures.forEach((failure, index) => {
        console.error(
          `  ${index + 1}. [${failure.severity.toUpperCase()}] ${failure.reason}`,
        );
        if (failure.suggestedFix) {
          console.error(`     Suggested Fix: ${failure.suggestedFix}`);
        }
      });
    }

    // Generate edge debugging report
    if (error.context && error.context.state) {
      const debugReport = this.generateEdgeValidationDebugReport(
        error.edgeId,
        error.validationFailures,
        error.context.state,
      );
      console.error(`Edge Debug Report:`, debugReport);
    }
  }

  /**
   * ENHANCEMENT: Detailed logging for edge restoration errors
   */
  private logEdgeRestorationError(error: EdgeRestorationError): void {
    console.error(`Container ID: ${error.containerId}`);
    console.error(`Operation ID: ${error.operationId}`);
    console.error(`Rollback Available: ${error.rollbackAvailable}`);
    console.error(`Successful Edges: ${error.successfulEdges.length}`);
    console.error(`Failed Edges: ${error.failedEdges.length}`);

    if (error.failedEdges.length > 0) {
      console.error(`Failed Edge Details:`);
      error.failedEdges.forEach((edge, index) => {
        console.error(
          `  ${index + 1}. ${edge.edgeId}: ${edge.reason} (recoverable: ${edge.recoverable})`,
        );
      });
    }

    if (error.successfulEdges.length > 0) {
      console.error(
        `Successfully Restored Edges: ${error.successfulEdges.join(", ")}`,
      );
    }

    // Calculate and log failure statistics
    const totalEdges = error.failedEdges.length + error.successfulEdges.length;
    const failureRate =
      totalEdges > 0 ? (error.failedEdges.length / totalEdges) * 100 : 0;
    const recoverableCount = error.failedEdges.filter(
      (e) => e.recoverable,
    ).length;

    console.error(`Restoration Statistics:`);
    console.error(`  Total Edges: ${totalEdges}`);
    console.error(`  Failure Rate: ${failureRate.toFixed(1)}%`);
    console.error(
      `  Recoverable Failures: ${recoverableCount}/${error.failedEdges.length}`,
    );
  }

  /**
   * ENHANCEMENT: Detailed logging for container expansion validation errors
   */
  private logContainerExpansionValidationError(
    error: ContainerExpansionValidationError,
  ): void {
    console.error(`Container ID: ${error.containerId}`);
    console.error(`Can Proceed: ${error.canProceed}`);
    console.error(`Validation Issues: ${error.validationIssues.length}`);

    if (error.validationIssues.length > 0) {
      const criticalCount = error.validationIssues.filter(
        (i) => i.severity === "critical",
      ).length;
      const warningCount = error.validationIssues.filter(
        (i) => i.severity === "warning",
      ).length;

      console.error(
        `Issue Breakdown: ${criticalCount} critical, ${warningCount} warnings`,
      );
      console.error(`Validation Issue Details:`);

      error.validationIssues.forEach((issue, index) => {
        console.error(
          `  ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.issue}`,
        );
        if (issue.affectedEdges.length > 0) {
          console.error(
            `     Affected Edges (${issue.affectedEdges.length}): ${issue.affectedEdges.join(", ")}`,
          );
        }
      });
    }

    if (error.suggestedActions.length > 0) {
      console.error(`Suggested Actions (${error.suggestedActions.length}):`);
      error.suggestedActions.forEach((action, index) => {
        console.error(`  ${index + 1}. ${action}`);
      });
    }
  }

  /**
   * ENHANCEMENT: Generate debugging utilities for complex errors
   */
  private generateErrorDebuggingUtilities(error: OperationError): void {
    const debugCommands: string[] = [];
    const investigationSteps: string[] = [];

    switch (error.type) {
      case "edge_validation_failure":
        const edgeError = error as EdgeValidationError;
        debugCommands.push(`// Debug edge ${edgeError.edgeId}`);
        debugCommands.push(`state.getEdge('${edgeError.edgeId}')`);
        debugCommands.push(
          `state.getGraphNode('${edgeError.edgeId.split("-")[0] || "source"}')`,
        );
        debugCommands.push(
          `state.getGraphNode('${edgeError.edgeId.split("-")[1] || "target"}')`,
        );

        investigationSteps.push(
          "1. Check if edge exists in state.visibleEdges",
        );
        investigationSteps.push("2. Verify source and target nodes exist");
        investigationSteps.push("3. Check container hierarchy for endpoints");
        investigationSteps.push("4. Verify edge aggregation state");
        break;

      case "edge_restoration_failure":
        const restorationError = error as EdgeRestorationError;
        debugCommands.push(
          `// Debug container ${restorationError.containerId} restoration`,
        );
        debugCommands.push(
          `state.getContainer('${restorationError.containerId}')`,
        );
        debugCommands.push(`state.getAvailableRestorationRollbacks()`);
        if (restorationError.operationId) {
          debugCommands.push(
            `state.rollbackEdgeRestoration('${restorationError.operationId}')`,
          );
        }

        investigationSteps.push("1. Check container expansion state");
        investigationSteps.push("2. Verify aggregated edges exist");
        investigationSteps.push("3. Check original edge references");
        investigationSteps.push("4. Verify container hierarchy integrity");
        break;

      case "container_expansion_validation_failure":
        const expansionError = error as ContainerExpansionValidationError;
        debugCommands.push(
          `// Debug container ${expansionError.containerId} expansion`,
        );
        debugCommands.push(
          `state.getContainer('${expansionError.containerId}')`,
        );
        debugCommands.push(
          `state._getAllDescendantIds('${expansionError.containerId}')`,
        );

        investigationSteps.push("1. Check container structure and children");
        investigationSteps.push(
          "2. Verify edge endpoints in container hierarchy",
        );
        investigationSteps.push("3. Check for circular dependencies");
        investigationSteps.push("4. Verify container visibility states");
        break;
    }

    if (debugCommands.length > 0) {
      console.group(`[ErrorHandler] 🔧 DEBUG UTILITIES`);
      console.log(`Debug Commands (copy to console):`);
      debugCommands.forEach((cmd) => console.log(cmd));

      console.log(`Investigation Steps:`);
      investigationSteps.forEach((step) => console.log(step));
      console.groupEnd();
    }
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
    const recentErrors = this.errorHistory.filter(
      (e) => e.timestamp > oneMinuteAgo,
    );

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
   * ENHANCEMENT: Handle edge validation failures with fail-fast approach
   * Requirements: 2.2, 3.4
   *
   * This method provides detailed error reporting and debugging information
   * but does NOT hide bugs with fallbacks. Critical issues cause failures.
   */
  async handleEdgeValidationFailure(
    edgeId: string,
    validationFailures: Array<{
      reason: string;
      severity: "critical" | "warning" | "info";
      suggestedFix?: string;
    }>,
    sourceExists: boolean,
    targetExists: boolean,
    crossHierarchy: boolean,
    state: VisualizationState,
    originalError?: Error,
    context?: Record<string, any>,
  ): Promise<ErrorRecoveryResult> {
    const error: EdgeValidationError = {
      type: "edge_validation_failure",
      message: `Edge validation failed for edge ${edgeId}`,
      originalError,
      context: {
        edgeId,
        validationFailures,
        sourceExists,
        targetExists,
        crossHierarchy,
        ...context,
      },
      timestamp: Date.now(),
      retryable: false, // Changed to false - validation failures indicate bugs
      edgeId,
      validationFailures,
      sourceExists,
      targetExists,
      crossHierarchy,
    };

    this.recordError(error);

    // Detailed error reporting for debugging
    console.error(
      `[ErrorHandler] ❌ Edge validation failed for edge ${edgeId}:`,
    );
    console.error(
      `[ErrorHandler] ❌ Source exists: ${sourceExists}, Target exists: ${targetExists}`,
    );
    console.error(`[ErrorHandler] ❌ Cross hierarchy: ${crossHierarchy}`);
    console.error(`[ErrorHandler] ❌ Validation failures:`);

    validationFailures.forEach((failure, index) => {
      console.error(
        `[ErrorHandler] ❌   ${index + 1}. [${failure.severity.toUpperCase()}] ${failure.reason}`,
      );
      if (failure.suggestedFix) {
        console.error(
          `[ErrorHandler] ❌      Suggested fix: ${failure.suggestedFix}`,
        );
      }
    });

    if (context) {
      console.error(`[ErrorHandler] ❌ Additional context:`, context);
    }

    // Check for critical failures - these should cause the system to fail fast
    const criticalFailures = validationFailures.filter(
      (f) => f.severity === "critical",
    );
    if (criticalFailures.length > 0) {
      const criticalReasons = criticalFailures.map((f) => f.reason).join(", ");
      const errorMessage = `Critical edge validation failures detected for edge ${edgeId}: ${criticalReasons}. This indicates a bug that must be fixed.`;

      console.error(`[ErrorHandler] ❌ ${errorMessage}`);

      // FAIL FAST: Critical validation failures are bugs, not recoverable errors
      throw new Error(
        `${errorMessage}. Caused by: ${originalError instanceof Error ? originalError.message : String(originalError)}`,
      );
    }

    // For non-critical issues, provide detailed logging but continue
    const warningCount = validationFailures.filter(
      (f) => f.severity === "warning",
    ).length;
    const infoCount = validationFailures.filter(
      (f) => f.severity === "info",
    ).length;

    console.warn(
      `[ErrorHandler] ⚠️ Edge validation completed with ${warningCount} warnings and ${infoCount} info messages for edge ${edgeId}`,
    );

    // Show user feedback for debugging purposes (not for hiding issues)
    if (this.options.enableUserFeedback) {
      const feedback: UserFeedbackOptions = {
        message: `Edge validation found ${warningCount} warnings for edge ${edgeId}. Check console for details.`,
        type: "warning",
        dismissible: true,
        duration: 5000,
      };

      this.showUserFeedback(feedback);
    }

    return {
      success: true, // Non-critical issues don't prevent success
      fallbackApplied: false, // No fallbacks applied
      userFeedbackShown: this.options.enableUserFeedback || false,
      error: undefined, // No error for non-critical issues
    };
  }

  /**
   * ENHANCEMENT: Handle edge restoration failures with fail-fast approach
   * Requirements: 2.4, 3.4
   *
   * This method provides detailed error reporting and rollback capabilities
   * but fails fast for high failure rates that indicate bugs.
   */
  async handleEdgeRestorationFailure(
    containerId: string,
    failedEdges: Array<{
      edgeId: string;
      reason: string;
      recoverable: boolean;
    }>,
    successfulEdges: string[],
    rollbackAvailable: boolean,
    operationId: string,
    state: VisualizationState,
    originalError?: Error,
    context?: Record<string, any>,
  ): Promise<ErrorRecoveryResult> {
    const totalEdges = failedEdges.length + successfulEdges.length;
    const failureRate = totalEdges > 0 ? failedEdges.length / totalEdges : 0;

    const error: EdgeRestorationError = {
      type: "edge_restoration_failure",
      message: `Edge restoration failed for container ${containerId}. ${failedEdges.length} edges failed, ${successfulEdges.length} succeeded.`,
      originalError,
      context: {
        containerId,
        failedEdges,
        successfulEdges,
        rollbackAvailable,
        operationId,
        failureRate,
        ...context,
      },
      timestamp: Date.now(),
      retryable: failureRate <= 0.3, // Only retryable if failure rate is acceptable
      containerId,
      failedEdges,
      successfulEdges,
      rollbackAvailable,
      operationId,
    };

    this.recordError(error);

    // Detailed error reporting for debugging
    console.error(
      `[ErrorHandler] ❌ Edge restoration results for container ${containerId}:`,
    );
    console.error(
      `[ErrorHandler] ❌ Total edges: ${totalEdges}, Failed: ${failedEdges.length}, Successful: ${successfulEdges.length}`,
    );
    console.error(
      `[ErrorHandler] ❌ Failure rate: ${(failureRate * 100).toFixed(1)}%`,
    );
    console.error(
      `[ErrorHandler] ❌ Rollback available: ${rollbackAvailable}, Operation ID: ${operationId}`,
    );

    if (failedEdges.length > 0) {
      console.error(`[ErrorHandler] ❌ Failed edge details:`);
      failedEdges.forEach((edge, index) => {
        console.error(
          `[ErrorHandler] ❌   ${index + 1}. ${edge.edgeId}: ${edge.reason} (recoverable: ${edge.recoverable})`,
        );
      });
    }

    // FAIL FAST: High failure rates indicate bugs in edge restoration logic
    if (failureRate > 0.5) {
      const errorMessage =
        `Critical edge restoration failure rate (${(failureRate * 100).toFixed(1)}%) for container ${containerId}. ` +
        `This indicates bugs in edge restoration logic that must be fixed. ` +
        `Failed edges: ${failedEdges.map((e) => `${e.edgeId} (${e.reason})`).join(", ")}`;

      console.error(`[ErrorHandler] ❌ ${errorMessage}`);

      // FAIL FAST: High failure rates are bugs, not expected behavior
      throw new Error(
        `${errorMessage}. Caused by: ${originalError instanceof Error ? originalError.message : String(originalError)}`,
      );
    }

    // For moderate failure rates (30-50%), provide detailed warnings but continue
    if (failureRate > 0.3) {
      console.warn(
        `[ErrorHandler] ⚠️ Moderate edge restoration failure rate (${(failureRate * 100).toFixed(1)}%) for container ${containerId}`,
      );
      console.warn(
        `[ErrorHandler] ⚠️ This may indicate issues with edge restoration logic that should be investigated`,
      );

      if (rollbackAvailable) {
        console.warn(
          `[ErrorHandler] ⚠️ Consider using rollback: state.rollbackEdgeRestoration('${operationId}')`,
        );
      }
    }

    // For low failure rates, just log the information
    if (failureRate > 0 && failureRate <= 0.3) {
      console.log(
        `[ErrorHandler] ℹ️ Edge restoration completed with acceptable failure rate (${(failureRate * 100).toFixed(1)}%) for container ${containerId}`,
      );
    }

    // Show user feedback for debugging purposes
    if (this.options.enableUserFeedback && failureRate > 0.1) {
      const feedback: UserFeedbackOptions = {
        message:
          rollbackAvailable && failureRate > 0.3
            ? `Edge restoration had ${(failureRate * 100).toFixed(1)}% failure rate. Rollback available if needed.`
            : `Edge restoration completed with ${failedEdges.length} failures out of ${totalEdges} edges.`,
        type: failureRate > 0.3 ? "warning" : "info",
        dismissible: true,
        duration: 6000,
      };

      this.showUserFeedback(feedback);
    }

    return {
      success: failureRate <= 0.3, // Success if failure rate is acceptable
      fallbackApplied: false, // No fallbacks applied - we expose the issues
      userFeedbackShown: !!(
        this.options.enableUserFeedback && failureRate > 0.1
      ),
      error: failureRate <= 0.3 ? undefined : error,
    };
  }

  /**
   * ENHANCEMENT: Handle container expansion validation failures with fail-fast approach
   * Requirements: 1.3, 2.1, 2.2
   *
   * This method provides detailed error reporting and debugging information
   * but fails fast for critical validation issues that indicate bugs.
   */
  async handleContainerExpansionValidationFailure(
    containerId: string,
    validationIssues: Array<{
      issue: string;
      severity: "critical" | "warning";
      affectedEdges: string[];
    }>,
    canProceed: boolean,
    suggestedActions: string[],
    state: VisualizationState,
    originalError?: Error,
    context?: Record<string, any>,
  ): Promise<ErrorRecoveryResult> {
    const criticalCount = validationIssues.filter(
      (i) => i.severity === "critical",
    ).length;
    const warningCount = validationIssues.filter(
      (i) => i.severity === "warning",
    ).length;

    const error: ContainerExpansionValidationError = {
      type: "container_expansion_validation_failure",
      message: `Container expansion validation failed for ${containerId}`,
      originalError,
      context: {
        containerId,
        validationIssues,
        canProceed,
        suggestedActions,
        criticalCount,
        warningCount,
        ...context,
      },
      timestamp: Date.now(),
      retryable: false, // Changed to false - validation failures indicate bugs
      containerId,
      validationIssues,
      canProceed,
      suggestedActions,
    };

    this.recordError(error);

    // Detailed error reporting for debugging
    console.error(
      `[ErrorHandler] ❌ Container expansion validation failed for ${containerId}:`,
    );
    console.error(
      `[ErrorHandler] ❌ Critical issues: ${criticalCount}, Warning issues: ${warningCount}`,
    );
    console.error(`[ErrorHandler] ❌ Can proceed: ${canProceed}`);
    console.error(`[ErrorHandler] ❌ Validation issues:`);

    validationIssues.forEach((issue, index) => {
      console.error(
        `[ErrorHandler] ❌   ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.issue}`,
      );
      if (issue.affectedEdges.length > 0) {
        console.error(
          `[ErrorHandler] ❌      Affected edges: ${issue.affectedEdges.join(", ")}`,
        );
      }
    });

    if (suggestedActions.length > 0) {
      console.error(`[ErrorHandler] ❌ Suggested actions:`);
      suggestedActions.forEach((action, index) => {
        console.error(`[ErrorHandler] ❌   ${index + 1}. ${action}`);
      });
    }

    // FAIL FAST: Critical validation issues indicate bugs that must be fixed
    if (criticalCount > 0) {
      const criticalIssues = validationIssues.filter(
        (i) => i.severity === "critical",
      );
      const criticalDetails = criticalIssues
        .map((i) => `${i.issue} (affects ${i.affectedEdges.length} edges)`)
        .join(", ");
      const errorMessage =
        `Critical container expansion validation failures for ${containerId}: ${criticalDetails}. ` +
        `This indicates bugs in container hierarchy or edge management that must be fixed.`;

      console.error(`[ErrorHandler] ❌ ${errorMessage}`);

      // FAIL FAST: Critical validation failures are bugs, not recoverable errors
      throw new Error(
        `${errorMessage}. Caused by: ${originalError instanceof Error ? originalError.message : String(originalError)}`,
      );
    }

    // For warning-only issues, provide detailed logging but allow continuation
    if (warningCount > 0) {
      console.warn(
        `[ErrorHandler] ⚠️ Container expansion validation found ${warningCount} warnings for ${containerId}:`,
      );
      const warningIssues = validationIssues.filter(
        (i) => i.severity === "warning",
      );
      warningIssues.forEach((issue, index) => {
        console.warn(
          `[ErrorHandler] ⚠️   ${index + 1}. ${issue.issue} (affects ${issue.affectedEdges.length} edges)`,
        );
      });

      if (!canProceed) {
        console.warn(
          `[ErrorHandler] ⚠️ Despite only having warnings, expansion cannot proceed. This may indicate a bug in validation logic.`,
        );
      }
    }

    // Show user feedback for debugging purposes
    if (this.options.enableUserFeedback && warningCount > 0) {
      const feedback: UserFeedbackOptions = {
        message: `Container expansion validation found ${warningCount} warnings for ${containerId}. Check console for details.`,
        type: "warning",
        dismissible: true,
        duration: 5000,
      };

      this.showUserFeedback(feedback);
    }

    return {
      success: warningCount > 0 && canProceed, // Success only if we have warnings and can proceed
      fallbackApplied: false, // No fallbacks applied - we expose the issues
      userFeedbackShown: !!(
        this.options.enableUserFeedback && warningCount > 0
      ),
      error: undefined, // No error for warning-only issues that allow proceeding
    };
  }

  /**
   * ENHANCEMENT: Generate detailed debugging report for edge validation issues
   * This method provides comprehensive debugging information without hiding bugs
   */
  generateEdgeValidationDebugReport(
    edgeId: string,
    validationFailures: Array<{
      reason: string;
      severity: "critical" | "warning" | "info";
      suggestedFix?: string;
    }>,
    state: VisualizationState,
  ): {
    edgeDetails: Record<string, any>;
    endpointAnalysis: Record<string, any>;
    hierarchyAnalysis: Record<string, any>;
    suggestedInvestigations: string[];
  } {
    const edge = state.getEdge?.(edgeId);
    const sourceNode = edge?.source
      ? state.getGraphNode?.(edge.source)
      : undefined;
    const targetNode = edge?.target
      ? state.getGraphNode?.(edge.target)
      : undefined;
    const sourceContainer = edge?.source
      ? state.getContainer?.(edge.source)
      : undefined;
    const targetContainer = edge?.target
      ? state.getContainer?.(edge.target)
      : undefined;

    const edgeDetails = {
      id: edgeId,
      exists: !!edge,
      source: edge?.source,
      target: edge?.target,
      type: edge?.type,
      hidden: edge?.hidden,
      aggregated:
        edge && "aggregated" in edge ? (edge as any).aggregated : false,
    };

    const endpointAnalysis = {
      source: {
        id: edge?.source,
        existsAsNode: !!sourceNode,
        existsAsContainer: !!sourceContainer,
        nodeHidden: sourceNode?.hidden,
        containerHidden: sourceContainer?.hidden,
        containerCollapsed: sourceContainer?.collapsed,
      },
      target: {
        id: edge?.target,
        existsAsNode: !!targetNode,
        existsAsContainer: !!targetContainer,
        nodeHidden: targetNode?.hidden,
        containerHidden: targetContainer?.hidden,
        containerCollapsed: targetContainer?.collapsed,
      },
    };

    const hierarchyAnalysis = {
      sourceContainerPath: this.getElementHierarchyPath(edge?.source, state),
      targetContainerPath: this.getElementHierarchyPath(edge?.target, state),
      crossHierarchy: false, // Would need implementation
    };

    const suggestedInvestigations = [
      "Check if edge endpoints exist in the data model",
      "Verify container hierarchy is correctly structured",
      "Ensure edge aggregation/restoration logic is working correctly",
      "Check if edge was created during parsing or added later",
      "Verify visibility state consistency between nodes and containers",
    ];

    // Add specific investigations based on validation failures
    validationFailures.forEach((failure) => {
      if (failure.reason.includes("missing")) {
        suggestedInvestigations.push(
          "Investigate data parsing - missing endpoints suggest parsing bugs",
        );
      }
      if (failure.reason.includes("hidden")) {
        suggestedInvestigations.push(
          "Investigate container expansion/collapse logic",
        );
      }
      if (failure.reason.includes("aggregated")) {
        suggestedInvestigations.push("Investigate edge aggregation logic");
      }
    });

    return {
      edgeDetails,
      endpointAnalysis,
      hierarchyAnalysis,
      suggestedInvestigations,
    };
  }

  /**
   * ENHANCEMENT: Get hierarchy path for debugging purposes
   */
  private getElementHierarchyPath(
    elementId: string | undefined,
    state: VisualizationState,
  ): string[] {
    if (!elementId) return [];

    const path: string[] = [elementId];
    // This would need implementation to traverse up the container hierarchy
    // For now, return just the element ID
    return path;
  }

  /**
   * ENHANCEMENT: Retry recoverable edge restoration individually
   */
  private async retryRecoverableEdgeRestoration(
    recoverableEdges: Array<{
      edgeId: string;
      reason: string;
      recoverable: boolean;
    }>,
    containerId: string,
    state: VisualizationState,
  ): Promise<{ recoveredCount: number; stillFailedCount: number }> {
    let recoveredCount = 0;
    let stillFailedCount = 0;

    for (const edgeInfo of recoverableEdges) {
      try {
        // Attempt individual edge restoration
        const success = await this.restoreIndividualEdge(
          edgeInfo.edgeId,
          containerId,
          state,
        );
        if (success) {
          recoveredCount++;
          console.log(
            `[ErrorHandler] Successfully recovered edge ${edgeInfo.edgeId} on retry`,
          );
        } else {
          stillFailedCount++;
        }
      } catch (error) {
        stillFailedCount++;
        console.warn(
          `[ErrorHandler] Individual edge restoration retry failed for ${edgeInfo.edgeId}:`,
          error,
        );
      }
    }

    return { recoveredCount, stillFailedCount };
  }

  /**
   * ENHANCEMENT: Apply automatic fixes for container expansion validation issues
   */
  private async applyContainerExpansionAutoFixes(
    containerId: string,
    suggestedActions: string[],
    state: VisualizationState,
  ): Promise<{
    appliedCount: number;
    appliedFixes: string[];
    resolvedCritical: boolean;
  }> {
    const appliedFixes: string[] = [];
    let appliedCount = 0;
    let resolvedCritical = false;

    for (const action of suggestedActions) {
      try {
        switch (action) {
          case "validate_edge_endpoints":
            const validationResult = await this.validateAndFixEdgeEndpoints(
              containerId,
              state,
            );
            if (validationResult.fixedCount > 0) {
              appliedFixes.push(
                `fixed_${validationResult.fixedCount}_edge_endpoints`,
              );
              appliedCount++;
              if (validationResult.resolvedCritical) resolvedCritical = true;
            }
            break;
          case "cleanup_orphaned_edges":
            const cleanupResult = await this.cleanupOrphanedEdges(
              containerId,
              state,
            );
            if (cleanupResult.cleanedCount > 0) {
              appliedFixes.push(
                `cleaned_${cleanupResult.cleanedCount}_orphaned_edges`,
              );
              appliedCount++;
            }
            break;
          case "refresh_container_hierarchy":
            const refreshResult = await this.refreshContainerHierarchy(
              containerId,
              state,
            );
            if (refreshResult.success) {
              appliedFixes.push("refreshed_container_hierarchy");
              appliedCount++;
              resolvedCritical = true;
            }
            break;
        }
      } catch (error) {
        console.warn(
          `[ErrorHandler] Auto-fix failed for action "${action}":`,
          error,
        );
      }
    }

    return { appliedCount, appliedFixes, resolvedCritical };
  }

  // Helper methods for edge validation fixes (simplified implementations)
  private async fixEdgeEndpointsWithVisibleAncestors(
    edgeId: string,
    state: VisualizationState,
  ): Promise<{ success: boolean }> {
    // Simplified implementation - would need access to state methods
    console.log(
      `[ErrorHandler] Attempting to fix edge endpoints for ${edgeId}`,
    );
    return { success: false }; // Placeholder
  }

  private async aggregateProblematicEdge(
    edgeId: string,
    state: VisualizationState,
  ): Promise<{ success: boolean }> {
    // Simplified implementation - would need access to state methods
    console.log(
      `[ErrorHandler] Attempting to aggregate problematic edge ${edgeId}`,
    );
    return { success: false }; // Placeholder
  }

  private async restoreIndividualEdge(
    edgeId: string,
    containerId: string,
    state: VisualizationState,
  ): Promise<boolean> {
    // Simplified implementation - would need access to state methods
    console.log(
      `[ErrorHandler] Attempting to restore individual edge ${edgeId} for container ${containerId}`,
    );
    return false; // Placeholder
  }

  private async validateAndFixEdgeEndpoints(
    containerId: string,
    state: VisualizationState,
  ): Promise<{ fixedCount: number; resolvedCritical: boolean }> {
    // Simplified implementation - would need access to state methods
    console.log(
      `[ErrorHandler] Validating and fixing edge endpoints for container ${containerId}`,
    );
    return { fixedCount: 0, resolvedCritical: false }; // Placeholder
  }

  private async cleanupOrphanedEdges(
    containerId: string,
    state: VisualizationState,
  ): Promise<{ cleanedCount: number }> {
    // Simplified implementation - would need access to state methods
    console.log(
      `[ErrorHandler] Cleaning up orphaned edges for container ${containerId}`,
    );
    return { cleanedCount: 0 }; // Placeholder
  }

  private async refreshContainerHierarchy(
    containerId: string,
    state: VisualizationState,
  ): Promise<{ success: boolean }> {
    // Simplified implementation - would need access to state methods
    console.log(
      `[ErrorHandler] Refreshing container hierarchy for ${containerId}`,
    );
    return { success: false }; // Placeholder
  }

  private async provideExpansionAlternatives(
    containerId: string,
    criticalIssues: Array<{
      issue: string;
      severity: "critical" | "warning";
      affectedEdges: string[];
    }>,
    state: VisualizationState,
  ): Promise<void> {
    console.log(
      `[ErrorHandler] Providing expansion alternatives for container ${containerId} due to critical issues:`,
      criticalIssues.map((i) => i.issue),
    );
    // Implementation would provide alternative visualization strategies
  }

  private async retryEdgeValidation(
    edgeId: string,
    state: VisualizationState,
  ): Promise<void> {
    console.log(`[ErrorHandler] Retrying edge validation for ${edgeId}`);
    // Implementation would retry validation with enhanced error handling
  }

  private async performEdgeRestorationRollback(
    operationId: string,
    state: VisualizationState,
  ): Promise<void> {
    console.log(
      `[ErrorHandler] Performing edge restoration rollback for operation ${operationId}`,
    );
    // Implementation would call state.rollbackEdgeRestoration if available
    if (state.rollbackEdgeRestoration) {
      const success = state.rollbackEdgeRestoration(operationId);
      if (success) {
        console.log(
          `[ErrorHandler] Successfully rolled back operation ${operationId}`,
        );
      } else {
        console.error(
          `[ErrorHandler] Failed to rollback operation ${operationId}`,
        );
      }
    }
  }

  private async retryEdgeRestoration(
    containerId: string,
    failedEdgeIds: string[],
    state: VisualizationState,
  ): Promise<void> {
    console.log(
      `[ErrorHandler] Retrying edge restoration for container ${containerId} with ${failedEdgeIds.length} failed edges`,
    );
    // Implementation would retry restoration with enhanced error handling
  }

  private async retryContainerExpansionValidation(
    containerId: string,
    state: VisualizationState,
  ): Promise<void> {
    console.log(
      `[ErrorHandler] Retrying container expansion validation for ${containerId}`,
    );
    // Implementation would retry validation with enhanced error handling
  }

  /**
   * Get recovery suggestions based on error patterns
   */
  getRecoverySuggestions(): string[] {
    const stats = this.getErrorStatistics();
    const suggestions: string[] = [];

    if (stats.errorsByType.timeout > 3) {
      suggestions.push(
        "System may be under heavy load. Try reducing the number of simultaneous operations.",
      );
    }

    if (stats.errorsByType.expansion_failure > 2) {
      suggestions.push(
        "Container expansion issues detected. Try expanding containers individually.",
      );
    }

    if (stats.errorsByType.highlighting_failure > 2) {
      suggestions.push(
        "Highlighting issues detected. Visual feedback may be limited.",
      );
    }

    if (stats.errorsByType.edge_validation_failure > 3) {
      suggestions.push(
        "Edge validation issues detected. Some edges may be hidden to prevent rendering errors.",
      );
    }

    if (stats.errorsByType.edge_restoration_failure > 2) {
      suggestions.push(
        "Edge restoration issues detected. Consider using rollback functionality if available.",
      );
    }

    if (stats.errorsByType.container_expansion_validation_failure > 2) {
      suggestions.push(
        "Container expansion validation issues detected. Try expanding containers with fewer edge connections first.",
      );
    }

    if (stats.errorRate > 10) {
      suggestions.push(
        "High error rate detected. Consider refreshing the page or reducing system load.",
      );
    }

    return suggestions;
  }
}

// Export singleton instance
export const searchNavigationErrorHandler = new SearchNavigationErrorHandler();
