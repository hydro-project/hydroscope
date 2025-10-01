/**
 * Performance Profiler for Hydroscope Components
 * Provides detailed profiling and optimization recommendations
 */

export interface ProfileResult {
  operation: string;
  duration: number;
  memoryUsage: {
    before: number;
    after: number;
    peak: number;
    growth: number;
  };
  metadata?: Record<string, any>;
  recommendations?: string[];
}

export interface ProfileSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  results: ProfileResult[];
  summary?: {
    totalDuration: number;
    totalMemoryGrowth: number;
    bottlenecks: string[];
    optimizations: string[];
  };
}

export class ComponentProfiler {
  private sessions = new Map<string, ProfileSession>();
  private currentSession: ProfileSession | null = null;
  private operationStack: Array<{
    name: string;
    startTime: number;
    startMemory: number;
  }> = [];

  startSession(sessionId: string): void {
    const session: ProfileSession = {
      sessionId,
      startTime: performance.now(),
      results: [],
    };

    this.sessions.set(sessionId, session);
    this.currentSession = session;
  }

  endSession(sessionId: string): ProfileSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.endTime = performance.now();
    session.summary = this.generateSummary(session);

    if (this.currentSession?.sessionId === sessionId) {
      this.currentSession = null;
    }

    return session;
  }

  startOperation(operationName: string, _metadata?: Record<string, any>): void {
    if (!this.currentSession) {
      throw new Error("No active profiling session");
    }

    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    this.operationStack.push({
      name: operationName,
      startTime,
      startMemory,
    });
  }

  endOperation(metadata?: Record<string, any>): ProfileResult | null {
    if (!this.currentSession || this.operationStack.length === 0) {
      return null;
    }

    const operation = this.operationStack.pop()!;
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;

    const result: ProfileResult = {
      operation: operation.name,
      duration: endTime - operation.startTime,
      memoryUsage: {
        before: operation.startMemory / 1024 / 1024, // MB
        after: endMemory / 1024 / 1024, // MB
        peak: endMemory / 1024 / 1024, // Simplified - could track actual peak
        growth: (endMemory - operation.startMemory) / 1024 / 1024, // MB
      },
      metadata,
      recommendations: this.generateRecommendations(
        operation.name,
        endTime - operation.startTime,
        endMemory - operation.startMemory,
      ),
    };

    this.currentSession.results.push(result);
    return result;
  }

  getSession(sessionId: string): ProfileSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): ProfileSession[] {
    return Array.from(this.sessions.values());
  }

  private generateRecommendations(
    operationName: string,
    duration: number,
    memoryGrowth: number,
  ): string[] {
    const recommendations: string[] = [];

    // Duration-based recommendations
    if (duration > 100) {
      recommendations.push(
        `Operation ${operationName} took ${duration.toFixed(2)}ms - consider optimization`,
      );

      if (operationName.includes("search")) {
        recommendations.push(
          "Consider implementing search result caching or indexing",
        );
      }

      if (operationName.includes("elk") || operationName.includes("layout")) {
        recommendations.push(
          "Consider layout result caching for unchanged graphs",
        );
      }

      if (
        operationName.includes("reactflow") ||
        operationName.includes("render")
      ) {
        recommendations.push(
          "Consider memoization of ReactFlow node/edge generation",
        );
      }
    }

    // Memory-based recommendations
    if (memoryGrowth > 10) {
      // 10MB growth
      recommendations.push(
        `Operation ${operationName} used ${memoryGrowth.toFixed(2)}MB - check for memory leaks`,
      );

      if (operationName.includes("parse")) {
        recommendations.push("Consider streaming parsing for large datasets");
      }

      if (operationName.includes("container")) {
        recommendations.push("Consider lazy loading of container contents");
      }
    }

    return recommendations;
  }

  private generateSummary(session: ProfileSession): ProfileSession["summary"] {
    const totalDuration = session.results.reduce(
      (sum, r) => sum + r.duration,
      0,
    );
    const totalMemoryGrowth = session.results.reduce(
      (sum, r) => sum + r.memoryUsage.growth,
      0,
    );

    // Find bottlenecks (operations taking >20% of total time)
    const bottlenecks = session.results
      .filter((r) => r.duration > totalDuration * 0.2)
      .map((r) => r.operation);

    // Collect all recommendations
    const optimizations = session.results
      .flatMap((r) => r.recommendations || [])
      .filter((rec, index, arr) => arr.indexOf(rec) === index); // Deduplicate

    return {
      totalDuration,
      totalMemoryGrowth,
      bottlenecks,
      optimizations,
    };
  }
}

// Global profiler instance
export const globalProfiler = new ComponentProfiler();

// Decorator for automatic profiling
export function profile(operationName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const profileName =
      operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = function (...args: any[]) {
      globalProfiler.startOperation(profileName, { args: args.length });

      try {
        const result = originalMethod.apply(this, args);

        // Handle async methods
        if (result && typeof result.then === "function") {
          return result.finally(() => {
            globalProfiler.endOperation();
          });
        } else {
          globalProfiler.endOperation();
          return result;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        globalProfiler.endOperation({ error: errorMessage });
        throw error;
      }
    };

    return descriptor;
  };
}

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
