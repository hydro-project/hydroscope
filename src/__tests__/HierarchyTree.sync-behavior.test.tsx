/**
 * @fileoverview HierarchyTree Sync Behavior Tests
 *
 * Regression tests for HierarchyTree expansion/collapse behavior with sync enabled/disabled.
 * These tests prevent regression of the bug where tree expansion didn't work when sync was disabled.
 */

import React from "react"; // eslint-disable-line @typescript-eslint/no-unused-vars
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HierarchyTree } from "../components/HierarchyTree";
import { VisualizationState } from "../core/VisualizationState";
import { AsyncCoordinator } from "../core/AsyncCoordinator";

describe("HierarchyTree Sync Behavior", () => {
  let visualizationState: VisualizationState;
  let asyncCoordinator: AsyncCoordinator;
  let mockOnToggleContainer: ReturnType<typeof vi.fn>;
  let mockOnElementNavigation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    visualizationState = new VisualizationState();
    asyncCoordinator = new AsyncCoordinator();
    mockOnToggleContainer = vi.fn();
    mockOnElementNavigation = vi.fn();

    // Set up test data with simple containers
    visualizationState.addContainer({
      id: "container1",
      label: "Container 1",
      children: new Set<string>(),
      collapsed: true,
      hidden: false,
      position: { x: 0, y: 0 },
      dimensions: { width: 200, height: 150 },
    });

    visualizationState.addContainer({
      id: "container2",
      label: "Container 2",
      children: new Set<string>(),
      collapsed: true,
      hidden: false,
      position: { x: 0, y: 200 },
      dimensions: { width: 200, height: 150 },
    });

    visualizationState.addNode({
      id: "node1",
      label: "Node 1",
      position: { x: 50, y: 50 },
      dimensions: { width: 100, height: 40 },
    });

    visualizationState.addNode({
      id: "node2",
      label: "Node 2",
      position: { x: 50, y: 250 },
      dimensions: { width: 100, height: 40 },
    });

    visualizationState.assignNodeToContainer("node1", "container1");
    visualizationState.assignNodeToContainer("node2", "container2");
  });

  describe("when syncEnabled is true", () => {
    it("should expand tree when user clicks and call onToggleContainer", async () => {
      const collapsedContainers = new Set(["container1", "container2"]);

      const { rerender } = render(
        <HierarchyTree
          visualizationState={visualizationState}
          collapsedContainers={collapsedContainers}
          onToggleContainer={mockOnToggleContainer}
          onElementNavigation={mockOnElementNavigation}
          asyncCoordinator={asyncCoordinator}
          syncEnabled={true}
        />,
      );

      const container1 = screen.getByText("Container 1");
      const expandButton = container1
        .closest(".ant-tree-treenode")
        ?.querySelector(".ant-tree-switcher");
      
      expect(expandButton).toBeInTheDocument();
      fireEvent.click(expandButton!);

      await waitFor(() => {
        expect(mockOnToggleContainer).toHaveBeenCalledWith("container1");
      });

      // Simulate state update
      collapsedContainers.delete("container1");
      rerender(
        <HierarchyTree
          visualizationState={visualizationState}
          collapsedContainers={collapsedContainers}
          onToggleContainer={mockOnToggleContainer}
          onElementNavigation={mockOnElementNavigation}
          asyncCoordinator={asyncCoordinator}
          syncEnabled={true}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Node 1")).toBeInTheDocument();
      });
    });
  });

  describe("when syncEnabled is false (regression test for expansion bug)", () => {
    it("should expand tree independently without calling onToggleContainer", async () => {
      const collapsedContainers = new Set(["container1", "container2"]);

      render(
        <HierarchyTree
          visualizationState={visualizationState}
          collapsedContainers={collapsedContainers}
          onToggleContainer={mockOnToggleContainer}
          onElementNavigation={mockOnElementNavigation}
          asyncCoordinator={asyncCoordinator}
          syncEnabled={false}
        />,
      );

      const container1 = screen.getByText("Container 1");
      const expandButton = container1
        .closest(".ant-tree-treenode")
        ?.querySelector(".ant-tree-switcher");
      
      expect(expandButton).toBeInTheDocument();
      fireEvent.click(expandButton!);

      // Should NOT call onToggleContainer (sync is disabled)
      expect(mockOnToggleContainer).not.toHaveBeenCalled();

      // Tree should still expand locally (this was the bug - it didn't work before)
      await waitFor(() => {
        expect(screen.getByText("Node 1")).toBeInTheDocument();
      });
    });

    it("should maintain independent state across multiple operations", async () => {
      const collapsedContainers = new Set(["container1", "container2"]);

      render(
        <HierarchyTree
          visualizationState={visualizationState}
          collapsedContainers={collapsedContainers}
          onToggleContainer={mockOnToggleContainer}
          onElementNavigation={mockOnElementNavigation}
          asyncCoordinator={asyncCoordinator}
          syncEnabled={false}
        />,
      );

      const container1 = screen.getByText("Container 1");
      const expandButton = container1
        .closest(".ant-tree-treenode")
        ?.querySelector(".ant-tree-switcher");

      // Expand
      fireEvent.click(expandButton!);
      await waitFor(() => {
        expect(screen.getByText("Node 1")).toBeInTheDocument();
      });

      // Collapse
      fireEvent.click(expandButton!);
      await waitFor(() => {
        expect(screen.queryByText("Node 1")).not.toBeInTheDocument();
      });

      // Expand again
      fireEvent.click(expandButton!);
      await waitFor(() => {
        expect(screen.getByText("Node 1")).toBeInTheDocument();
      });

      expect(mockOnToggleContainer).not.toHaveBeenCalled();
    });
  });
});
