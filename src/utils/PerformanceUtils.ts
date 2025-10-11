/**
 * Performance Utilities for Hydroscope
 * Provides timing, memory monitoring, and performance analysis tools
 */
export interface PerformanceMetrics {
  duration: number;
  memoryUsage: {
    initial: number;
    peak: number;
    final: number;
    growth: number;
  };
  operationCount?: number;
  throughput?: number; // operations per second
}
export interface PerformanceThresholds {
  maxDuration: number;
  maxMemoryGrowth: number;
  minThroughput?: number;
}
export class PerformanceProfiler {
  private startTime: number = 0;
  private endTime: number = 0;
  private initialMemory: number = 0;
  private peakMemory: number = 0;
  private finalMemory: number = 0;
  private memorySnapshots: number[] = [];
  private operationCount: number = 0;
  private isRunning: boolean = false;
  start(): void {
    if (this.isRunning) {
      throw new Error("Profiler is already running");
    }
    this.reset();
    this.startTime = performance.now();
    this.initialMemory = this.getCurrentMemoryUsage();
    this.peakMemory = this.initialMemory;
    this.isRunning = true;
    // Take initial snapshot
    this.takeMemorySnapshot();
  }
  stop(): PerformanceMetrics {
    if (!this.isRunning) {
      throw new Error("Profiler is not running");
    }
    this.endTime = performance.now();
    this.finalMemory = this.getCurrentMemoryUsage();
    this.isRunning = false;
    const duration = this.endTime - this.startTime;
    const memoryGrowth = this.finalMemory - this.initialMemory;
    const throughput =
      this.operationCount > 0
        ? (this.operationCount / duration) * 1000
        : undefined;
    return {
      duration,
      memoryUsage: {
        initial: this.initialMemory / 1024 / 1024, // Convert to MB
        peak: this.peakMemory / 1024 / 1024,
        final: this.finalMemory / 1024 / 1024,
        growth: memoryGrowth / 1024 / 1024,
      },
      operationCount: this.operationCount,
      throughput,
    };
  }
  incrementOperationCount(count: number = 1): void {
    this.operationCount += count;
    this.takeMemorySnapshot();
  }
  takeMemorySnapshot(): void {
    const currentMemory = this.getCurrentMemoryUsage();
    this.memorySnapshots.push(currentMemory);
    if (currentMemory > this.peakMemory) {
      this.peakMemory = currentMemory;
    }
  }
  private getCurrentMemoryUsage(): number {
    return process.memoryUsage().heapUsed;
  }
  private reset(): void {
    this.startTime = 0;
    this.endTime = 0;
    this.initialMemory = 0;
    this.peakMemory = 0;
    this.finalMemory = 0;
    this.memorySnapshots = [];
    this.operationCount = 0;
  }
  getMemorySnapshots(): number[] {
    return [...this.memorySnapshots];
  }
}
export class PerformanceAnalyzer {
  static analyzeMetrics(
    metrics: PerformanceMetrics,
    thresholds: PerformanceThresholds,
  ): {
    passed: boolean;
    violations: string[];
    summary: string;
  } {
    const violations: string[] = [];
    if (metrics.duration > thresholds.maxDuration) {
      violations.push(
        `Duration ${metrics.duration.toFixed(2)}ms exceeds threshold ${thresholds.maxDuration}ms`,
      );
    }
    if (metrics.memoryUsage.growth > thresholds.maxMemoryGrowth) {
      violations.push(
        `Memory growth ${metrics.memoryUsage.growth.toFixed(2)}MB exceeds threshold ${thresholds.maxMemoryGrowth}MB`,
      );
    }
    if (
      thresholds.minThroughput &&
      metrics.throughput &&
      metrics.throughput < thresholds.minThroughput
    ) {
      violations.push(
        `Throughput ${metrics.throughput.toFixed(2)} ops/sec below threshold ${thresholds.minThroughput} ops/sec`,
      );
    }
    const passed = violations.length === 0;
    const summary = `Duration: ${metrics.duration.toFixed(2)}ms, Memory: ${metrics.memoryUsage.growth.toFixed(2)}MB growth, Peak: ${metrics.memoryUsage.peak.toFixed(2)}MB${metrics.throughput ? `, Throughput: ${metrics.throughput.toFixed(2)} ops/sec` : ""}`;
    return { passed, violations, summary };
  }
  static compareMetrics(
    baseline: PerformanceMetrics,
    current: PerformanceMetrics,
  ): {
    durationChange: number;
    memoryChange: number;
    throughputChange?: number;
    regression: boolean;
  } {
    const durationChange =
      ((current.duration - baseline.duration) / baseline.duration) * 100;
    const memoryChange =
      ((current.memoryUsage.growth - baseline.memoryUsage.growth) /
        baseline.memoryUsage.growth) *
      100;
    let throughputChange: number | undefined;
    if (baseline.throughput && current.throughput) {
      throughputChange =
        ((current.throughput - baseline.throughput) / baseline.throughput) *
        100;
    }
    // Consider it a regression if duration increased by >10% or memory by >20%
    const regression =
      durationChange > 10 ||
      memoryChange > 20 ||
      (throughputChange !== undefined && throughputChange < -10);
    return {
      durationChange,
      memoryChange,
      throughputChange,
      regression,
    };
  }
}
export class BatchPerformanceTester {
  private results: Map<string, PerformanceMetrics[]> = new Map();
  async runTest<T>(
    testName: string,
    testFunction: () => T | Promise<T>,
    iterations: number = 1,
    warmupIterations: number = 0,
  ): Promise<{
    results: PerformanceMetrics[];
    average: PerformanceMetrics;
    median: PerformanceMetrics;
    min: PerformanceMetrics;
    max: PerformanceMetrics;
  }> {
    const profiler = new PerformanceProfiler();
    const results: PerformanceMetrics[] = [];
    // Warmup iterations (not recorded)
    for (let i = 0; i < warmupIterations; i++) {
      await testFunction();
    }
    // Actual test iterations
    for (let i = 0; i < iterations; i++) {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      profiler.start();
      await testFunction();
      const metrics = profiler.stop();
      results.push(metrics);
    }
    this.results.set(testName, results);
    return {
      results,
      average: this.calculateAverage(results),
      median: this.calculateMedian(results),
      min: this.calculateMin(results),
      max: this.calculateMax(results),
    };
  }
  getTestResults(testName: string): PerformanceMetrics[] | undefined {
    return this.results.get(testName);
  }
  getAllResults(): Map<string, PerformanceMetrics[]> {
    return new Map(this.results);
  }
  private calculateAverage(results: PerformanceMetrics[]): PerformanceMetrics {
    const count = results.length;
    return {
      duration: results.reduce((sum, r) => sum + r.duration, 0) / count,
      memoryUsage: {
        initial:
          results.reduce((sum, r) => sum + r.memoryUsage.initial, 0) / count,
        peak: results.reduce((sum, r) => sum + r.memoryUsage.peak, 0) / count,
        final: results.reduce((sum, r) => sum + r.memoryUsage.final, 0) / count,
        growth:
          results.reduce((sum, r) => sum + r.memoryUsage.growth, 0) / count,
      },
      operationCount: results[0].operationCount,
      throughput: results[0].throughput
        ? results.reduce((sum, r) => sum + (r.throughput || 0), 0) / count
        : undefined,
    };
  }
  private calculateMedian(results: PerformanceMetrics[]): PerformanceMetrics {
    const sorted = [...results].sort((a, b) => a.duration - b.duration);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? this.calculateAverage([sorted[mid - 1], sorted[mid]])
      : sorted[mid];
  }
  private calculateMin(results: PerformanceMetrics[]): PerformanceMetrics {
    return results.reduce((min, current) =>
      current.duration < min.duration ? current : min,
    );
  }
  private calculateMax(results: PerformanceMetrics[]): PerformanceMetrics {
    return results.reduce((max, current) =>
      current.duration > max.duration ? current : max,
    );
  }
}
// Utility functions for common performance testing scenarios
export function measureAsync<T>(fn: () => Promise<T>): Promise<{
  result: T;
  metrics: PerformanceMetrics;
}> {
  const profiler = new PerformanceProfiler();
  return (async () => {
    profiler.start();
    const result = await fn();
    const metrics = profiler.stop();
    return { result, metrics };
  })();
}
export function measureSync<T>(fn: () => T): {
  result: T;
  metrics: PerformanceMetrics;
} {
  const profiler = new PerformanceProfiler();
  profiler.start();
  const result = fn();
  const metrics = profiler.stop();
  return { result, metrics };
}
export function createPerformanceReport(
  testName: string,
  metrics: PerformanceMetrics,
  thresholds?: PerformanceThresholds,
): string {
  let report = `Performance Report: ${testName}\n`;
  report += `Duration: ${metrics.duration.toFixed(2)}ms\n`;
  report += `Memory Usage:\n`;
  report += `  Initial: ${metrics.memoryUsage.initial.toFixed(2)}MB\n`;
  report += `  Peak: ${metrics.memoryUsage.peak.toFixed(2)}MB\n`;
  report += `  Final: ${metrics.memoryUsage.final.toFixed(2)}MB\n`;
  report += `  Growth: ${metrics.memoryUsage.growth.toFixed(2)}MB\n`;
  if (metrics.operationCount) {
    report += `Operations: ${metrics.operationCount}\n`;
  }
  if (metrics.throughput) {
    report += `Throughput: ${metrics.throughput.toFixed(2)} ops/sec\n`;
  }
  if (thresholds) {
    const analysis = PerformanceAnalyzer.analyzeMetrics(metrics, thresholds);
    report += `\nThreshold Analysis: ${analysis.passed ? "PASSED" : "FAILED"}\n`;
    if (analysis.violations.length > 0) {
      report += `Violations:\n${analysis.violations.map((v) => `  - ${v}`).join("\n")}\n`;
    }
  }
  return report;
}
