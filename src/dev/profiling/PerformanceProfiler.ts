/**
 * Performance Profiler for Hydroscope
 *
 * Provides detailed timing and memory profiling for large file rendering performance.
 * Designed to help identify bottlenecks when loading large JSON files like paxos.json.
 */

export interface PerformanceMetrics {
  duration: number;
  memoryUsed?: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ProfilerReport {
  totalDuration: number;
  stages: Record<string, PerformanceMetrics>;
  memoryPeak: number;
  recommendations: string[];
}

export class PerformanceProfiler {
  private static instance: PerformanceProfiler | null = null;
  private stages = new Map<string, PerformanceMetrics>();
  private startTimes = new Map<string, number>();
  private enabled = true;
  private startMemory = 0;
  private peakMemory = 0;

  private constructor() {
    // Initialize memory tracking if available
    if ((performance as any).memory) {
      this.startMemory = (performance as any).memory.usedJSHeapSize;
      this.peakMemory = this.startMemory;
    }
  }

  public static getInstance(): PerformanceProfiler {
    if (!PerformanceProfiler.instance) {
      PerformanceProfiler.instance = new PerformanceProfiler();
    }
    return PerformanceProfiler.instance;
  }

  // TypeScript function overloads
  // eslint-disable-next-line no-dupe-class-members
  public static profile<T>(stageName: string, operation: () => T): T;
  // eslint-disable-next-line no-dupe-class-members
  public static profile<T>(stageName: string, operation: () => Promise<T>): Promise<T>;
  // eslint-disable-next-line no-dupe-class-members
  public static profile<T>(stageName: string, operation: () => T | Promise<T>): T | Promise<T> {
    const profiler = PerformanceProfiler.getInstance();

    profiler.start(stageName);
    try {
      const result = operation();

      if (result instanceof Promise) {
        return result.finally(() => profiler.end(stageName));
      } else {
        profiler.end(stageName);
        return result;
      }
    } catch (error) {
      profiler.end(stageName);
      throw error;
    }
  }

  public enable(): void {
    this.enabled = true;
  }

  public disable(): void {
    this.enabled = false;
  }

  public start(stageName: string): void {
    if (!this.enabled) return;

    this.startTimes.set(stageName, performance.now());
    console.time(`📊 ${stageName}`);
  }

  public end(stageName: string, metadata?: Record<string, any>): PerformanceMetrics | null {
    if (!this.enabled) return null;

    const startTime = this.startTimes.get(stageName);
    if (!startTime) {
      console.warn(`Performance profiler: No start time found for stage "${stageName}"`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Track memory if available
    let memoryUsed: number | undefined;
    if ((performance as any).memory) {
      memoryUsed = (performance as any).memory.usedJSHeapSize;
      if (memoryUsed !== undefined) {
        this.peakMemory = Math.max(this.peakMemory, memoryUsed);
      }
    }

    const metrics: PerformanceMetrics = {
      duration,
      memoryUsed,
      timestamp: endTime,
      metadata,
    };

    this.stages.set(stageName, metrics);
    this.startTimes.delete(stageName);

    console.timeEnd(`📊 ${stageName}`);
    console.log(
      `⏱️  ${stageName}: ${duration.toFixed(2)}ms${memoryUsed ? ` (${this.formatMemory(memoryUsed)})` : ''}`
    );

    return metrics;
  }

  public getStageMetrics(stageName: string): PerformanceMetrics | undefined {
    return this.stages.get(stageName);
  }

  public getAllMetrics(): Record<string, PerformanceMetrics> {
    return Object.fromEntries(this.stages.entries());
  }

  public generateReport(): ProfilerReport {
    const stages = this.getAllMetrics();
    const totalDuration = Object.values(stages).reduce((sum, stage) => sum + stage.duration, 0);

    const recommendations: string[] = [];

    // Analyze performance and generate recommendations
    const fileLoadTime = stages['File Loading']?.duration || 0;
    const jsonParseTime = stages['JSON Parsing']?.duration || 0;
    const stateCreationTime = stages['State Creation']?.duration || 0;
    const renderingTime = stages['Rendering']?.duration || 0;
    const layoutTime = stages['Layout Calculation']?.duration || 0;

    if (fileLoadTime > 1000) {
      recommendations.push(
        'File loading is slow (>1s). Consider file size optimization or streaming.'
      );
    }

    if (jsonParseTime > 2000) {
      recommendations.push('JSON parsing is slow (>2s). Consider data structure optimization.');
    }

    if (stateCreationTime > 3000) {
      recommendations.push(
        'State creation is slow (>3s). Consider batching operations or lazy loading.'
      );
    }

    if (renderingTime > 5000) {
      recommendations.push(
        'Rendering is slow (>5s). Consider virtualization or progressive rendering.'
      );
    }

    if (layoutTime > 3000) {
      recommendations.push(
        'Layout calculation is slow (>3s). Consider layout algorithm optimization.'
      );
    }

    if (this.peakMemory - this.startMemory > 500 * 1024 * 1024) {
      // 500MB
      recommendations.push('High memory usage detected. Consider memory optimization strategies.');
    }

    return {
      totalDuration,
      stages,
      memoryPeak: this.peakMemory,
      recommendations,
    };
  }

  public printReport(): void {
    const report = this.generateReport();

    console.group('🎯 Performance Report');
    console.log(`📈 Total Duration: ${report.totalDuration.toFixed(2)}ms`);
    console.log(`💾 Peak Memory: ${this.formatMemory(report.memoryPeak)}`);

    console.group('⏱️ Stage Breakdown:');
    Object.entries(report.stages).forEach(([stage, metrics]) => {
      const percentage = ((metrics.duration / report.totalDuration) * 100).toFixed(1);
      console.log(`  ${stage}: ${metrics.duration.toFixed(2)}ms (${percentage}%)`);
      if (metrics.metadata) {
        console.log(`    Metadata:`, metrics.metadata);
      }
    });
    console.groupEnd();

    if (report.recommendations.length > 0) {
      console.group('💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`  • ${rec}`));
      console.groupEnd();
    }

    console.groupEnd();
  }

  public reset(): void {
    this.stages.clear();
    this.startTimes.clear();
    if ((performance as any).memory) {
      this.startMemory = (performance as any).memory.usedJSHeapSize;
      this.peakMemory = this.startMemory;
    }
  }

  private formatMemory(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)}MB`;
  }

  public markLargeFileProcessing(fileSize: number): void {
    if (fileSize > 1024 * 1024) {
      // 1MB
      console.log(`🚨 Large file detected: ${this.formatMemory(fileSize)}`);
      console.log('📊 Detailed performance tracking enabled');
    }
  }
}

// Utility functions for easy profiling
// eslint-disable-next-line no-redeclare
export function profileStage<T>(stageName: string, operation: () => T): T;
// eslint-disable-next-line no-redeclare
export function profileStage<T>(stageName: string, operation: () => Promise<T>): Promise<T>;
// eslint-disable-next-line no-redeclare
export function profileStage<T>(
  stageName: string,
  operation: () => T | Promise<T>
): T | Promise<T> {
  return PerformanceProfiler.profile(stageName, operation);
}

export function startProfiling(): void {
  PerformanceProfiler.getInstance().reset();
}

export function getProfilerReport(): ProfilerReport {
  return PerformanceProfiler.getInstance().generateReport();
}

export function printProfilerReport(): void {
  PerformanceProfiler.getInstance().printReport();
}
