/**
 * Performance Monitor and Alerting System
 * Monitors performance metrics and provides alerts for bottlenecks
 */

export interface PerformanceAlert {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  component: string;
  metric: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: number;
  recommendations: string[];
}

export interface PerformanceThresholds {
  [component: string]: {
    [metric: string]: {
      warning: number;
      critical: number;
    };
  };
}

export interface MonitoringConfig {
  enabled: boolean;
  alertThresholds: PerformanceThresholds;
  samplingInterval: number; // milliseconds
  maxAlerts: number;
  alertCallback?: (alert: PerformanceAlert) => void;
}

export class PerformanceMonitor {
  private config: MonitoringConfig;
  private alerts: PerformanceAlert[] = [];
  private metrics = new Map<string, number[]>();
  private lastSample = Date.now();
  private monitoringInterval?: NodeJS.Timeout;

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      enabled: true,
      alertThresholds: {
        VisualizationState: {
          search_duration: { warning: 50, critical: 100 },
          container_operation_duration: { warning: 30, critical: 60 },
          memory_usage: { warning: 50, critical: 100 }, // MB
        },
        ELKBridge: {
          conversion_duration: { warning: 100, critical: 200 },
          layout_duration: { warning: 1000, critical: 2000 },
        },
        ReactFlowBridge: {
          conversion_duration: { warning: 150, critical: 300 },
          cache_miss_rate: { warning: 0.5, critical: 0.8 },
        },
        JSONParser: {
          parse_duration: { warning: 500, critical: 1000 },
          memory_growth: { warning: 20, critical: 50 }, // MB
        },
      },
      samplingInterval: 5000, // 5 seconds
      maxAlerts: 100,
      ...config,
    };

    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  recordMetric(component: string, metric: string, value: number): void {
    if (!this.config.enabled) return;

    const key = `${component}.${metric}`;
    const values = this.metrics.get(key) || [];
    values.push(value);

    // Keep only last 20 values for trend analysis
    if (values.length > 20) {
      values.shift();
    }

    this.metrics.set(key, values);
    this.checkThresholds(component, metric, value);
  }

  private checkThresholds(
    component: string,
    metric: string,
    value: number,
  ): void {
    const thresholds = this.config.alertThresholds[component]?.[metric];
    if (!thresholds) return;

    let severity: PerformanceAlert["severity"] | null = null;
    let threshold = 0;

    if (value >= thresholds.critical) {
      severity = "critical";
      threshold = thresholds.critical;
    } else if (value >= thresholds.warning) {
      severity = "medium";
      threshold = thresholds.warning;
    }

    if (severity) {
      this.createAlert(component, metric, value, threshold, severity);
    }
  }

  private createAlert(
    component: string,
    metric: string,
    value: number,
    threshold: number,
    severity: PerformanceAlert["severity"],
  ): void {
    const alert: PerformanceAlert = {
      id: `${component}_${metric}_${Date.now()}`,
      severity,
      component,
      metric,
      value,
      threshold,
      message: `${component} ${metric} (${value.toFixed(2)}) exceeded ${severity} threshold (${threshold})`,
      timestamp: Date.now(),
      recommendations: this.generateRecommendations(component, metric, value),
    };

    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > this.config.maxAlerts) {
      this.alerts.shift();
    }

    // Call alert callback if provided
    if (this.config.alertCallback) {
      this.config.alertCallback(alert);
    }

    console.warn(
      `🚨 Performance Alert [${severity.toUpperCase()}]: ${alert.message}`,
    );
    if (alert.recommendations.length > 0) {
      console.warn("💡 Recommendations:", alert.recommendations);
    }
  }

  private generateRecommendations(
    component: string,
    metric: string,
    value: number,
  ): string[] {
    const recommendations: string[] = [];

    switch (component) {
      case "VisualizationState":
        if (metric === "search_duration") {
          recommendations.push("Consider implementing search result caching");
          recommendations.push("Add search indexing for faster lookups");
          recommendations.push(
            "Implement debounced search to reduce frequency",
          );
        } else if (metric === "container_operation_duration") {
          recommendations.push("Consider lazy loading of container contents");
          recommendations.push("Implement container state caching");
          recommendations.push("Optimize edge aggregation algorithms");
        }
        break;

      case "ELKBridge":
        if (metric === "conversion_duration") {
          recommendations.push(
            "Enable ELK graph caching for unchanged layouts",
          );
          recommendations.push("Consider incremental layout updates");
        } else if (metric === "layout_duration") {
          recommendations.push("Reduce graph complexity before layout");
          recommendations.push("Use ELK performance hints and optimizations");
          recommendations.push("Consider layout algorithm alternatives");
        }
        break;

      case "ReactFlowBridge":
        if (metric === "conversion_duration") {
          recommendations.push("Increase ReactFlow node/edge caching");
          recommendations.push("Implement memoization for style calculations");
          recommendations.push("Consider virtual rendering for large graphs");
        } else if (metric === "cache_miss_rate") {
          recommendations.push("Increase cache size limits");
          recommendations.push("Improve cache key generation strategy");
          recommendations.push("Implement smarter cache eviction policies");
        }
        break;

      case "JSONParser":
        if (metric === "parse_duration") {
          recommendations.push("Consider streaming JSON parsing");
          recommendations.push("Implement data validation optimizations");
          recommendations.push("Add progress reporting for large files");
        } else if (metric === "memory_growth") {
          recommendations.push("Implement incremental parsing");
          recommendations.push("Add memory usage monitoring during parsing");
          recommendations.push("Consider data structure optimizations");
        }
        break;
    }

    return recommendations;
  }

  getAlerts(severity?: PerformanceAlert["severity"]): PerformanceAlert[] {
    if (severity) {
      return this.alerts.filter((alert) => alert.severity === severity);
    }
    return [...this.alerts];
  }

  getMetricHistory(component: string, metric: string): number[] {
    const key = `${component}.${metric}`;
    return [...(this.metrics.get(key) || [])];
  }

  getMetricSummary(
    component: string,
    metric: string,
  ): {
    current: number;
    average: number;
    min: number;
    max: number;
    trend: "improving" | "stable" | "degrading";
  } | null {
    const values = this.getMetricHistory(component, metric);
    if (values.length === 0) return null;

    const current = values[values.length - 1];
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Simple trend analysis (compare last 3 values to previous 3)
    let trend: "improving" | "stable" | "degrading" = "stable";
    if (values.length >= 6) {
      const recent = values.slice(-3).reduce((sum, val) => sum + val, 0) / 3;
      const previous =
        values.slice(-6, -3).reduce((sum, val) => sum + val, 0) / 3;
      const change = (recent - previous) / previous;

      if (change > 0.1) trend = "degrading";
      else if (change < -0.1) trend = "improving";
    }

    return { current, average, min, max, trend };
  }

  clearAlerts(): void {
    this.alerts = [];
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.sampleSystemMetrics();
    }, this.config.samplingInterval);
  }

  private sampleSystemMetrics(): void {
    // Sample system-wide metrics
    const memUsage = process.memoryUsage();
    this.recordMetric("System", "heap_used", memUsage.heapUsed / 1024 / 1024); // MB
    this.recordMetric("System", "heap_total", memUsage.heapTotal / 1024 / 1024); // MB
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  generateReport(): string {
    const criticalAlerts = this.getAlerts("critical");
    const highAlerts = this.getAlerts("high");
    const mediumAlerts = this.getAlerts("medium");

    let report = "# Performance Monitoring Report\n\n";
    report += `**Generated:** ${new Date().toISOString()}\n\n`;

    report += "## Alert Summary\n\n";
    report += `- Critical: ${criticalAlerts.length}\n`;
    report += `- High: ${highAlerts.length}\n`;
    report += `- Medium: ${mediumAlerts.length}\n\n`;

    if (criticalAlerts.length > 0) {
      report += "## Critical Alerts\n\n";
      criticalAlerts.forEach((alert) => {
        report += `- **${alert.component}.${alert.metric}**: ${alert.message}\n`;
        alert.recommendations.forEach((rec) => {
          report += `  - 💡 ${rec}\n`;
        });
        report += "\n";
      });
    }

    report += "## Metric Trends\n\n";
    const components = [
      "VisualizationState",
      "ELKBridge",
      "ReactFlowBridge",
      "JSONParser",
    ];
    components.forEach((component) => {
      const componentMetrics = Array.from(this.metrics.keys())
        .filter((key) => key.startsWith(component))
        .map((key) => key.split(".")[1]);

      if (componentMetrics.length > 0) {
        report += `### ${component}\n\n`;
        componentMetrics.forEach((metric) => {
          const summary = this.getMetricSummary(component, metric);
          if (summary) {
            const trendIcon =
              summary.trend === "improving"
                ? "📈"
                : summary.trend === "degrading"
                  ? "📉"
                  : "➡️";
            report += `- **${metric}**: ${summary.current.toFixed(2)} (avg: ${summary.average.toFixed(2)}) ${trendIcon}\n`;
          }
        });
        report += "\n";
      }
    });

    return report;
  }
}

