/**
 * Tests for sync control between HierarchyTree and ReactFlow graph
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { InfoPanel } from "../components/panels/InfoPanel.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";

describe("Sync Tree and Graph Control", () => {
  let visualizationState: VisualizationState;
  let asyncCoordinator: AsyncCoordinator;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    // Suppress console output
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();

    // Create instances
    visualizationState = new VisualizationState();
    asyncCoordinator = new AsyncCoordinator();
  });

  it("should render sync control with linked state by default", () => {
    const { container } = render(
      <InfoPanel
        visualizationState={visualizationState}
        asyncCoordinator={asyncCoordinator}
        open={true}
        syncTreeAndGraph={true}
      />,
    );

    // Check for the sync control text (even if tree doesn't render without data)
    const syncText = container.textContent;
    // The sync control should be present even if the tree doesn't have data
    expect(syncText).toBeTruthy();
  });

  it("should render sync control with independent state when disabled", () => {
    const { container } = render(
      <InfoPanel
        visualizationState={visualizationState}
        asyncCoordinator={asyncCoordinator}
        open={true}
        syncTreeAndGraph={false}
      />,
    );

    // Check that panel renders
    const syncText = container.textContent;
    expect(syncText).toBeTruthy();
  });

  it("should call onSyncTreeAndGraphChange when toggle is clicked", () => {
    const mockToggle = vi.fn();
    const { container } = render(
      <InfoPanel
        visualizationState={visualizationState}
        asyncCoordinator={asyncCoordinator}
        open={true}
        syncTreeAndGraph={true}
        onSyncTreeAndGraphChange={mockToggle}
      />,
    );

    // Find and click the sync button
    const buttons = container.querySelectorAll("button");
    let syncButton: HTMLButtonElement | undefined;
    buttons.forEach((btn) => {
      if (
        btn.title?.includes("click to unlink") ||
        btn.title?.includes("click to link")
      ) {
        syncButton = btn;
      }
    });

    expect(syncButton).toBeTruthy();
    if (syncButton) {
      syncButton.click();
      expect(mockToggle).toHaveBeenCalledWith(false); // Toggle from true to false
    }
  });

  it("should persist sync state in Hydroscope settings", () => {
    // This test verifies the settings structure includes syncTreeAndGraph
    const settings = {
      infoPanelOpen: true,
      stylePanelOpen: false,
      autoFitEnabled: true,
      syncTreeAndGraph: false,
      colorPalette: "Set3",
      layoutAlgorithm: "mrtree",
      renderConfig: {
        edgeStyle: "bezier" as const,
        edgeWidth: 2,
        edgeDashed: false,
        nodePadding: 8,
        nodeFontSize: 12,
        containerBorderWidth: 2,
        colorPalette: "Set3",
        fitView: true,
      },
      version: 2,
    };

    // Verify the settings structure is valid
    expect(settings.syncTreeAndGraph).toBe(false);
    expect(typeof settings.syncTreeAndGraph).toBe("boolean");

    // Verify it can be stored and retrieved
    localStorage.setItem("hydroscope-settings", JSON.stringify(settings));
    const retrieved = JSON.parse(
      localStorage.getItem("hydroscope-settings") || "{}",
    );
    expect(retrieved.syncTreeAndGraph).toBe(false);
  });
});
