/**
 * @fileoverview Operation Performance Monitor
 * 
 * Extends the existing PerformanceMonitor, PerformanceProfiler, and PerformanceUtils
 * to provide specialized monitoring for imperative UI operations. This utility helps
 * track performance metrics and detect coordination cascades in container, panel,
 * style, and search operations.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

import { 
  globalPerformanceMonitor, 
  recordPerformanceMetric,
  type PerformanceAlert 
} from "./PerformanceMonitor.js";
import { 
  globalProfiler,
  profileFunction,
  profileAsyncFunction,
  type PerformanceMetrics as ProfilerMetrics
} from "./PerformanceProfiler.js";
import { 
  measureSync,
  measureAsync,
  type PerformanceMetrics as UtilsMetrics
} from "./PerformanceUtils.js";

/**
 * Operation types for performance monitoring
 */
export type OperationType = 
  | 'container_toggle'
  | 'container_expand' 
  | 'container_collapse'
  | 'container_batch'
  | 'panel_toggle'
  | 'panel_expand'
  | 'panel_collapse'
  | 'panel_batch'
  | 'style_layout'
  | 'style_color_palette'
  | 'style_edge_style'
  | 'style_reset'
  | 'style_batch'
  | 'search_clear'
  | 'search_panel_clear';

/**
 * Cascade detection result
 */
export interface CascadeDetection {
  detected: boolean;
  cascadeCount: number;
  operations: Array<{
    operation: OperationType;
    timestamp: number;
    duration: number;
  }>;
  recommendations: string[];
}

/**
 * Operation performance metrics
 */
export interface OperationMetrics {
  operation: OperationType;
  duration: number;
  memoryUsage: {
    before: number;
    after: number;
    growth: number;
  };
  cascadeRisk: 'low' | 'medium' | 'high';
  coordinatorCalls: number;
  domUpdates: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Performance monitoring configuration for operations
 */
export interface OperationMonitoringConfig {
  enabled: boolean;
  trackCascades: boolean;
  cascadeDetectionWindow: number; // milliseconds
  maxCascadeOperations: number;
  debugLogging: boolean;
  alertOnCascades: boolean;
  thresholds: {
    [K in OperationType]?: {
      maxDuration: number;
      maxMemoryGrowth: number;
      maxCoordinatorCalls: number;
    };
  };
}

/**
 * Operation Performance Monitor
 * 
 * Specialized monitoring for imperative UI operations with cascade detection
 */
export class OperationPerformanceMonitor {
  private config: OperationMonitoringConfig;
  private operationHistory: OperationMetrics[] = [];
  private cascadeDetectionBuffer: Array<{
    operation: OperationType;
    timestamp: number;
    duration: number;
  }> = [];
  private coordinatorCallCount = 0;
  private domUpdateCount = 0;

  constructor(config: Partial<OperationMonitoringConfig> = {}) {
    this.config = {
      enabled: typeof process !== 'undefined' ? process.env.NODE_ENV !== 'test' : true,
      trackCascades: true,
      cascadeDetectionWindow: 1000, // 1 second
      maxCascadeOperations: 5,
      debugLogging: typeof process !== 'undefined' ? process.env.NODE_ENV === 'development' : false,
      alertOnCascades: true,
      thresholds: {
        container_toggle: { maxDuration: 50, maxMemoryGrowth: 5, maxCoordinatorCalls: 1 },
        container_expand: { maxDuration: 50, maxMemoryGrowth: 5, maxCoordinatorCalls: 1 },
        container_collapse: { maxDuration: 50, maxMemoryGrowth: 5, maxCoordinatorCalls: 1 },
        container_batch: { maxDuration: 200, maxMemoryGrowth: 20, maxCoordinatorCalls: 0 },
        panel_toggle: { maxDuration: 30, maxMemoryGrowth: 2, maxCoordinatorCalls: 0 },
        panel_expand: { maxDuration: 30, maxMemoryGrowth: 2, maxCoordinatorCalls: 0 },
        panel_collapse: { maxDuration: 30, maxMemoryGrowth: 2, maxCoordinatorCalls: 0 },
        panel_batch: { maxDuration: 100, maxMemoryGrowth: 10, maxCoordinatorCalls: 0 },
        style_layout: { maxDuration: 100, maxMemoryGrowth: 5, maxCoordinatorCalls: 0 },
        style_color_palette: { maxDuration: 50, maxMemoryGrowth: 2, maxCoordinatorCalls: 0 },
        style_edge_style: { maxDuration: 50, maxMemoryGrowth: 2, maxCoordinatorCalls: 0 },
        style_reset: { maxDuration: 100, maxMemoryGrowth: 5, maxCoordinatorCalls: 0 },
        style_batch: { maxDuration: 200, maxMemoryGrowth: 15, maxCoordinatorCalls: 0 },
        search_clear: { maxDuration: 30, maxMemoryGrowth: 1, maxCoordinatorCalls: 0 },
        search_panel_clear: { maxDuration: 20, maxMemoryGrowth: 1, maxCoordinatorCalls: 0 },
      },
      ...config,
    };
  }

