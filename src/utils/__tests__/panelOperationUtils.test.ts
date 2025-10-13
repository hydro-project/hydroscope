/**
 * @fileoverview Tests for Panel Operation Utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  togglePanelImperatively,
  expandPanelImperatively,
  collapsePanelImperatively,
  batchPanelOperationsImperatively,
  changeStyleImperatively,
  changeLayoutImperatively,
  changeColorPaletteImperatively,
  changeEdgeStyleImperatively,
  clearPanelOperationDebouncing,
  PANEL_OPERATION_PATTERN,
} from "../panelOperationUtils.js";

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => {
  cb(0);
  return 0;
});

describe("Panel Operation Utilities", () => {
  let mockSetState: ReturnType<typeof vi.fn>;
  let mockOnStyleChange: ReturnType<typeof vi.fn>;
  let mockOnLayoutChange: ReturnType<typeof vi.fn>;
  let mockOnPaletteChange: ReturnType<typeof vi.fn>;
  let mockOnEdgeStyleChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetState = vi.fn();
    mockOnStyleChange = vi.fn();
    mockOnLayoutChange = vi.fn();
    mockOnPaletteChange = vi.fn();
    mockOnEdgeStyleChange = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearPanelOperationDebouncing();
  });

  describe("togglePanelImperatively", () => {
    it("should toggle panel from collapsed to expanded", () => {
      const result = togglePanelImperatively({
        panelId: "test-panel",
        setState: mockSetState,
        currentState: true, // currently collapsed
        operation: "toggle",
      });

      expect(result).toBe(true);
      expect(mockSetState).toHaveBeenCalledWith(false); // should expand
    });

    it("should toggle panel from expanded to collapsed", () => {
      const result = togglePanelImperatively({
        panelId: "test-panel",
        setState: mockSetState,
        currentState: false, // currently expanded
        operation: "toggle",
      });

      expect(result).toBe(true);
      expect(mockSetState).toHaveBeenCalledWith(true); // should collapse
    });

    it("should force expand regardless of current state", () => {
      const result = togglePanelImperatively({
        panelId: "test-panel",
        setState: mockSetState,
        currentState: true, // currently collapsed
        operation: "expand",
      });

      expect(result).toBe(true);
      expect(mockSetState).toHaveBeenCalledWith(false); // should expand
    });

    it("should force collapse regardless of current state", () => {
      const result = togglePanelImperatively({
        panelId: "test-panel",
        setState: mockSetState,
        currentState: false, // currently expanded
        operation: "collapse",
      });

      expect(result).toBe(true);
      expect(mockSetState).toHaveBeenCalledWith(true); // should collapse
    });

    it("should skip operation if already in target state", () => {
      const result = togglePanelImperatively({
        panelId: "test-panel",
        setState: mockSetState,
        currentState: true, // currently collapsed
        operation: "collapse", // want to collapse
      });

      expect(result).toBe(true);
      expect(mockSetState).not.toHaveBeenCalled(); // should skip
    });

    it("should return false for missing panelId", () => {
      const result = togglePanelImperatively({
        panelId: "",
        setState: mockSetState,
        currentState: false,
      });

      expect(result).toBe(false);
      expect(mockSetState).not.toHaveBeenCalled();
    });

    it("should return false for missing setState", () => {
      const result = togglePanelImperatively({
        panelId: "test-panel",
        currentState: false,
      });

      expect(result).toBe(false);
    });

    it("should support debouncing", () => {
      const result = togglePanelImperatively({
        panelId: "test-panel",
        setState: mockSetState,
        currentState: true,
        operation: "expand",
        debounce: true,
      });

      expect(result).toBe(true); // Should return true for debounced operations
    });
  });

  describe("expandPanelImperatively", () => {
    it("should expand panel", () => {
      const result = expandPanelImperatively({
        panelId: "test-panel",
        setState: mockSetState,
        currentState: true, // currently collapsed
      });

      expect(result).toBe(true);
      expect(mockSetState).toHaveBeenCalledWith(false); // should expand
    });
  });

  describe("collapsePanelImperatively", () => {
    it("should collapse panel", () => {
      const result = collapsePanelImperatively({
        panelId: "test-panel",
        setState: mockSetState,
        currentState: false, // currently expanded
      });

      expect(result).toBe(true);
      expect(mockSetState).toHaveBeenCalledWith(true); // should collapse
    });
  });

  describe("batchPanelOperationsImperatively", () => {
    it("should execute multiple panel operations", () => {
      const mockSetState1 = vi.fn();
      const mockSetState2 = vi.fn();

      const result = batchPanelOperationsImperatively({
        operations: [
          {
            panelId: "panel1",
            operation: "expand",
            setState: mockSetState1,
            currentState: true,
          },
          {
            panelId: "panel2",
            operation: "collapse",
            setState: mockSetState2,
            currentState: false,
          },
        ],
      });

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle operation failures", () => {
      const mockSetStateError = vi.fn(() => {
        throw new Error("Test error");
      });

      const result = batchPanelOperationsImperatively({
        operations: [
          {
            panelId: "panel1",
            operation: "expand",
            setState: mockSetStateError,
            currentState: true,
          },
        ],
      });

      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe("changeStyleImperatively", () => {
    it("should execute style change", () => {
      const result = changeStyleImperatively({
        styleType: "layout",
        value: "layered",
        onStyleChange: mockOnStyleChange,
      });

      expect(result).toBe(true);
      expect(mockOnStyleChange).toHaveBeenCalledWith("layout", "layered");
    });

    it("should handle style change errors", () => {
      const mockOnStyleChangeError = vi.fn(() => {
        throw new Error("Style change error");
      });

      const result = changeStyleImperatively({
        styleType: "layout",
        value: "layered",
        onStyleChange: mockOnStyleChangeError,
      });

      expect(result).toBe(true); // Still returns true as error is caught in requestAnimationFrame
    });
  });

  describe("changeLayoutImperatively", () => {
    it("should change layout algorithm", () => {
      const result = changeLayoutImperatively({
        algorithm: "layered",
        onLayoutChange: mockOnLayoutChange,
      });

      expect(result).toBe(true);
      expect(mockOnLayoutChange).toHaveBeenCalledWith("layered");
    });
  });

  describe("changeColorPaletteImperatively", () => {
    it("should change color palette", () => {
      const result = changeColorPaletteImperatively({
        palette: "Set2",
        onPaletteChange: mockOnPaletteChange,
      });

      expect(result).toBe(true);
      expect(mockOnPaletteChange).toHaveBeenCalledWith("Set2");
    });
  });

  describe("changeEdgeStyleImperatively", () => {
    it("should change edge style", () => {
      const result = changeEdgeStyleImperatively({
        edgeStyle: "straight",
        onEdgeStyleChange: mockOnEdgeStyleChange,
      });

      expect(result).toBe(true);
      expect(mockOnEdgeStyleChange).toHaveBeenCalledWith("straight");
    });
  });

  describe("PANEL_OPERATION_PATTERN", () => {
    it("should export operation pattern guidelines", () => {
      expect(PANEL_OPERATION_PATTERN).toBeDefined();
      expect(PANEL_OPERATION_PATTERN.DO).toBeInstanceOf(Array);
      expect(PANEL_OPERATION_PATTERN.DONT).toBeInstanceOf(Array);
      expect(PANEL_OPERATION_PATTERN.DO.length).toBeGreaterThan(0);
      expect(PANEL_OPERATION_PATTERN.DONT.length).toBeGreaterThan(0);
    });
  });
});
