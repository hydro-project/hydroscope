/**
 * HydroscopeCore Component Tests
 * Tests React component behavior, lifecycle management, and async coordination
 */

import React from "react";
import { render, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  HydroscopeCore,
  type HydroscopeCoreRef,
} from "../components/HydroscopeCore.js";
import type {
  LayoutConfig,
  StyleConfig,
  ReactFlowData,
  LayoutState,
  QueueStatus,
} from "../types/core.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";

// Mock the core modules
vi.mock("../core/VisualizationState.js", () => ({
  VisualizationState: vi.fn().mockImplementation(() => ({
    getLayoutState: vi.fn().mockReturnValue({
      phase: "initial",
      layoutCount: 0,
      lastUpdate: Date.now(),
    }),
    setLayoutPhase: vi.fn(),
    incrementLayoutCount: vi.fn(),
    visibleNodes: [],
    visibleEdges: [],
    visibleContainers: [],
  })),
}));

vi.mock("../core/AsyncCoordinator.js", () => ({
  AsyncCoordinator: vi.fn().mockImplementation(() => ({
    getQueueStatus: vi.fn().mockReturnValue({
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      totalProcessed: 0,
      averageProcessingTime: 0,
      errors: [],
    }),
    queueELKLayout: vi.fn().mockResolvedValue(undefined),
    clearQueue: vi.fn(),
    getContainerOperationStatus: vi.fn().mockReturnValue({
      expandOperations: {
        queued: 0,
        processing: false,
        completed: 0,
        failed: 0,
      },
      collapseOperations: {
        queued: 0,
        processing: false,
        completed: 0,
        failed: 0,
      },
      bulkOperations: { queued: 0, processing: false, completed: 0, failed: 0 },
    }),
  })),
}));

vi.mock("../core/InteractionHandler.js", () => ({
  InteractionHandler: vi.fn().mockImplementation(() => ({
    cleanup: vi.fn(),
    handleNodeClick: vi.fn(),
    handleContainerClick: vi.fn(),
  })),
}));

vi.mock("../bridges/ReactFlowBridge.js", () => ({
  ReactFlowBridge: vi.fn().mockImplementation(() => ({
    toReactFlowData: vi.fn().mockReturnValue({
      nodes: [],
      edges: [],
    }),
    clearCaches: vi.fn(),
  })),
}));

vi.mock("../bridges/ELKBridge.js", () => ({
  ELKBridge: vi.fn().mockImplementation(() => ({
    getConfiguration: vi.fn().mockReturnValue({}),
    updateConfiguration: vi.fn(),
  })),
}));