  /**
   * Start monitoring an operation
   */
  startOperation(operation: OperationType, metadata?: Record<string, any>): void {
    if (!this.config.enabled) return;

    // Reset counters for this operation
    this.coordinatorCallCount = 0;
    this.domUpdateCount = 0;

    // Start profiling
    globalProfiler.startOperation(`operation_${operation}`, metadata);

    if (this.config.debugLogging) {
      console.log(`[OperationPerformanceMonitor] Started monitoring: ${operation}`, metadata);
    }
  }

  /**
   * End monitoring an operation and record metrics
   */
  endOperation(operation: OperationType, metadata?: Record<string, any>): OperationMetrics | null {
    if (!this.config.enabled) return null;

    // End profiling
    const profilerMetrics = globalProfiler.endOperation(metadata);
    if (!profilerMetrics) return null;

    // Calculate cascade risk
    const cascadeRisk = this.calculateCascadeRisk(operation);

    // Create operation metrics
    const operationMetrics: OperationMetrics = {
      operation,
      duration: profilerMetrics.duration,
      memoryUsage: {
        before: profilerMetrics.memoryUsage.before,
        after: profilerMetrics.memoryUsage.after,
        growth: profilerMetrics.memoryUsage.growth,
      },
      cascadeRisk,
      coordinatorCalls: this.coordinatorCallCount,
      domUpdates: this.domUpdateCount,
      timestamp: Date.now(),
      metadata: { ...profilerMetrics.metadata, ...metadata },
    };

    // Record in history
    this.operationHistory.push(operationMetrics);
    
    // Keep only recent history (last 100 operations)
    if (this.operationHistory.length > 100) {
      this.operationHistory.shift();
    }

    // Update cascade detection buffer
    if (this.config.trackCascades) {
      this.updateCascadeBuffer(operation, operationMetrics.duration);
    }

    // Record metrics in global performance monitor
    recordPerformanceMetric('OperationMonitor', `${operation}_duration`, operationMetrics.duration);
    recordPerformanceMetric('OperationMonitor', `${operation}_memory_growth`, operationMetrics.memoryUsage.growth);
    recordPerformanceMetric('OperationMonitor', `${operation}_coordinator_calls`, operationMetrics.coordinatorCalls);

    // Check thresholds and generate alerts
    this.checkOperationThresholds(operationMetrics);

    // Detect cascades
    if (this.config.trackCascades) {
      const cascadeDetection = this.detectCascades();
      if (cascadeDetection.detected && this.config.alertOnCascades) {
        this.alertCascadeDetected(cascadeDetection);
      }
    }

    if (this.config.debugLogging) {
      console.log(`[OperationPerformanceMonitor] Completed monitoring: ${operation}`, {
        duration: operationMetrics.duration.toFixed(2) + 'ms',
        memoryGrowth: operationMetrics.memoryUsage.growth.toFixed(2) + 'MB',
        cascadeRisk: operationMetrics.cascadeRisk,
        coordinatorCalls: operationMetrics.coordinatorCalls,
      });
    }

    return operationMetrics;
  }

  /**
   * Record a coordinator call during operation monitoring
   */
  recordCoordinatorCall(): void {
    if (!this.config.enabled) return;
    this.coordinatorCallCount++;
  }

  /**
   * Record a DOM update during operation monitoring
   */
  recordDOMUpdate(): void {
    if (!this.config.enabled) return;
    this.domUpdateCount++;
  }

