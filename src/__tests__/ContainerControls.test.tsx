/**
 * ContainerControls Component Tests
 * Tests container expand/collapse UI components with proper state management
 */

import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ContainerControls,
  IndividualContainerControl,
  useContainerControls,
} from "../components/ContainerControls.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import type { Container } from "../types/core.js";

describe("ContainerControls Component", () => {
  let coordinator: AsyncCoordinator;
  let visualizationState: VisualizationState;
  let mockOnOperationComplete: ReturnType<typeof vi.fn>;
  let mockOnError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    coordinator = new AsyncCoordinator();
    visualizationState = new VisualizationState();

    // Add test data
    visualizationState.addContainer({
      id: "container1",
      label: "Container 1",
      children: new Set(["node1", "node2"]),
      collapsed: true,
      hidden: false,
    });

    visualizationState.addContainer({
      id: "container2",
      label: "Container 2",
      children: new Set(["node3", "node4", "node5"]),
      collapsed: false,
      hidden: false,
    });

    visualizationState.addContainer({
      id: "container3",
      label: "Container 3",
      children: new Set(["node6"]),
      collapsed: true,
      hidden: false,
    });

    mockOnOperationComplete = vi.fn();
    mockOnError = vi.fn();
  });

  describe("Basic Rendering", () => {
    it("should render expand and collapse buttons", () => {
      render(
        <ContainerControls
          visualizationState={visualizationState}
          asyncCoordinator={coordinator}
        />,
      );

      expect(screen.getByText(/Expand All/)).toBeInTheDocument();
      expect(screen.getByText(/Collapse All/)).toBeInTheDocument();
    });

    it("should show correct container counts", () => {
      render(
        <ContainerControls
          visualizationState={visualizationState}
          asyncCoordinator={coordinator}
          showFeedback={true}
        />,
      );

      expect(screen.getByText("Total: 3")).toBeInTheDocument();
      expect(screen.getByText("Expanded: 1")).toBeInTheDocument();
      expect(screen.getByText("Collapsed: 2")).toBeInTheDocument();
    });

    it("should disable buttons when no containers to operate on", () => {
      const emptyState = new VisualizationState(); // Empty state with no containers

      render(
        <ContainerControls
          visualizationState={emptyState}
          asyncCoordinator={coordinator}
        />,
      );

      const expandButton = screen.getByText(/Expand All/);
      const collapseButton = screen.getByText(/Collapse All/);

      expect(expandButton).toBeDisabled();
      expect(collapseButton).toBeDisabled();
    });

    it("should disable buttons when disabled prop is true", () => {
      render(
        <ContainerControls
          visualizationState={visualizationState}
          asyncCoordinator={coordinator}
          disabled={true}
        />,
      );

      const expandButton = screen.getByText(/Expand All/);
      const collapseButton = screen.getByText(/Collapse All/);

      expect(expandButton).toBeDisabled();
      expect(collapseButton).toBeDisabled();
    });
  });

  describe("Expand All Functionality", () => {
    it("should call expandAllContainers when expand all is clicked", async () => {
      render(
        <ContainerControls
          visualizationState={visualizationState}
          asyncCoordinator={coordinator}
          onOperationComplete={mockOnOperationComplete}
        />,
      );

      const expandButton = screen.getByText(/Expand All/);

      await act(async () => {
        fireEvent.click(expandButton);
      });

      expect(mockOnOperationComplete).toHaveBeenCalledWith("expand");
    });

    it("should show loading state during expand all operation", async () => {
      render(
        <ContainerControls
          visualizationState={visualizationState}
          asyncCoordinator={coordinator}
          showFeedback={true}
        />,
      );

      const expandButton = screen.getByText(/Expand All/);

      // Click and check for loading state
      fireEvent.click(expandButton);

      // Should show loading text briefly
      await waitFor(
        () => {
          expect(expandButton).toHaveTextContent("Expanding...");
        },
        { timeout: 100 },
      );
    });

    it("should handle expand all errors gracefully", async () => {
      // Create a coordinator that will fail
      const failingCoordinator = new AsyncCoordinator();
      failingCoordinator.expandAllContainers = vi
        .fn()
        .mockRejectedValue(new Error("Test error"));

      render(
        <ContainerControls
          visualizationState={visualizationState}
          asyncCoordinator={failingCoordinator}
          onError={mockOnError}
        />,
      );

      const expandButton = screen.getByText(/Expand All/);

      await act(async () => {
        fireEvent.click(expandButton);
      });

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalled();
      });
    });

    it("should not expand when no collapsed containers exist", async () => {
      const allExpandedState = new VisualizationState();
      // Add expanded containers
      allExpandedState.addContainer({
        id: "container1",
        label: "Container 1",
        children: new Set(["node1"]),
        collapsed: false,
        hidden: false,
      });

      render(
        <ContainerControls
          visualizationState={allExpandedState}
          asyncCoordinator={coordinator}
        />,
      );

      const expandButton = screen.getByText(/Expand All/);
      expect(expandButton).toBeDisabled();
    });
  });

  describe("Collapse All Functionality", () => {
    it("should call collapseAllContainers when collapse all is clicked", async () => {
      // Ensure we have expanded containers to collapse
      await coordinator.expandContainer("container1", visualizationState, {
        triggerLayout: false,
      });
      await coordinator.expandContainer("container3", visualizationState, {
        triggerLayout: false,
      });

      let operationCompleted = false;
      const onOperationComplete = (operation: "expand" | "collapse") => {
        if (operation === "collapse") {
          operationCompleted = true;
        }
      };

      render(
        <ContainerControls
          visualizationState={visualizationState}
          asyncCoordinator={coordinator}
          onOperationComplete={onOperationComplete}
        />,
      );

      const collapseButton = screen.getByText(/Collapse All/);

      await act(async () => {
        fireEvent.click(collapseButton);
      });

      // Wait for the operation to complete
      await waitFor(() => {
        expect(operationCompleted).toBe(true);
      });
    });

    it("should show loading state during collapse all operation", async () => {
      render(
        <ContainerControls
          visualizationState={visualizationState}
          asyncCoordinator={coordinator}
          showFeedback={true}
        />,
      );

      const collapseButton = screen.getByText(/Collapse All/);

      // Click and check for loading state
      fireEvent.click(collapseButton);

      // Should show loading text briefly
      await waitFor(
        () => {
          expect(collapseButton).toHaveTextContent("Collapsing...");
        },
        { timeout: 100 },
      );
    });

    it("should handle collapse all errors gracefully", async () => {
      // Create a coordinator that will fail
      const failingCoordinator = new AsyncCoordinator();
      failingCoordinator.collapseAllContainers = vi
        .fn()
        .mockRejectedValue(new Error("Collapse failed"));

      render(
        <ContainerControls
          visualizationState={visualizationState}
          asyncCoordinator={failingCoordinator}
          onError={mockOnError}
        />,
      );

      const collapseButton = screen.getByText(/Collapse All/);

      await act(async () => {
        fireEvent.click(collapseButton);
      });

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalled();
      });
    });
  });

  describe("Error Handling", () => {
    it("should display error messages when showFeedback is true", async () => {
      const failingCoordinator = new AsyncCoordinator();
      failingCoordinator.expandAllContainers = vi
        .fn()
        .mockRejectedValue(new Error("Test error"));

      render(
        <ContainerControls
          visualizationState={visualizationState}
          asyncCoordinator={failingCoordinator}
          showFeedback={true}
        />,
      );

      const expandButton = screen.getByText(/Expand All/);

      await act(async () => {
        fireEvent.click(expandButton);
      });

      await waitFor(() => {
        expect(screen.getByText("Error: Test error")).toBeInTheDocument();
      });
    });

    it("should allow clearing error messages", async () => {
      const failingCoordinator = new AsyncCoordinator();
      failingCoordinator.expandAllContainers = vi
        .fn()
        .mockRejectedValue(new Error("Test error"));

      render(
        <ContainerControls
          visualizationState={visualizationState}
          asyncCoordinator={failingCoordinator}
          showFeedback={true}
        />,
      );

      const expandButton = screen.getByText(/Expand All/);

      await act(async () => {
        fireEvent.click(expandButton);
      });

      await waitFor(() => {
        expect(screen.getByText("Error: Test error")).toBeInTheDocument();
      });

      const clearButton = screen.getByText("×");
      fireEvent.click(clearButton);

      expect(screen.queryByText("Error: Test error")).not.toBeInTheDocument();
    });
  });

  describe("Feedback Display", () => {
    it("should show operation counter when operations are performed", async () => {
      render(
        <ContainerControls
          visualizationState={visualizationState}
          asyncCoordinator={coordinator}
          showFeedback={true}
        />,
      );

      const expandButton = screen.getByText(/Expand All/);

      await act(async () => {
        fireEvent.click(expandButton);
      });

      await waitFor(() => {
        expect(screen.getByText("Operations: 1")).toBeInTheDocument();
      });
    });

    it("should not show feedback when showFeedback is false", () => {
      render(
        <ContainerControls
          visualizationState={visualizationState}
          asyncCoordinator={coordinator}
          showFeedback={false}
        />,
      );

      expect(screen.queryByText("Total:")).not.toBeInTheDocument();
      expect(screen.queryByText("Expanded:")).not.toBeInTheDocument();
      expect(screen.queryByText("Collapsed:")).not.toBeInTheDocument();
    });
  });
});

