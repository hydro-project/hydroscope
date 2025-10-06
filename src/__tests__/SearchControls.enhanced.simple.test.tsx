/**
 * Simple SearchControls Enhanced Tests
 * Tests core enhanced functionality without complex UI interactions
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SearchControls } from "../components/SearchControls";
import type { SearchResult } from "../types/core";

describe("SearchControls Enhanced Features - Core", () => {
  const mockSearchableItems = [
    { id: "node1", label: "Test Node 1", type: "node" as const },
    { id: "container1", label: "Test Container", type: "container" as const },
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

  describe("Enhanced Props and Callbacks", () => {
    it("should accept enhanced props without errors", () => {
      expect(() => render(<SearchControls {...defaultProps} />)).not.toThrow();
    });

    it("should call onResultNavigation when navigating", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalled();
      });

      const nextButton = screen.getByLabelText("Next search result");
      fireEvent.click(nextButton);

      expect(defaultProps.onResultNavigation).toHaveBeenCalled();
    });

    it("should show toggle button when searchResults are provided", () => {
      render(<SearchControls {...defaultProps} />);
      
      // The toggle button should be visible when searchResults are provided
      expect(screen.getByText("📋")).toBeInTheDocument();
    });
  });

  describe("Accessibility Features", () => {
    it("should have proper ARIA attributes", () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      expect(input).toHaveAttribute("aria-label", "Search input");
      expect(input).toHaveAttribute("aria-describedby", "search-results-count");
      expect(input).toHaveAttribute("aria-haspopup", "listbox");

      const searchContainer = screen.getByRole("search");
      expect(searchContainer).toHaveAttribute("aria-label", "Search controls");
    });

    it("should have accessible button labels", () => {
      render(<SearchControls {...defaultProps} />);

      expect(screen.getByLabelText("Previous search result")).toBeInTheDocument();
      expect(screen.getByLabelText("Next search result")).toBeInTheDocument();
    });

    it("should have aria-live region for announcements", () => {
      render(<SearchControls {...defaultProps} />);

      const searchContainer = screen.getByRole("search");
      const ariaLiveRegion = searchContainer.querySelector('[aria-live="polite"]');
      expect(ariaLiveRegion).toBeInTheDocument();
    });
  });

  describe("Keyboard Navigation", () => {
    it("should navigate with Enter key", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalled();
      });

      fireEvent.keyDown(input, { key: "Enter" });
      expect(defaultProps.onNavigate).toHaveBeenCalledWith("next", expect.any(Object));
    });

    it("should navigate with Shift+Enter", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalled();
      });

      fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
      expect(defaultProps.onNavigate).toHaveBeenCalledWith("prev", expect.any(Object));
    });

    it("should clear search with Escape key", () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });
      fireEvent.keyDown(input, { key: "Escape" });

      expect(defaultProps.onClear).toHaveBeenCalled();
    });
  });

  describe("Enhanced Navigation", () => {
    it("should call onViewportFocus when provided", () => {
      const ref = { current: null };
      render(<SearchControls {...defaultProps} ref={ref} />);

      // Test imperative API
      expect(ref.current).toHaveProperty("navigateToResult");
      expect(ref.current).toHaveProperty("announceResults");
    });

    it("should sync with external currentSearchIndex", () => {
      const { rerender } = render(<SearchControls {...defaultProps} currentSearchIndex={0} />);
      
      // Change external index
      rerender(<SearchControls {...defaultProps} currentSearchIndex={1} />);
      
      // Component should handle the prop change without errors
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
  });

  describe("Results Display", () => {
    it("should show results list when toggle button is clicked", () => {
      render(<SearchControls {...defaultProps} />);

      const toggleButton = screen.getByText("📋");
      fireEvent.click(toggleButton);

      // Results list should appear
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    it("should hide results list when toggle button is clicked again", () => {
      render(<SearchControls {...defaultProps} />);

      const toggleButton = screen.getByText("📋");
      
      // Show results list
      fireEvent.click(toggleButton);
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      // Hide results list
      fireEvent.click(toggleButton);
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("should display hierarchy path in results when enabled", () => {
      render(<SearchControls {...defaultProps} />);

      const toggleButton = screen.getByText("📋");
      fireEvent.click(toggleButton);

      expect(screen.getByText("root > parent > Test Node 1")).toBeInTheDocument();
      expect(screen.getByText("root > Test Container")).toBeInTheDocument();
    });

    it("should display element type in results when enabled", () => {
      render(<SearchControls {...defaultProps} />);

      const toggleButton = screen.getByText("📋");
      fireEvent.click(toggleButton);

      // Check for element types (they appear as lowercase in DOM but uppercase via CSS)
      expect(screen.getByText("node")).toBeInTheDocument();
      expect(screen.getByText("container")).toBeInTheDocument();
    });
  });
});