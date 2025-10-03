/**
 * Performance Metrics for Hydroscope
 * Provides performance measurement without visual profiling components
 */

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  memoryUsage: {
    before: number;
    after: number;
    peak: number;
    growth: number;
  };
  metadata?: Record<string, any>;
}

export class PerformanceProfiler {
  private operationStack: Array<{
    name: string;
    startTime: number;
    startMemory: number;
  }> = [];

  startOperation(operationName: string, _metadata?: Record<string, any>): void {
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    this.operationStack.push({
      name: operationName,
      startTime,
      startMemory,
    });
  }

  endOperation(metadata?: Record<string, any>): PerformanceMetrics | null {
    if (this.operationStack.length === 0) {
      return null;
    }

    const operation = this.operationStack.pop()!;
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;

    return {
      operation: operation.name,
      duration: endTime - operation.startTime,
      memoryUsage: {
        before: operation.startMemory / 1024 / 1024, // MB
        after: endMemory / 1024 / 1024, // MB
        peak: endMemory / 1024 / 1024, // Simplified - could track actual peak
        growth: (endMemory - operation.startMemory) / 1024 / 1024, // MB
      },
      metadata,
    };
  }
}

// Global profiler instance
export const globalProfiler = new PerformanceProfiler();

// Utility function for manual profiling
export function profileFunction<T>(
  operationName: string,
  fn: () => T,
  metadata?: Record<string, any>,
): T {
  globalProfiler.startOperation(operationName, metadata);

  try {
    const result = fn();
    globalProfiler.endOperation();
    return result;
  } catch (error) {
    globalProfiler.endOperation({
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

export async function profileAsyncFunction<T>(
  operationName: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>,
): Promise<T> {
  globalProfiler.startOperation(operationName, metadata);

  try {
    const result = await fn();
    globalProfiler.endOperation();
    return result;
  } catch (error) {
    globalProfiler.endOperation({
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