describe("IndividualContainerControl Component", () => {
  let coordinator: AsyncCoordinator;
  let visualizationState: VisualizationState;
  let mockOnOperationComplete: ReturnType<typeof vi.fn>;
  let mockOnError: ReturnType<typeof vi.fn>;

  const testContainer: Container = {
    id: "test-container",
    label: "Test Container",
    children: new Set(["node1", "node2"]),
    collapsed: true,
    hidden: false,
  };

  const expandedContainer: Container = {
    id: "test-container",
    label: "Test Container",
    children: new Set(["node1", "node2"]),
    collapsed: false,
    hidden: false,
  };

  beforeEach(() => {
    coordinator = new AsyncCoordinator();
    visualizationState = new VisualizationState();
    mockOnOperationComplete = vi.fn();
    mockOnError = vi.fn();
  });

  describe("Basic Rendering", () => {
    it("should render container information", () => {
      render(
        <IndividualContainerControl
          container={testContainer}
          visualizationState={visualizationState}
          asyncCoordinator={coordinator}
        />,
      );

      expect(screen.getByText("Test Container")).toBeInTheDocument();
      expect(screen.getByText("(2)")).toBeInTheDocument(); // child count
      expect(screen.getByText("▶")).toBeInTheDocument(); // collapsed icon
    });

    it("should show expanded icon for expanded containers", () => {
      render(
        <IndividualContainerControl
          container={expandedContainer}
          visualizationState={visualizationState}
          asyncCoordinator={coordinator}
        />,
      );

      expect(screen.getByText("▼")).toBeInTheDocument(); // expanded icon
    });

    it("should be disabled when disabled prop is true", () => {
      render(
        <IndividualContainerControl
          container={testContainer}
          visualizationState={visualizationState}
          asyncCoordinator={coordinator}
          disabled={true}
        />,
      );

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });
  });

  describe("Toggle Functionality", () => {
    it("should expand collapsed container when clicked", async () => {
      render(
        <IndividualContainerControl
          container={testContainer}
          visualizationState={visualizationState}
          asyncCoordinator={coordinator}
          onOperationComplete={mockOnOperationComplete}
        />,
      );

      const button = screen.getByRole("button");

      await act(async () => {
        fireEvent.click(button);
      });

      expect(mockOnOperationComplete).toHaveBeenCalledWith(
        "expand",
        "test-container",
      );
    });

    it("should collapse expanded container when clicked", async () => {
      render(
        <IndividualContainerControl
          container={expandedContainer}
          visualizationState={visualizationState}
          asyncCoordinator={coordinator}
          onOperationComplete={mockOnOperationComplete}
        />,
      );

      const button = screen.getByRole("button");

      await act(async () => {
        fireEvent.click(button);
      });

      expect(mockOnOperationComplete).toHaveBeenCalledWith(
        "collapse",
        "test-container",
      );
    });

    it("should show loading state during operation", async () => {
      render(
        <IndividualContainerControl
          container={testContainer}
          visualizationState={visualizationState}
          asyncCoordinator={coordinator}
          showLoading={true}
        />,
      );

      const button = screen.getByRole("button");

      fireEvent.click(button);

      // Should show loading icon briefly
      await waitFor(
        () => {
          expect(screen.getByText("⟳")).toBeInTheDocument();
        },
        { timeout: 100 },
      );
    });

    it("should handle toggle errors gracefully", async () => {
      const failingCoordinator = new AsyncCoordinator();
      failingCoordinator.expandContainer = vi
        .fn()
        .mockRejectedValue(new Error("Toggle failed"));

      render(
        <IndividualContainerControl
          container={testContainer}
          visualizationState={visualizationState}
          asyncCoordinator={failingCoordinator}
          onError={mockOnError}
        />,
      );

      const button = screen.getByRole("button");

      await act(async () => {
        fireEvent.click(button);
      });

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalled();
      });
    });

    it("should allow clearing individual errors", async () => {
      const failingCoordinator = new AsyncCoordinator();
      failingCoordinator.expandContainer = vi
        .fn()
        .mockRejectedValue(new Error("Toggle failed"));

      render(
        <IndividualContainerControl
          container={testContainer}
          visualizationState={visualizationState}
          asyncCoordinator={failingCoordinator}
        />,
      );

      const button = screen.getByRole("button");

      await act(async () => {
        fireEvent.click(button);
      });

      await waitFor(() => {
        expect(screen.getByText("Toggle failed")).toBeInTheDocument();
      });

      const clearButton = screen.getByText("×");
      fireEvent.click(clearButton);

      expect(screen.queryByText("Toggle failed")).not.toBeInTheDocument();
    });
  });
});

