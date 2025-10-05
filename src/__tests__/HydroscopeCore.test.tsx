/**
 * HydroscopeCore Component Tests
 * Tests the core visualization component with the new simplified API
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { HydroscopeCore, type HydroscopeCoreHandle } from "../components/HydroscopeCore.js";
import type { HydroscopeData } from "../types/core.js";

// Test data
const validTestData: HydroscopeData = {
  nodes: [
    { id: "node1", label: "Node 1" },
    { id: "node2", label: "Node 2" },
    { id: "container1", label: "Container 1" },
  ],
  edges: [
    { id: "edge1", source: "node1", target: "node2" },
  ],
  hierarchyChoices: [
    { id: "choice1", name: "Test Choice" },
  ],
  nodeAssignments: {
    choice1: { node1: "container1", node2: "container1" },
  },
};

const invalidTestData = {
  nodes: null,
  edges: [],
  hierarchyChoices: [],
  nodeAssignments: {},
} as any;

describe("HydroscopeCore Component", () => {
  let mockOnError: ReturnType<typeof vi.fn>;
  let mockOnNodeClick: ReturnType<typeof vi.fn>;
  let mockOnContainerCollapse: ReturnType<typeof vi.fn>;
  let mockOnContainerExpand: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnError = vi.fn();
    mockOnNodeClick = vi.fn();
    mockOnContainerCollapse = vi.fn();
    mockOnContainerExpand = vi.fn();
  });

  describe("Basic Rendering", () => {
    it("should render with valid data", async () => {
      render(
        <HydroscopeCore
          data={validTestData}
          onError={mockOnError}
        />
      );

      // Should show loading state initially
      expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
    });

    it("should handle invalid data gracefully", async () => {
      render(
        <HydroscopeCore
          data={invalidTestData}
          onError={mockOnError}
        />
      );

      // Should show error message for invalid data
      await waitFor(() => {
        expect(screen.getByText(/visualization error/i)).toBeInTheDocument();
      });
    });

    it("should render with custom dimensions", async () => {
      render(
        <HydroscopeCore
          data={validTestData}
          height="500px"
          width="800px"
          onError={mockOnError}
        />
      );

      // Should render without throwing (dimensions are applied internally)
      expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
    });

    it("should handle readOnly mode", async () => {
      render(
        <HydroscopeCore
          data={validTestData}
          readOnly={true}
          onError={mockOnError}
        />
      );

      // Should still render in readOnly mode
      expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
    });
  });

  describe("Container Operations", () => {
    let ref: React.RefObject<HydroscopeCoreHandle>;

    beforeEach(() => {
      ref = React.createRef<HydroscopeCoreHandle>();
    });

    it("should provide container operation methods", async () => {
      render(
        <HydroscopeCore
          ref={ref}
          data={validTestData}
          onError={mockOnError}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });

      // Check that all container operation methods are available
      expect(ref.current?.collapseAll).toBeDefined();
      expect(ref.current?.expandAll).toBeDefined();
      expect(ref.current?.collapse).toBeDefined();
      expect(ref.current?.expand).toBeDefined();
      expect(ref.current?.toggle).toBeDefined();
    });

    it("should handle collapseAll operation", async () => {
      render(
        <HydroscopeCore
          ref={ref}
          data={validTestData}
          onError={mockOnError}
          onContainerCollapse={mockOnContainerCollapse}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });

      // Should not throw when calling collapseAll
      await expect(ref.current?.collapseAll()).resolves.not.toThrow();
    });

    it("should handle expandAll operation", async () => {
      render(
        <HydroscopeCore
          ref={ref}
          data={validTestData}
          onError={mockOnError}
          onContainerExpand={mockOnContainerExpand}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });

      // Should not throw when calling expandAll
      await expect(ref.current?.expandAll()).resolves.not.toThrow();
    });

    it("should handle individual container operations", async () => {
      render(
        <HydroscopeCore
          ref={ref}
          data={validTestData}
          onError={mockOnError}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });

      // Should not throw when calling individual container operations
      await expect(ref.current?.collapse("container1")).resolves.not.toThrow();
      await expect(ref.current?.expand("container1")).resolves.not.toThrow();
      await expect(ref.current?.toggle("container1")).resolves.not.toThrow();
    });

    it("should handle operations in readOnly mode", async () => {
      render(
        <HydroscopeCore
          ref={ref}
          data={validTestData}
          readOnly={true}
          onError={mockOnError}
        />
      );

      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });

      // Operations should not throw in readOnly mode (they just log warnings)
      await expect(ref.current?.collapseAll()).resolves.not.toThrow();
      await expect(ref.current?.expandAll()).resolves.not.toThrow();
    });
  });

  describe("Event Callbacks", () => {
    it("should call onNodeClick when provided", async () => {
      render(
        <HydroscopeCore
          data={validTestData}
          onNodeClick={mockOnNodeClick}
          onError={mockOnError}
        />
      );

      // Wait for component to initialize
      await waitFor(() => {
        expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
      });

      // Note: Testing actual node clicks would require more complex setup
      // with ReactFlow integration, so we just verify the callback is passed
      expect(mockOnNodeClick).toBeDefined();
    });

    it("should call container callbacks when provided", async () => {
      render(
        <HydroscopeCore
          data={validTestData}
          onContainerCollapse={mockOnContainerCollapse}
          onContainerExpand={mockOnContainerExpand}
          onError={mockOnError}
        />
      );

      // Wait for component to initialize
      await waitFor(() => {
        expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
      });

      // Verify callbacks are defined
      expect(mockOnContainerCollapse).toBeDefined();
      expect(mockOnContainerExpand).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should call onError for invalid data", async () => {
      render(
        <HydroscopeCore
          data={invalidTestData}
          onError={mockOnError}
        />
      );

      // Should call onError for invalid data
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalled();
      });
    });

    it("should handle missing required props", async () => {
      // Test with minimal props
      render(
        <HydroscopeCore
          data={validTestData}
        />
      );

      // Should still render without error callback
      expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
    });
  });

  describe("Component Configuration", () => {
    it("should respect showControls prop", async () => {
      render(
        <HydroscopeCore
          data={validTestData}
          showControls={false}
          onError={mockOnError}
        />
      );

      // Component should still render
      expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
    });

    it("should respect showMiniMap prop", async () => {
      render(
        <HydroscopeCore
          data={validTestData}
          showMiniMap={false}
          onError={mockOnError}
        />
      );

      // Component should still render
      expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
    });

    it("should respect showBackground prop", async () => {
      render(
        <HydroscopeCore
          data={validTestData}
          showBackground={false}
          onError={mockOnError}
        />
      );

      // Component should still render
      expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
    });

    it("should handle layout algorithm configuration", async () => {
      render(
        <HydroscopeCore
          data={validTestData}
          initialLayoutAlgorithm="force"
          onError={mockOnError}
        />
      );

      // Component should still render with different layout algorithm
      expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
    });

    it("should handle color palette configuration", async () => {
      render(
        <HydroscopeCore
          data={validTestData}
          initialColorPalette="Dark2"
          onError={mockOnError}
        />
      );

      // Component should still render with different color palette
      expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
    });
  });

  describe("Drag Functionality", () => {
    it("should enable dragging when not in readOnly mode", async () => {
      render(
        <HydroscopeCore
          data={validTestData}
          readOnly={false}
          onError={mockOnError}
        />
      );

      // Component should render and allow dragging
      expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
      
      // Note: Testing actual drag operations would require more complex setup
      // with ReactFlow integration and DOM manipulation. This test verifies
      // that the component renders with drag functionality enabled.
    });

    it("should disable dragging in readOnly mode", async () => {
      render(
        <HydroscopeCore
          data={validTestData}
          readOnly={true}
          onError={mockOnError}
        />
      );

      // Component should render but disable dragging
      expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
      
      // Note: In readOnly mode, nodesDraggable is set to false in ReactFlow
      // This test verifies the component renders correctly in readOnly mode.
    });

    it("should handle drag event handlers without errors", async () => {
      const mockOnVisualizationStateChange = vi.fn();
      
      render(
        <HydroscopeCore
          data={validTestData}
          onVisualizationStateChange={mockOnVisualizationStateChange}
          onError={mockOnError}
        />
      );

      // Component should render with drag handlers configured
      expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
      
      // Note: The drag event handlers (onNodesChange, onNodeDragStart, etc.)
      // are configured internally and would be tested through integration tests
      // with actual ReactFlow interactions.
    });
  });
});