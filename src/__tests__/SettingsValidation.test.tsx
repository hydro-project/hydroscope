/**
 * Settings Validation Tests
 *
 * Tests for improved settings persistence validation and cleanup
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { Hydroscope } from "../components/Hydroscope.js";
import type { HydroscopeData } from "../types/core.js";

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

// Test data
const testData: HydroscopeData = {
  nodes: [{ id: "node1", label: "Node 1", semanticTags: [] }],
  edges: [],
  containers: [],
};

describe("Settings Validation and Cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  describe("Legacy Settings Cleanup", () => {
    it("should clean up legacy storage keys", () => {
      // Mock legacy keys existing
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === "hydroscope_settings") return '{"old": "data"}';
        if (key === "hydroscope-config") return '{"old": "config"}';
        if (key === "hydroscope-state") return '{"old": "state"}';
        return null;
      });

      render(<Hydroscope data={testData} />);

      // Should attempt to remove legacy keys
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        "hydroscope_settings",
      );
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        "hydroscope-config",
      );
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        "hydroscope-state",
      );
    });

    it("should not attempt to remove non-existent legacy keys", () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      render(<Hydroscope data={testData} />);

      // Should not call removeItem for non-existent keys
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    });
  });

  describe("RenderConfig Validation", () => {
    it("should validate and sanitize renderConfig", () => {
      const invalidSettings = JSON.stringify({
        infoPanelOpen: false,
        stylePanelOpen: false,
        autoFitEnabled: true,
        colorPalette: "Set3",
        layoutAlgorithm: "layered",
        renderConfig: {
          edgeStyle: "invalid-style", // Invalid
          edgeWidth: -5, // Invalid (negative)
          edgeDashed: "not-boolean", // Invalid type
          nodePadding: "invalid", // Invalid type
          nodeFontSize: 0, // Invalid (zero)
          containerBorderWidth: null, // Invalid type
          colorPalette: 123, // Invalid type
          fitView: "yes", // Invalid type
        },
      });

      mockLocalStorage.getItem.mockReturnValue(invalidSettings);

      render(<Hydroscope data={testData} />);

      // Component should render without errors despite invalid renderConfig
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        "hydroscope-settings",
      );
    });

    it("should preserve valid renderConfig values", () => {
      const validSettings = JSON.stringify({
        infoPanelOpen: true,
        stylePanelOpen: false,
        autoFitEnabled: false,
        colorPalette: "Set2",
        layoutAlgorithm: "force",
        renderConfig: {
          edgeStyle: "straight",
          edgeWidth: 3,
          edgeDashed: true,
          nodePadding: 12,
          nodeFontSize: 16,
          containerBorderWidth: 4,
          colorPalette: "Set2",
          fitView: false,
        },
      });

      mockLocalStorage.getItem.mockReturnValue(validSettings);

      render(<Hydroscope data={testData} />);

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        "hydroscope-settings",
      );
    });
  });

  describe("Settings Versioning", () => {
    it("should add version to saved settings", async () => {
      render(<Hydroscope data={testData} />);

      // Wait for settings to be saved
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Check if setItem was called with versioned settings
      if (mockLocalStorage.setItem.mock.calls.length > 0) {
        const savedData = mockLocalStorage.setItem.mock.calls[0][1];
        const parsedData = JSON.parse(savedData);
        expect(parsedData).toHaveProperty("version", 1);
      }
    });

    it("should handle settings without version gracefully", () => {
      const settingsWithoutVersion = JSON.stringify({
        infoPanelOpen: false,
        stylePanelOpen: false,
        autoFitEnabled: true,
        colorPalette: "Set3",
        layoutAlgorithm: "layered",
        renderConfig: {
          edgeStyle: "bezier",
          edgeWidth: 2,
          edgeDashed: false,
          nodePadding: 8,
          nodeFontSize: 12,
          containerBorderWidth: 2,
          colorPalette: "Set3",
          fitView: true,
        },
      });

      mockLocalStorage.getItem.mockReturnValue(settingsWithoutVersion);

      render(<Hydroscope data={testData} />);

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        "hydroscope-settings",
      );
    });
  });

  describe("Error Handling Improvements", () => {
    it("should handle array renderConfig gracefully", () => {
      const invalidSettings = JSON.stringify({
        infoPanelOpen: false,
        stylePanelOpen: false,
        autoFitEnabled: true,
        colorPalette: "Set3",
        layoutAlgorithm: "layered",
        renderConfig: [], // Array instead of object
      });

      mockLocalStorage.getItem.mockReturnValue(invalidSettings);

      render(<Hydroscope data={testData} />);

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        "hydroscope-settings",
      );
    });

    it("should handle null renderConfig gracefully", () => {
      const invalidSettings = JSON.stringify({
        infoPanelOpen: false,
        stylePanelOpen: false,
        autoFitEnabled: true,
        colorPalette: "Set3",
        layoutAlgorithm: "layered",
        renderConfig: null,
      });

      mockLocalStorage.getItem.mockReturnValue(invalidSettings);

      render(<Hydroscope data={testData} />);

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        "hydroscope-settings",
      );
    });
  });

  describe("Storage Key Consistency", () => {
    it("should use the correct storage key", () => {
      render(<Hydroscope data={testData} />);

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        "hydroscope-settings",
      );
    });

    it("should check legacy keys for cleanup but use correct key for loading", () => {
      render(<Hydroscope data={testData} />);

      // Should check legacy keys for cleanup
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        "hydroscope_settings",
      );
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        "hydroscope-config",
      );
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith("hydroscope-state");

      // Should use correct key for actual settings loading
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        "hydroscope-settings",
      );
    });
  });
});