describe("useContainerControls Hook", () => {
  let coordinator: AsyncCoordinator;
  let visualizationState: VisualizationState;

  beforeEach(() => {
    coordinator = new AsyncCoordinator();
    visualizationState = new VisualizationState();
  });

  const TestComponent = () => {
    const {
      expandAll,
      collapseAll,
      toggleContainer,
      isExpanding,
      isCollapsing,
      operatingContainers,
      lastError,
      clearError,
    } = useContainerControls(visualizationState, coordinator);

    return (
      <div>
        <button onClick={expandAll} disabled={isExpanding}>
          {isExpanding ? "Expanding..." : "Expand All"}
        </button>
        <button onClick={collapseAll} disabled={isCollapsing}>
          {isCollapsing ? "Collapsing..." : "Collapse All"}
        </button>
        <button onClick={() => toggleContainer("test-container")}>
          Toggle Container
        </button>
        {lastError && (
          <div>
            <span>Error: {lastError.message}</span>
            <button onClick={clearError}>Clear</button>
          </div>
        )}
        <div>Operating: {operatingContainers.size}</div>
      </div>
    );
  };

  it("should provide expand all functionality", async () => {
    render(<TestComponent />);

    const expandButton = screen.getByText("Expand All");

    await act(async () => {
      fireEvent.click(expandButton);
    });

    // Should complete without errors
    expect(screen.getByText("Expand All")).toBeInTheDocument();
  });

  it("should provide collapse all functionality", async () => {
    // Ensure we have expanded containers to collapse
    await coordinator.expandContainer("container1", visualizationState, {
      triggerLayout: false,
    });
    await coordinator.expandContainer("container3", visualizationState, {
      triggerLayout: false,
    });

    render(<TestComponent />);

    const collapseButton = screen.getByText("Collapse All");

    await act(async () => {
      fireEvent.click(collapseButton);
    });

    // Wait for the operation to complete and button text to return to normal
    await waitFor(() => {
      expect(screen.getByText("Collapse All")).toBeInTheDocument();
    });
  });

  it("should provide toggle container functionality", async () => {
    // Add a container to the state
    visualizationState.addContainer({
      id: "test-container",
      label: "Test",
      children: new Set(),
      collapsed: true,
      hidden: false,
    });

    render(<TestComponent />);

    const toggleButton = screen.getByText("Toggle Container");

    await act(async () => {
      fireEvent.click(toggleButton);
    });

    // Should complete without errors
    expect(screen.getByText("Toggle Container")).toBeInTheDocument();
  });

  it("should handle errors and provide error clearing", async () => {
    const failingCoordinator = new AsyncCoordinator();
    failingCoordinator.expandAllContainers = vi.fn().mockImplementation(() => {
      return Promise.reject(new Error("Hook test error"));
    });

    // Suppress console errors for this test
    const originalError = console.error;
    console.error = vi.fn();

    // Handle unhandled promise rejections for this test
    const originalUnhandledRejection = process.listeners("unhandledRejection");
    process.removeAllListeners("unhandledRejection");
    process.on("unhandledRejection", () => {
      // Ignore unhandled rejections for this test
    });

    const TestComponentWithError = () => {
      const { expandAll, lastError, clearError } = useContainerControls(
        visualizationState,
        failingCoordinator,
      );

      return (
        <div>
          <button onClick={expandAll}>Expand All</button>
          {lastError && (
            <div>
              <span>Error: {lastError.message}</span>
              <button onClick={clearError}>Clear</button>
            </div>
          )}
        </div>
      );
    };

    render(<TestComponentWithError />);

    const expandButton = screen.getByText("Expand All");

    await act(async () => {
      try {
        fireEvent.click(expandButton);
      } catch (error) {
        // Expected error, ignore
      }
    });

    await waitFor(() => {
      expect(screen.getByText("Error: Hook test error")).toBeInTheDocument();
    });

    const clearButton = screen.getByText("Clear");
    fireEvent.click(clearButton);

    expect(
      screen.queryByText("Error: Hook test error"),
    ).not.toBeInTheDocument();

    // Restore console.error
    console.error = originalError;

    // Restore unhandled rejection handlers
    process.removeAllListeners("unhandledRejection");
    originalUnhandledRejection.forEach((listener) => {
      process.on("unhandledRejection", listener);
    });
  });
});