  /**
   * Calculate cascade risk based on operation type and context
   */
  private calculateCascadeRisk(operation: OperationType): 'low' | 'medium' | 'high' {
    // Operations that directly manipulate AsyncCoordinator are high risk
    if (operation.startsWith('container_') && this.coordinatorCallCount > 0) {
      return 'high';
    }

    // Batch operations with multiple coordinator calls are high risk
    if (operation.includes('batch') && this.coordinatorCallCount > 2) {
      return 'high';
    }

    // Style operations that trigger layout are medium risk
    if (operation === 'style_layout' || operation === 'style_reset') {
      return 'medium';
    }

    // Panel operations are generally low risk
    if (operation.startsWith('panel_') || operation.startsWith('search_')) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Update cascade detection buffer
   */
  private updateCascadeBuffer(operation: OperationType, duration: number): void {
    const now = Date.now();
    
    // Add current operation
    this.cascadeDetectionBuffer.push({
      operation,
      timestamp: now,
      duration,
    });

    // Remove operations outside the detection window
    const windowStart = now - this.config.cascadeDetectionWindow;
    this.cascadeDetectionBuffer = this.cascadeDetectionBuffer.filter(
      op => op.timestamp >= windowStart
    );
  }

  /**
   * Detect coordination cascades
   */
  private detectCascades(): CascadeDetection {
    const operations = [...this.cascadeDetectionBuffer];
    const cascadeCount = operations.length;
    const detected = cascadeCount >= this.config.maxCascadeOperations;

    const recommendations: string[] = [];
    if (detected) {
      recommendations.push('Consider batching multiple operations together');
      recommendations.push('Use debouncing for rapid user interactions');
      recommendations.push('Avoid triggering AsyncCoordinator during UI operations');
      
      // Specific recommendations based on operation types
      const operationTypes = new Set(operations.map(op => op.operation));
      if (operationTypes.has('container_toggle') || operationTypes.has('container_expand') || operationTypes.has('container_collapse')) {
        recommendations.push('Use batchContainerOperationsImperatively() for multiple container operations');
      }
      if (operationTypes.has('style_layout') || operationTypes.has('style_color_palette') || operationTypes.has('style_edge_style')) {
        recommendations.push('Use batchStyleOperationsImperatively() for multiple style changes');
      }
    }

    return {
      detected,
      cascadeCount,
      operations,
      recommendations,
    };
  }

  /**
   * Check operation thresholds and generate alerts
   */
  private checkOperationThresholds(metrics: OperationMetrics): void {
    const thresholds = this.config.thresholds[metrics.operation];
    if (!thresholds) return;

    const violations: string[] = [];

    if (metrics.duration > thresholds.maxDuration) {
      violations.push(`Duration ${metrics.duration.toFixed(2)}ms exceeds threshold ${thresholds.maxDuration}ms`);
    }

    if (metrics.memoryUsage.growth > thresholds.maxMemoryGrowth) {
      violations.push(`Memory growth ${metrics.memoryUsage.growth.toFixed(2)}MB exceeds threshold ${thresholds.maxMemoryGrowth}MB`);
    }

    if (metrics.coordinatorCalls > thresholds.maxCoordinatorCalls) {
      violations.push(`Coordinator calls ${metrics.coordinatorCalls} exceed threshold ${thresholds.maxCoordinatorCalls}`);
    }

    if (violations.length > 0) {
      console.warn(`🚨 Operation Performance Alert [${metrics.operation}]:`, violations);
      
      // Record alert in global performance monitor
      recordPerformanceMetric('OperationMonitor', `${metrics.operation}_threshold_violations`, violations.length);
    }
  }

  /**
   * Alert when cascade is detected
   */
  private alertCascadeDetected(cascade: CascadeDetection): void {
    console.warn(`🚨 Coordination Cascade Detected:`, {
      operationCount: cascade.cascadeCount,
      window: this.config.cascadeDetectionWindow + 'ms',
      operations: cascade.operations.map(op => op.operation),
    });

    if (cascade.recommendations.length > 0) {
      console.warn('💡 Cascade Prevention Recommendations:', cascade.recommendations);
    }

    // Record cascade in global performance monitor
    recordPerformanceMetric('OperationMonitor', 'cascade_detected', cascade.cascadeCount);
  }

  /**
   * Get operation history
   */
  getOperationHistory(operation?: OperationType): OperationMetrics[] {
    if (operation) {
      return this.operationHistory.filter(metrics => metrics.operation === operation);
    }
    return [...this.operationHistory];
  }

  /**
   * Get cascade detection status
   */
  getCascadeDetection(): CascadeDetection {
    return this.detectCascades();
  }

  /**
   * Generate performance report for operations
   */
  generateOperationReport(): string {
    const recentOperations = this.operationHistory.slice(-20);
    const cascadeDetection = this.detectCascades();

    let report = "# Operation Performance Report\n\n";
    report += `**Generated:** ${new Date().toISOString()}\n\n`;

    // Cascade status
    report += "## Cascade Detection\n\n";
    if (cascadeDetection.detected) {
      report += `⚠️ **Cascade Detected**: ${cascadeDetection.cascadeCount} operations in ${this.config.cascadeDetectionWindow}ms window\n\n`;
      report += "**Operations in cascade:**\n";
      cascadeDetection.operations.forEach(op => {
        report += `- ${op.operation} (${op.duration.toFixed(2)}ms)\n`;
      });
      report += "\n**Recommendations:**\n";
      cascadeDetection.recommendations.forEach(rec => {
        report += `- ${rec}\n`;
      });
      report += "\n";
    } else {
      report += "✅ **No cascades detected**\n\n";
    }

    // Recent operations
    report += "## Recent Operations\n\n";
    if (recentOperations.length > 0) {
      recentOperations.forEach(metrics => {
        const riskIcon = metrics.cascadeRisk === 'high' ? '🔴' : metrics.cascadeRisk === 'medium' ? '🟡' : '🟢';
        report += `- **${metrics.operation}** ${riskIcon}: ${metrics.duration.toFixed(2)}ms, ${metrics.memoryUsage.growth.toFixed(2)}MB growth, ${metrics.coordinatorCalls} coordinator calls\n`;
      });
    } else {
      report += "No recent operations recorded.\n";
    }

    return report;
  }

  /**
   * Clear operation history and cascade buffer
   */
  clear(): void {
    this.operationHistory = [];
    this.cascadeDetectionBuffer = [];
    this.coordinatorCallCount = 0;
    this.domUpdateCount = 0;
  }
}

// Global operation performance monitor instance
export const globalOperationMonitor = new OperationPerformanceMonitor();

/**
 * Utility function to monitor an operation with automatic start/end
 */
export function monitorOperation<T>(
  operation: OperationType,
  fn: () => T,
  metadata?: Record<string, any>
): T {
  globalOperationMonitor.startOperation(operation, metadata);
  try {
    const result = fn();
    globalOperationMonitor.endOperation(operation, metadata);
    return result;
  } catch (error) {
    globalOperationMonitor.endOperation(operation, { 
      ...metadata, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    throw error;
  }
}

/**
 * Utility function to monitor an async operation with automatic start/end
 */
export async function monitorAsyncOperation<T>(
  operation: OperationType,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  globalOperationMonitor.startOperation(operation, metadata);
  try {
    const result = await fn();
    globalOperationMonitor.endOperation(operation, metadata);
    return result;
  } catch (error) {
    globalOperationMonitor.endOperation(operation, { 
      ...metadata, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    throw error;
  }
}

/**
 * Decorator for automatic operation performance monitoring
 */
export function monitorOperationPerformance(operation: OperationType, metadata?: Record<string, any>) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      return monitorOperation(operation, () => originalMethod.apply(this, args), metadata);
    };

    return descriptor;
  };
}

/**
 * Record coordinator call for cascade detection
 */
export function recordCoordinatorCall(): void {
  globalOperationMonitor.recordCoordinatorCall();
}

/**
 * Record DOM update for performance tracking
 */
export function recordDOMUpdate(): void {
  globalOperationMonitor.recordDOMUpdate();
}

/**
 * Utility to measure and compare operation performance
 */
export function measureOperationPerformance<T>(
  operation: OperationType,
  fn: () => T,
  metadata?: Record<string, any>
): { result: T; metrics: OperationMetrics | null } {
  const result = monitorOperation(operation, fn, metadata);
  const history = globalOperationMonitor.getOperationHistory(operation);
  const metrics = history[history.length - 1] || null;
  return { result, metrics };
}

/**
 * Utility to measure and compare async operation performance
 */
export async function measureAsyncOperationPerformance<T>(
  operation: OperationType,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<{ result: T; metrics: OperationMetrics | null }> {
  const result = await monitorAsyncOperation(operation, fn, metadata);
  const history = globalOperationMonitor.getOperationHistory(operation);
  const metrics = history[history.length - 1] || null;
  return { result, metrics };
}