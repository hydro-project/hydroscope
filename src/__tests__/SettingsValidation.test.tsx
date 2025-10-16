/**
 * Settings Validation Tests
 *
 * Tests for settings persistence and validation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { Hydroscope } from "../components/Hydroscope.js";
import type { HydroscopeData } from "../types/core.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";

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
  nodes: [{ id: "node1", label: "Node 1" }],
  edges: [],
  hierarchyChoices: [],
  nodeAssignments: {},
};

describe("Settings Validation and Persistence", () => {
  let _coordinator: AsyncCoordinator;

  beforeEach(() => {
    const _coordinator = new AsyncCoordinator();
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  describe("Settings Loading", () => {
    it("should load settings from localStorage", () => {
      const mockSettings = JSON.stringify({
        infoPanelOpen: true,
        stylePanelOpen: false,
        autoFitEnabled: true,
        colorPalette: "Set2",
        layoutAlgorithm: "layered",
        renderConfig: {
          edgeStyle: "bezier",
          edgeWidth: 2,
        },
        version: 1,
      });

      mockLocalStorage.getItem.mockReturnValue(mockSettings);

      render(<Hydroscope data={testData} />);

      // Should attempt to load settings
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        "hydroscope-settings",
      );
    });

    it("should handle missing settings gracefully", () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      render(<Hydroscope data={testData} />);

      // Should still render without settings
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        "hydroscope-settings",
      );
    });

    it("should handle corrupted settings gracefully", () => {
      mockLocalStorage.getItem.mockReturnValue("invalid json");

      render(<Hydroscope data={testData} />);

      // Should still render with corrupted settings
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        "hydroscope-settings",
      );
    });
  });

  describe("Settings Saving", () => {
    it("should save settings to localStorage", () => {
      render(<Hydroscope data={testData} />);

      // Component should attempt to save settings
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        "hydroscope-settings",
        expect.stringContaining("version"),
      );
    });

    it("should handle localStorage save errors gracefully", () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error("Storage quota exceeded");
      });

      // Should not throw when localStorage fails
      expect(() => {
        render(<Hydroscope data={testData} />);
      }).not.toThrow();
    });
  });

  describe("Settings Structure", () => {
    it("should save settings with correct structure", () => {
      render(<Hydroscope data={testData} />);

      const savedSettings = mockLocalStorage.setItem.mock.calls.find(
        (call) => call[0] === "hydroscope-settings",
      );

      expect(savedSettings).toBeDefined();

      if (savedSettings) {
        const settingsData = JSON.parse(savedSettings[1]);

        // Should have version
        expect(settingsData.version).toBeDefined();

        // Should have expected properties
        expect(settingsData).toHaveProperty("infoPanelOpen");
        expect(settingsData).toHaveProperty("stylePanelOpen");
        expect(settingsData).toHaveProperty("autoFitEnabled");
        expect(settingsData).toHaveProperty("colorPalette");
        expect(settingsData).toHaveProperty("layoutAlgorithm");
        expect(settingsData).toHaveProperty("renderConfig");
      }
    });

    it("should merge loaded settings with defaults", () => {
      const partialSettings = JSON.stringify({
        infoPanelOpen: false,
        // Missing other properties
        version: 1,
      });

      mockLocalStorage.getItem.mockReturnValue(partialSettings);

      render(<Hydroscope data={testData} />);

      // Should still save complete settings structure
      const savedSettings = mockLocalStorage.setItem.mock.calls.find(
        (call) => call[0] === "hydroscope-settings",
      );

      if (savedSettings) {
        const settingsData = JSON.parse(savedSettings[1]);

        // Should have all expected properties even if not in loaded settings
        expect(settingsData).toHaveProperty("infoPanelOpen");
        expect(settingsData).toHaveProperty("stylePanelOpen");
        expect(settingsData).toHaveProperty("autoFitEnabled");
        expect(settingsData).toHaveProperty("colorPalette");
        expect(settingsData).toHaveProperty("layoutAlgorithm");
        expect(settingsData).toHaveProperty("renderConfig");
      }
    });
  });

  describe("Storage Key Consistency", () => {
    it("should use consistent storage key", () => {
      render(<Hydroscope data={testData} />);

      // Should use the same key for loading and saving
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        "hydroscope-settings",
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        "hydroscope-settings",
        expect.any(String),
      );
    });
  });
});
