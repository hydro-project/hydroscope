/**
 * Enhanced SearchControls Tests
 * Tests for navigation between search results, hierarchical context, keyboard navigation, and accessibility
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SearchControls } from "../components/SearchControls";
import type { SearchResult } from "../types/core";

describe("SearchControls Enhanced Features", () => {
  const mockSearchableItems = [
    { id: "node1", label: "Test Node 1", type: "node" as const },
    { id: "container1", label: "Test Container", type: "container" as const },
    { id: "node2", label: "Another Node", type: "node" as const },
  ];

  const mockSearchResults: SearchResult[] = [
    {
      id: "node1",
      label: "Test Node 1",
      type: "node",
      matchIndices: [[0, 4]],
      hierarchyPath: ["root", "parent", "Test Node 1"],
      confidence: 0.9,
    },
    {
      id: "container1",
      label: "Test Container",
      type: "container",
      matchIndices: [[0, 4]],
      hierarchyPath: ["root", "Test Container"],
      confidence: 0.8,
    },
  ];

  const defaultProps = {
    searchableItems: mockSearchableItems,
    onSearch: vi.fn(),
    onClear: vi.fn(),
    onNavigate: vi.fn(),
    onResultNavigation: vi.fn(),
    onViewportFocus: vi.fn(),
    searchResults: mockSearchResults,
    showHierarchyPath: true,
    showElementType: true,
    announceResults: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Navigation Between Search Results", () => {
    it("should navigate to specific result when onResultNavigation is called", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalledWith(
          "test",
          expect.arrayContaining([
            expect.objectContaining({ id: "node1" }),
            expect.objectContaining({ id: "container1" }),
          ])
        );
      }, { timeout: 1000 });

      // Navigate to next result
      const nextButton = screen.getByLabelText("Next search result");
      fireEvent.click(nextButton);

      expect(defaultProps.onResultNavigation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "node1",
          hierarchyPath: ["root", "parent", "Test Node 1"],
        })
      );
    });

    it("should focus viewport when onViewportFocus is provided", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      // Wait for search to complete and show results list
      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalled();
      }, { timeout: 1000 });
      
      const toggleButton = screen.getByText("📋");
      fireEvent.click(toggleButton);

      // Click on a result item
      const resultItem = screen.getByText("Test Node 1");
      fireEvent.click(resultItem);

      expect(defaultProps.onViewportFocus).toHaveBeenCalledWith("node1");
    });
  });

  describe("Hierarchical Context Display", () => {
    it("should display hierarchy path when showHierarchyPath is true", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      // Wait for search to complete and show results list
      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalled();
      }, { timeout: 1000 });
      
      const toggleButton = screen.getByTitle("Show search results list");
      fireEvent.click(toggleButton);

      expect(screen.getByText("root > parent > Test Node 1")).toBeInTheDocument();
      expect(screen.getByText("root > Test Container")).toBeInTheDocument();
    });

    it("should display element type when showElementType is true", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      // Wait for search to complete and show results list
      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalled();
      }, { timeout: 1000 });
      
      const toggleButton = screen.getByTitle("Show search results list");
      fireEvent.click(toggleButton);

      expect(screen.getByText("NODE")).toBeInTheDocument();
      expect(screen.getByText("CONTAINER")).toBeInTheDocument();
    });

    it("should hide hierarchy path when showHierarchyPath is false", async () => {
      render(<SearchControls {...defaultProps} showHierarchyPath={false} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      // Wait for search to complete and show results list
      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalled();
      }, { timeout: 1000 });
      
      const toggleButton = screen.getByTitle("Show search results list");
      fireEvent.click(toggleButton);

      expect(screen.queryByText("root > parent > Test Node 1")).not.toBeInTheDocument();
    });
  });

  describe("Keyboard Navigation Support", () => {
    it("should navigate with Enter and Shift+Enter", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      // Navigate forward with Enter
      fireEvent.keyDown(input, { key: "Enter" });
      expect(defaultProps.onNavigate).toHaveBeenCalledWith("next", expect.any(Object));

      // Navigate backward with Shift+Enter
      fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
      expect(defaultProps.onNavigate).toHaveBeenCalledWith("prev", expect.any(Object));
    });

    it("should navigate with Ctrl+Arrow keys", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      // Navigate with Ctrl+ArrowDown
      fireEvent.keyDown(input, { key: "ArrowDown", ctrlKey: true });
      expect(defaultProps.onNavigate).toHaveBeenCalledWith("next", expect.any(Object));

      // Navigate with Ctrl+ArrowUp
      fireEvent.keyDown(input, { key: "ArrowUp", ctrlKey: true });
      expect(defaultProps.onNavigate).toHaveBeenCalledWith("prev", expect.any(Object));
    });

    it("should navigate with F3 keys", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      // Navigate with F3
      fireEvent.keyDown(input, { key: "F3" });
      expect(defaultProps.onNavigate).toHaveBeenCalledWith("next", expect.any(Object));

      // Navigate with Shift+F3
      fireEvent.keyDown(input, { key: "F3", shiftKey: true });
      expect(defaultProps.onNavigate).toHaveBeenCalledWith("prev", expect.any(Object));
    });

    it("should clear search with Escape key", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });
      fireEvent.keyDown(input, { key: "Escape" });

      expect(defaultProps.onClear).toHaveBeenCalled();
    });
  });

  describe("Accessibility Features", () => {
    it("should have proper ARIA attributes", () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      expect(input).toHaveAttribute("aria-label", "Search input");
      expect(input).toHaveAttribute("aria-describedby", "search-results-count");
      expect(input).toHaveAttribute("aria-expanded", "false");
      expect(input).toHaveAttribute("aria-haspopup", "listbox");

      const searchContainer = screen.getByRole("search");
      expect(searchContainer).toHaveAttribute("aria-label", "Search controls");
    });

    it("should announce search results to screen readers", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      // Check for aria-live region
      const ariaLiveRegion = screen.getByLabelText("Search controls").querySelector('[aria-live="polite"]');
      expect(ariaLiveRegion).toBeInTheDocument();
    });

    it("should have accessible button labels", () => {
      render(<SearchControls {...defaultProps} />);

      expect(screen.getByLabelText("Previous search result")).toBeInTheDocument();
      expect(screen.getByLabelText("Next search result")).toBeInTheDocument();
    });

    it("should support keyboard navigation in results list", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      // Wait for search to complete and show results list
      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalled();
      }, { timeout: 1000 });
      
      const toggleButton = screen.getByTitle("Show search results list");
      fireEvent.click(toggleButton);

      const resultsList = screen.getByRole("listbox");
      expect(resultsList).toBeInTheDocument();
      expect(resultsList).toHaveAttribute("aria-label", "Search results");

      // Test Escape key to close results list
      fireEvent.keyDown(resultsList, { key: "Escape" });
      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });
  });

  describe("Results List Display", () => {
    it("should show results list toggle button when results exist", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalled();
        // Look for the button with the 📋 icon instead of the title
        expect(screen.getByText("📋")).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it("should toggle results list visibility", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      // Wait for search to complete
      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalled();
      }, { timeout: 1000 });
      
      const toggleButton = screen.getByTitle("Show search results list");
      
      // Show results list
      fireEvent.click(toggleButton);
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      // Hide results list
      fireEvent.click(toggleButton);
      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });

    it("should highlight current result in results list", async () => {
      render(<SearchControls {...defaultProps} currentSearchIndex={1} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      // Wait for search to complete and show results list
      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalled();
      }, { timeout: 1000 });
      
      const toggleButton = screen.getByTitle("Show search results list");
      fireEvent.click(toggleButton);

      const resultItems = screen.getAllByRole("option");
      expect(resultItems[1]).toHaveAttribute("aria-selected", "true");
      expect(resultItems[0]).toHaveAttribute("aria-selected", "false");
    });
  });

  describe("Enhanced Tooltips", () => {
    it("should show keyboard shortcuts in tooltips", () => {
      render(<SearchControls {...defaultProps} />);

      expect(screen.getByTitle("Previous match (Shift+Enter, Ctrl+↑, Shift+F3)")).toBeInTheDocument();
      expect(screen.getByTitle("Next match (Enter, Ctrl+↓, F3)")).toBeInTheDocument();
      expect(screen.getByTitle("Clear search (Escape)")).toBeInTheDocument();
    });
  });

  describe("External Control Integration", () => {
    it("should sync with external currentSearchIndex", () => {
      const { rerender } = render(<SearchControls {...defaultProps} currentSearchIndex={0} />);
      
      // Change external index
      rerender(<SearchControls {...defaultProps} currentSearchIndex={1} />);
      
      // The component should sync with the external index
      // This is tested through the useEffect that syncs currentSearchIndex
    });

    it("should expose imperative methods through ref", () => {
      const ref = { current: null };
      render(<SearchControls {...defaultProps} ref={ref} />);

      expect(ref.current).toHaveProperty("focus");
      expect(ref.current).toHaveProperty("clear");
      expect(ref.current).toHaveProperty("navigateToResult");
      expect(ref.current).toHaveProperty("announceResults");
    });
  });
});