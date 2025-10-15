/**
 * ValidationMetrics - Validation and performance tracking
 */

export class ValidationMetrics {
  private _validationEnabled = true;
  private _validationInProgress = false;
  private _performanceMetrics = {
    operationCounts: new Map<string, number>(),
    operationTimes: new Map<string, number[]>(),
    lastOptimization: Date.now(),
  };

  // Validation state
  isValidationEnabled(): boolean {
    return this._validationEnabled;
  }

  setValidationEnabled(enabled: boolean): void {
    this._validationEnabled = enabled;
  }

  isValidationInProgress(): boolean {
    return this._validationInProgress;
  }

  setValidationInProgress(inProgress: boolean): void {
    this._validationInProgress = inProgress;
  }

  // Performance tracking
  trackOperation(operationName: string, duration: number): void {
    // Track operation count
    const count = this._performanceMetrics.operationCounts.get(operationName) || 0;
    this._performanceMetrics.operationCounts.set(operationName, count + 1);

    // Track operation times (keep last 10 for average calculation)
    const times = this._performanceMetrics.operationTimes.get(operationName) || [];
    times.push(duration);
    if (times.length > 10) {
      times.shift();
    }
    this._performanceMetrics.operationTimes.set(operationName, times);
  }

  getPerformanceMetrics(): {
    operations: Map<string, { count: number; avgTime: number }>;
    lastOptimization: number;
  } {
    const operations = new Map<string, { count: number; avgTime: number }>();

    for (const [name, count] of this._performanceMetrics.operationCounts) {
      const times = this._performanceMetrics.operationTimes.get(name) || [];
      const avgTime = times.length > 0 
        ? times.reduce((a, b) => a + b, 0) / times.length 
        : 0;
      operations.set(name, { count, avgTime });
    }

    return {
      operations,
      lastOptimization: this._performanceMetrics.lastOptimization,
    };
  }

  resetPerformanceMetrics(): void {
    this._performanceMetrics.operationCounts.clear();
    this._performanceMetrics.operationTimes.clear();
    this._performanceMetrics.lastOptimization = Date.now();
  }

  clear(): void {
    this.resetPerformanceMetrics();
    this._validationEnabled = true;
    this._validationInProgress = false;
  }
}
