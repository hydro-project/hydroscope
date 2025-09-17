import { hscopeLogger } from './logger';
/**
 * layoutContentionMetrics
 * Lightweight global metrics collector for layout lock contention & retries.
 * Intentionally framework‑agnostic; uses console for reporting (dev only).
 */

interface ContentionSnapshot {
  totalAcquire: number;
  totalRelease: number;
  totalBlocked: number;
  totalForce: number;
  totalRetryScheduled: number;
  totalRetryExecuted: number;
  maxHoldMs: number;
  avgHoldMs: number;
  lastHolder?: string | null;
  lastBlockedBy?: string | null;
  lastAcquireTs?: number;
  lastBlockedTs?: number;
  retryHistogram: Record<string, number>; // attemptCount -> occurrences
}

class LayoutContentionMetrics {
  private static instance: LayoutContentionMetrics | null = null;
  private holds: number[] = [];
  private snapshot: ContentionSnapshot = {
    totalAcquire: 0,
    totalRelease: 0,
    totalBlocked: 0,
    totalForce: 0,
    totalRetryScheduled: 0,
    totalRetryExecuted: 0,
    maxHoldMs: 0,
    avgHoldMs: 0,
    retryHistogram: {},
  };
  private reporterStarted = false;
  private lastReportCounts = { blocked: 0, retry: 0 };

  static getInstance(): LayoutContentionMetrics {
    if (!LayoutContentionMetrics.instance) {
      LayoutContentionMetrics.instance = new LayoutContentionMetrics();
    }
    return LayoutContentionMetrics.instance;
  }

  private startReporter() {
    if (this.reporterStarted) return;
    this.reporterStarted = true;
    setInterval(() => {
      const needsReport =
        this.snapshot.totalBlocked !== this.lastReportCounts.blocked ||
        this.snapshot.totalRetryExecuted !== this.lastReportCounts.retry;
      if (!needsReport) return;
      this.lastReportCounts = {
        blocked: this.snapshot.totalBlocked,
        retry: this.snapshot.totalRetryExecuted,
      };
      // Dev-only summary
      // eslint-disable-next-line no-console
      hscopeLogger.log('metrics', 'summary', this.getSnapshot());
    }, 5000);
  }

  recordAcquire(opId: string, force: boolean) {
    this.snapshot.totalAcquire++;
    if (force) this.snapshot.totalForce++;
    this.snapshot.lastHolder = opId;
    this.snapshot.lastAcquireTs = Date.now();
    this.startReporter();
  }

  recordBlocked(opId: string, holderId: string | null) {
    this.snapshot.totalBlocked++;
    this.snapshot.lastBlockedBy = holderId;
    this.snapshot.lastBlockedTs = Date.now();
    // eslint-disable-next-line no-console
    console.warn('[LayoutContentionMetrics] blocked', {
      opId,
      holderId,
      totalBlocked: this.snapshot.totalBlocked,
    });
    this.startReporter();
  }

  recordRelease(opId: string, holdMs: number) {
    this.snapshot.totalRelease++;
    if (holdMs > this.snapshot.maxHoldMs) this.snapshot.maxHoldMs = holdMs;
    this.holds.push(holdMs);
    const sum = this.holds.reduce((a, b) => a + b, 0);
    this.snapshot.avgHoldMs = Math.round(sum / this.holds.length);
    this.startReporter();
  }

  recordRetryScheduled(attempt: number) {
    this.snapshot.totalRetryScheduled++;
    this.snapshot.retryHistogram[attempt] = (this.snapshot.retryHistogram[attempt] || 0) + 1;
    this.startReporter();
  }

  recordRetryExecuted(attempt: number) {
    this.snapshot.totalRetryExecuted++;
    this.snapshot.retryHistogram[attempt] = (this.snapshot.retryHistogram[attempt] || 0) + 1;
    this.startReporter();
  }

  getSnapshot(): ContentionSnapshot {
    return { ...this.snapshot };
  }
}

export const layoutContentionMetrics = LayoutContentionMetrics.getInstance();

export type { ContentionSnapshot };
