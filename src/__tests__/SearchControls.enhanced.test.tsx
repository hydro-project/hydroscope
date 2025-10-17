/**
 * SearchControls Enhanced Features Tests
 *
 * Tests enhanced navigation, accessibility, and UI features
 * for the SearchControls component based on current implementation.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SearchControls } from "../components/SearchControls.js";
import type { SearchResult } from "../types/core.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";

const defaultProps = {
  searchableItems: [
    { id: "node1", label: "Test Node 1", type: "node" as const },
    { id: "container1", label: "Test Container", type: "container" as const },
  ],
  onSearch: vi.fn(),
  onClear: vi.fn(),
  onNavigate: vi.fn(),
  onResultNavigation: vi.fn(),
  onViewportFocus: vi.fn(),
  searchResults: [
    {
      id: "node1",
      label: "Test Node 1",
      type: "node",
      hierarchyPath: ["root", "parent", "Test Node 1"],
      matchIndices: [[0, 4]],
      confidence: 0.9,
    },
    {
      id: "container1",
      label: "Test Container",
      type: "container",
      hierarchyPath: ["root", "Test Container"],
      matchIndices: [[0, 4]],
      confidence: 0.8,
    },
  ] as SearchResult[],
  currentSearchIndex: 0,
  showHierarchyPath: true,
  showElementType: true,
  announceResults: true,
};

describe("SearchControls Enhanced Features", () => {
  let _coordinator: AsyncCoordinator;

  beforeEach(() => {
    const _coordinator = new AsyncCoordinator();
    vi.clearAllMocks();
  });

  describe("Basic Search Functionality", () => {
    it("should render search input and controls", () => {
      render(<SearchControls {...defaultProps} />);

      expect(screen.getByRole("combobox")).toBeInTheDocument();
      expect(
        screen.getByLabelText("Previous search result"),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Next search result")).toBeInTheDocument();
      expect(screen.getByTestId("search-clear-button")).toBeInTheDocument();
    });

    it("should call onSearch when user types", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalledWith(
          "test",
          expect.arrayContaining([
            expect.objectContaining({ id: "container1" }),
            expect.objectContaining({ id: "node1" }),
          ]),
        );
      });
    });

    it("should display search results count", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      await waitFor(() => {
        const resultsCount = screen.getByTestId("search-results");
        expect(resultsCount).toHaveTextContent("1 / 2");
      });
    });
  });

  describe("Navigation Controls", () => {
    it("should navigate with next/prev buttons", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalled();
      });

      const nextButton = screen.getByLabelText("Next search result");
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(defaultProps.onNavigate).toHaveBeenCalledWith(
          "next",
          expect.objectContaining({ id: "container1" }),
        );
      });
    });

    it("should call onResultNavigation when navigating", async () => {
      render(<SearchControls {...defaultProps} />);

      // Type a search query to trigger search
      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalled();
      });

      // Wait for matches to be populated
      await waitFor(() => {
        const nextButton = screen.getByLabelText("Next search result");
        expect(nextButton).not.toBeDisabled();
      });

      // Click next button to navigate
      const nextButton = screen.getByLabelText("Next search result");
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(defaultProps.onResultNavigation).toHaveBeenCalled();
      });

      // Check that onResultNavigation was called with a valid result
      expect(defaultProps.onResultNavigation).toHaveBeenCalled();
      const calls = defaultProps.onResultNavigation.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toHaveProperty("id");
      expect(lastCall[0]).toHaveProperty("type");
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
      await waitFor(() => {
        expect(defaultProps.onNavigate).toHaveBeenCalledWith(
          "next",
          expect.any(Object),
        );
      });
    });

    it("should navigate with Shift+Enter", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalled();
      });

      fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
      await waitFor(() => {
        expect(defaultProps.onNavigate).toHaveBeenCalledWith(
          "prev",
          expect.any(Object),
        );
      });
    });

    it("should clear search with Escape key", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      fireEvent.keyDown(input, { key: "Escape" });

      // Verify search is cleared imperatively (input value should be empty)
      expect(input).toHaveValue("");
    });
  });

  describe("Accessibility Features", () => {
    it("should have proper ARIA attributes", () => {
      render(<SearchControls {...defaultProps} ariaLabel="Search controls" />);

      const searchContainer = screen.getByRole("search");
      expect(searchContainer).toHaveAttribute("aria-label", "Search controls");

      const input = screen.getByRole("combobox");
      expect(input).toHaveAttribute("aria-label", "Search input");
      expect(input).toHaveAttribute("aria-describedby", "search-results-count");
    });

    it("should have accessible button labels", () => {
      render(<SearchControls {...defaultProps} />);

      expect(
        screen.getByLabelText("Previous search result"),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Next search result")).toBeInTheDocument();
    });

    it("should announce search results to screen readers", async () => {
      render(<SearchControls {...defaultProps} announceResults={true} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      // Check for aria-live region
      const ariaLiveRegion = screen.getByLabelText(/search results/i);
      expect(ariaLiveRegion).toBeInTheDocument();
    });
  });

  describe("Results List Toggle", () => {
    it("should show toggle button when results exist", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalled();
      });

      // Look for the toggle button (📋 icon)
      const toggleButton = screen.getByText("📋");
      expect(toggleButton).toBeInTheDocument();
    });
  });

  describe("External Control Integration", () => {
    it("should sync with external currentSearchIndex", async () => {
      render(<SearchControls {...defaultProps} currentSearchIndex={0} />);

      // First trigger a search to make results visible
      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalled();
      });

      // Now check that the component shows the correct index
      const resultsCount = screen.getByTestId("search-results");
      expect(resultsCount).toHaveTextContent("1 / 2"); // Should show first result
    });

    it("should expose imperative methods through ref", () => {
      const ref = React.createRef<any>();
      render(<SearchControls {...defaultProps} ref={ref} />);

      expect(ref.current).toHaveProperty("focus");
      expect(ref.current).toHaveProperty("clear");
      expect(ref.current).toHaveProperty("navigateToResult");
      expect(ref.current).toHaveProperty("announceResults");
    });
  });

  describe("Clear Functionality", () => {
    it("should clear search when clear button is clicked", async () => {
      render(<SearchControls {...defaultProps} />);

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "test" } });

      const clearButton = screen.getByTestId("search-clear-button");
      fireEvent.click(clearButton);

      // Verify search is cleared imperatively (input value should be empty)
      expect(input).toHaveValue("");
    });
  });
});