// Global performance monitor instance
export const globalPerformanceMonitor = new PerformanceMonitor({
  enabled: process.env.NODE_ENV !== "test", // Disable in tests to avoid noise
  alertCallback: (alert) => {
    // In production, this could send alerts to monitoring systems
    if (alert.severity === "critical") {
      console.error("🚨 CRITICAL PERFORMANCE ALERT:", alert.message);
    }
  },
});

// Utility function to record metrics easily
export function recordPerformanceMetric(
  component: string,
  metric: string,
  value: number,
): void {
  globalPerformanceMonitor.recordMetric(component, metric, value);
}

// Decorator for automatic performance monitoring
export function monitorPerformance(component: string, metric?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const metricName = metric || propertyKey;

    descriptor.value = function (...args: any[]) {
      const startTime = performance.now();

      try {
        const result = originalMethod.apply(this, args);

        // Handle async methods
        if (result && typeof result.then === "function") {
          return result.finally(() => {
            const duration = performance.now() - startTime;
            recordPerformanceMetric(
              component,
              `${metricName}_duration`,
              duration,
            );
          });
        } else {
          const duration = performance.now() - startTime;
          recordPerformanceMetric(
            component,
            `${metricName}_duration`,
            duration,
          );
          return result;
        }
      } catch (error) {
        const duration = performance.now() - startTime;
        recordPerformanceMetric(
          component,
          `${metricName}_error_duration`,
          duration,
        );
        throw error;
      }
    };

    return descriptor;
  };
}
