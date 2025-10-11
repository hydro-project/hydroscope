/**
 * @fileoverview Tests for ResizeObserver Error Suppression Utility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  enableResizeObserverErrorSuppression,
  disableResizeObserverErrorSuppression,
  DebouncedOperationManager,
  withResizeObserverErrorSuppression,
  withAsyncResizeObserverErrorSuppression,
} from "../utils/ResizeObserverErrorSuppression.js";

// Mock window object for testing
const mockWindow = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  onerror: null as any,
  onunhandledrejection: null as any,
  setTimeout: vi.fn(),
  clearTimeout: vi.fn(),
};

// Mock global window
Object.defineProperty(global, "window", {
  value: mockWindow,
  writable: true,
});

// Mock global setTimeout and clearTimeout
global.setTimeout = vi.fn();
global.clearTimeout = vi.fn();

describe("ResizeObserver Error Suppression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWindow.onerror = null;
    mockWindow.onunhandledrejection = null;
  });

  afterEach(() => {
    disableResizeObserverErrorSuppression();
  });

  describe("enableResizeObserverErrorSuppression", () => {
    it("should add error event listeners", () => {
      enableResizeObserverErrorSuppression();

      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        "error",
        expect.any(Function),
      );
      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        "unhandledrejection",
        expect.any(Function),
      );
    });

    it("should not add listeners multiple times", () => {
      enableResizeObserverErrorSuppression();
      enableResizeObserverErrorSuppression();

      // Should only be called once
      expect(mockWindow.addEventListener).toHaveBeenCalledTimes(2);
    });
  });

  describe("disableResizeObserverErrorSuppression", () => {
    it("should remove error event listeners", () => {
      enableResizeObserverErrorSuppression();
      disableResizeObserverErrorSuppression();

      expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
        "error",
        expect.any(Function),
      );
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
        "unhandledrejection",
        expect.any(Function),
      );
    });
  });

  describe("withResizeObserverErrorSuppression", () => {
    it("should suppress ResizeObserver errors", () => {
      const mockFn = vi.fn(() => {
        throw new Error("ResizeObserver loop limit exceeded");
      });

      const wrappedFn = withResizeObserverErrorSuppression(mockFn);

      // Should not throw
      expect(() => wrappedFn()).not.toThrow();
      expect(mockFn).toHaveBeenCalled();
    });

    it("should not suppress other errors", () => {
      const mockFn = vi.fn(() => {
        throw new Error("Some other error");
      });

      const wrappedFn = withResizeObserverErrorSuppression(mockFn);

      // Should throw
      expect(() => wrappedFn()).toThrow("Some other error");
      expect(mockFn).toHaveBeenCalled();
    });
  });

  describe("withAsyncResizeObserverErrorSuppression", () => {
    it("should suppress ResizeObserver errors in async functions", async () => {
      const mockFn = vi.fn(async () => {
        throw new Error(
          "ResizeObserver loop completed with undelivered notifications",
        );
      });

      const wrappedFn = withAsyncResizeObserverErrorSuppression(mockFn);

      // Should not throw
      await expect(wrappedFn()).resolves.toBeUndefined();
      expect(mockFn).toHaveBeenCalled();
    });

    it("should not suppress other errors in async functions", async () => {
      const mockFn = vi.fn(async () => {
        throw new Error("Some other async error");
      });

      const wrappedFn = withAsyncResizeObserverErrorSuppression(mockFn);

      // Should throw
      await expect(wrappedFn()).rejects.toThrow("Some other async error");
      expect(mockFn).toHaveBeenCalled();
    });
  });

  describe("DebouncedOperationManager", () => {
    it("should debounce operations", async () => {
      vi.useFakeTimers();

      const manager = new DebouncedOperationManager(50);
      const mockFn = vi.fn();

      const debouncedFn = manager.debounce("test", mockFn);

      // Call multiple times rapidly
      debouncedFn();
      debouncedFn();
      debouncedFn();

      // Should not have been called yet
      expect(mockFn).not.toHaveBeenCalled();

      // Fast-forward time
      vi.advanceTimersByTime(60);

      // Should have been called only once
      expect(mockFn).toHaveBeenCalledTimes(1);

      manager.destroy();
      vi.useRealTimers();
    });

    it("should cancel operations", () => {
      vi.useFakeTimers();

      const manager = new DebouncedOperationManager(50);
      const mockFn = vi.fn();

      const debouncedFn = manager.debounce("test", mockFn);
      debouncedFn();

      manager.cancel("test");

      // Fast-forward time
      vi.advanceTimersByTime(60);

      expect(mockFn).not.toHaveBeenCalled();

      manager.destroy();
      vi.useRealTimers();
    });

    it("should cancel all operations on destroy", () => {
      vi.useFakeTimers();

      const manager = new DebouncedOperationManager(50);
      const mockFn1 = vi.fn();
      const mockFn2 = vi.fn();

      const debouncedFn1 = manager.debounce("test1", mockFn1);
      const debouncedFn2 = manager.debounce("test2", mockFn2);

      debouncedFn1();
      debouncedFn2();

      manager.destroy();

      // Fast-forward time
      vi.advanceTimersByTime(60);

      expect(mockFn1).not.toHaveBeenCalled();
      expect(mockFn2).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