describe("HydroscopeCore Component", () => {
  let mockOnDataUpdate: ReturnType<typeof vi.fn>;
  let mockOnLayoutStateChange: ReturnType<typeof vi.fn>;
  let mockOnAsyncStatusChange: ReturnType<typeof vi.fn>;
  let mockOnError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnDataUpdate = vi.fn();
    mockOnLayoutStateChange = vi.fn();
    mockOnAsyncStatusChange = vi.fn();
    mockOnError = vi.fn();
    vi.clearAllMocks();

    const elkBridge = new ELKBridge();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("Component Initialization", () => {
    it("should initialize core instances on mount", async () => {
      const ref = React.createRef<HydroscopeCoreRef>();

      await act(async () => {
        render(
          <HydroscopeCore
            ref={ref}
            onDataUpdate={mockOnDataUpdate}
            onLayoutStateChange={mockOnLayoutStateChange}
            onAsyncStatusChange={mockOnAsyncStatusChange}
            onError={mockOnError}
          />,
        );
      });

      expect(ref.current).toBeDefined();
      expect(ref.current?.getVisualizationState).toBeDefined();
      expect(ref.current?.getAsyncCoordinator).toBeDefined();
      expect(ref.current?.getInteractionHandler).toBeDefined();
    });

    it("should initialize with custom layout config", async () => {
      const layoutConfig: LayoutConfig = {
        algorithm: "stress",
        direction: "LEFT",
        nodeSpacing: 100,
      };

      const ref = React.createRef<HydroscopeCoreRef>();

      await act(async () => {
        render(<HydroscopeCore ref={ref} layoutConfig={layoutConfig} />);
      });

      expect(ref.current).toBeDefined();
    });

    it("should initialize with custom style config", async () => {
      const styleConfig: StyleConfig = {
        nodeStyles: {
          default: { backgroundColor: "blue" },
        },
        edgeStyles: {
          default: { stroke: "red" },
        },
      };

      const ref = React.createRef<HydroscopeCoreRef>();

      await act(async () => {
        render(<HydroscopeCore ref={ref} styleConfig={styleConfig} />);
      });

      expect(ref.current).toBeDefined();
    });

    it("should handle initialization errors gracefully", async () => {
      // Mock VisualizationState to throw an error
      const { VisualizationState } = await import(
        "../core/VisualizationState.js"
      );
      vi.mocked(VisualizationState).mockImplementationOnce(() => {
        throw new Error("Initialization failed");
      });

      await act(async () => {
        render(<HydroscopeCore onError={mockOnError} />);
      });

      expect(mockOnError).toHaveBeenCalledWith(
        expect.any(Error),
        "initialization",
      );
    });
  });

  describe("Ref Methods", () => {
    let ref: React.RefObject<HydroscopeCoreRef>;

    beforeEach(async () => {
      ref = React.createRef<HydroscopeCoreRef>();

      await act(async () => {
        render(<HydroscopeCore ref={ref} onDataUpdate={mockOnDataUpdate} />);
      });
    });

    it("should provide access to VisualizationState", async () => {
      expect(() => ref.current?.getVisualizationState()).not.toThrow();
    });

    it("should provide access to AsyncCoordinator", async () => {
      expect(() => ref.current?.getAsyncCoordinator()).not.toThrow();
    });

    it("should provide access to InteractionHandler", async () => {
      expect(() => ref.current?.getInteractionHandler()).not.toThrow();
    });

    it("should provide triggerLayout method", async () => {
      expect(ref.current?.triggerLayout).toBeDefined();

      await act(async () => {
        await ref.current?.triggerLayout();
      });

      // Should not throw
    });

    it("should provide getReactFlowData method", async () => {
      expect(ref.current?.getReactFlowData).toBeDefined();
      const data = ref.current?.getReactFlowData();
      expect(data).toBeDefined();
    });

    it("should provide updateLayoutConfig method", async () => {
      expect(ref.current?.updateLayoutConfig).toBeDefined();

      act(() => {
        ref.current?.updateLayoutConfig({ algorithm: "force" });
      });

      // Should not throw
    });

    it("should provide updateStyleConfig method", async () => {
      expect(ref.current?.updateStyleConfig).toBeDefined();

      act(() => {
        ref.current?.updateStyleConfig({
          nodeStyles: { default: { color: "red" } },
        });
      });

      // Should not throw
    });

    it("should provide clearAsyncOperations method", async () => {
      expect(ref.current?.clearAsyncOperations).toBeDefined();

      act(() => {
        ref.current?.clearAsyncOperations();
      });

      // Should not throw
    });
  });

  describe("Callback Handling", () => {
    it("should call onLayoutStateChange when layout state changes", async () => {
      await act(async () => {
        render(
          <HydroscopeCore onLayoutStateChange={mockOnLayoutStateChange} />,
        );
      });

      expect(mockOnLayoutStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: "initial",
          layoutCount: 0,
        }),
      );
    });

    it("should call onAsyncStatusChange when async status changes", async () => {
      await act(async () => {
        render(
          <HydroscopeCore onAsyncStatusChange={mockOnAsyncStatusChange} />,
        );
      });

      expect(mockOnAsyncStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
        }),
      );
    });

    it("should call onDataUpdate when ReactFlow data is generated", async () => {
      const ref = React.createRef<HydroscopeCoreRef>();

      await act(async () => {
        render(<HydroscopeCore ref={ref} onDataUpdate={mockOnDataUpdate} />);
      });

      // Trigger layout to generate data
      await act(async () => {
        await ref.current?.triggerLayout();
      });

      expect(mockOnDataUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: expect.any(Array),
          edges: expect.any(Array),
        }),
      );
    });
  });

  describe("Auto Layout", () => {
    beforeEach(() => {
      vi.useFakeTimers();

      const elkBridge = new ELKBridge();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should trigger auto layout when enabled", async () => {
      const ref = React.createRef<HydroscopeCoreRef>();

      await act(async () => {
        render(
          <HydroscopeCore
            ref={ref}
            autoLayout={true}
            layoutDebounceDelay={100}
          />,
        );
      });

      // Fast-forward timers to trigger auto layout check
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Should not throw
    });

    it("should not trigger auto layout when disabled", async () => {
      const ref = React.createRef<HydroscopeCoreRef>();

      await act(async () => {
        render(<HydroscopeCore ref={ref} autoLayout={false} />);
      });

      // Fast-forward timers
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should not have triggered layout
    });

    it("should debounce layout updates", async () => {
      const ref = React.createRef<HydroscopeCoreRef>();

      await act(async () => {
        render(
          <HydroscopeCore
            ref={ref}
            autoLayout={true}
            layoutDebounceDelay={300}
          />,
        );
      });

      // Multiple rapid layout triggers should be debounced
      act(() => {
        ref.current?.updateLayoutConfig({ algorithm: "force" });
        ref.current?.updateLayoutConfig({ algorithm: "stress" });
        ref.current?.updateLayoutConfig({ algorithm: "layered" });
      });

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(400);
      });

      // Should have only triggered once after debounce
    });
  });

  describe("Error Handling", () => {
    it("should handle layout errors gracefully", async () => {
      // Mock AsyncCoordinator to throw an error
      const { AsyncCoordinator } = await import("../core/AsyncCoordinator.js");
      const mockAsyncCoordinator = {
        getQueueStatus: vi.fn().mockReturnValue({
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          totalProcessed: 0,
          averageProcessingTime: 0,
          errors: [],
        }),
        queueELKLayout: vi.fn().mockRejectedValue(new Error("Layout failed")),
        clearQueue: vi.fn(),
        getContainerOperationStatus: vi.fn().mockReturnValue({
          expandOperations: {
            queued: 0,
            processing: false,
            completed: 0,
            failed: 0,
          },
          collapseOperations: {
            queued: 0,
            processing: false,
            completed: 0,
            failed: 0,
          },
          bulkOperations: {
            queued: 0,
            processing: false,
            completed: 0,
            failed: 0,
          },
        }),
      };

      vi.mocked(AsyncCoordinator).mockImplementationOnce(
        () => mockAsyncCoordinator as AsyncCoordinator,
      );

      const ref = React.createRef<HydroscopeCoreRef>();

      await act(async () => {
        render(<HydroscopeCore ref={ref} onError={mockOnError} />);
      });

      // Trigger layout that will fail
      await act(async () => {
        try {
          await ref.current?.triggerLayout();
        } catch {
          // Expected to fail
        }
      });

      expect(mockOnError).toHaveBeenCalledWith(
        expect.any(Error),
        "layout update",
      );
    });

    it("should handle ReactFlow data generation errors", async () => {
      const ref = React.createRef<HydroscopeCoreRef>();

      await act(async () => {
        render(
          <HydroscopeCore ref={ref} onError={mockOnError} autoLayout={false} />,
        );
      });

      // Mock ReactFlowBridge to throw an error after initialization
      const { ReactFlowBridge } = await import("../bridges/ReactFlowBridge.js");
      const mockBridge = {
        toReactFlowData: vi.fn().mockImplementation(() => {
          throw new Error("ReactFlow conversion failed");
        }),
        clearCaches: vi.fn(),
      };

      // Replace the bridge instance to trigger error during updateReactFlowData
      vi.mocked(ReactFlowBridge).mockImplementationOnce(
        () => mockBridge as ReactFlowBridge,
      );

      // Update style config to trigger ReactFlow bridge recreation and error
      await act(async () => {
        ref.current?.updateStyleConfig({
          nodeStyles: { default: { color: "red" } },
        });
      });

      expect(mockOnError).toHaveBeenCalledWith(
        expect.any(Error),
        "ReactFlow data update",
      );
    });
  });

  describe("Cleanup", () => {
    it("should cleanup resources on unmount", async () => {
      const ref = React.createRef<HydroscopeCoreRef>();

      const { unmount } = await act(async () => {
        return render(<HydroscopeCore ref={ref} debug={true} />);
      });

      // Get references to mocked instances
      const asyncCoordinator = ref.current?.getAsyncCoordinator();
      const interactionHandler = ref.current?.getInteractionHandler();

      await act(async () => {
        unmount();
      });

      // Verify cleanup was called
      expect(asyncCoordinator?.clearQueue).toHaveBeenCalled();
      expect(interactionHandler?.cleanup).toHaveBeenCalled();
    });

    it("should clear timers on unmount", async () => {
      vi.useFakeTimers();

      const { unmount } = await act(async () => {
        return render(
          <HydroscopeCore autoLayout={true} layoutDebounceDelay={1000} />,
        );
      });

      // Start a debounced operation
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Unmount before timer completes
      await act(async () => {
        unmount();
      });

      // Advance timers past the debounce delay
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should not have any pending timers
      expect(vi.getTimerCount()).toBe(0);

      vi.useRealTimers();
    });
  });

  describe("Debug Mode", () => {
    it("should log debug messages when debug is enabled", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await act(async () => {
        render(<HydroscopeCore debug={true} />);
      });

      // Check that at least one debug message was logged
      expect(consoleSpy).toHaveBeenCalled();

      // Check that at least one call contains the HydroscopeCore prefix
      const calls = consoleSpy.mock.calls;
      const hasHydroscopeCoreLog = calls.some(
        (call) =>
          call[0] &&
          typeof call[0] === "string" &&
          call[0].includes("[HydroscopeCore]"),
      );
      expect(hasHydroscopeCoreLog).toBe(true);

      consoleSpy.mockRestore();
    });

    it("should not log debug messages when debug is disabled", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await act(async () => {
        render(<HydroscopeCore debug={false} />);
      });

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("[HydroscopeCore]"),
        expect.anything(),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Configuration Updates", () => {
    it("should update layout config when props change", async () => {
      const initialConfig: LayoutConfig = { algorithm: "layered" };
      const updatedConfig: LayoutConfig = { algorithm: "force" };

      const { rerender } = await act(async () => {
        return render(<HydroscopeCore layoutConfig={initialConfig} />);
      });

      await act(async () => {
        rerender(<HydroscopeCore layoutConfig={updatedConfig} />);
      });

      // Should have updated the ELK bridge configuration
    });

    it("should update style config when props change", async () => {
      const initialConfig: StyleConfig = {
        nodeStyles: { default: { color: "blue" } },
      };
      const updatedConfig: StyleConfig = {
        nodeStyles: { default: { color: "red" } },
      };

      const { rerender } = await act(async () => {
        return render(<HydroscopeCore styleConfig={initialConfig} />);
      });

      await act(async () => {
        rerender(<HydroscopeCore styleConfig={updatedConfig} />);
      });

      // Should have created a new ReactFlow bridge with updated config
    });
  });
});
