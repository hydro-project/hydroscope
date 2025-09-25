/**
 * Search Component Tests
 * Tests for integrated search component with input and results
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Search, type SearchProps } from "../components/Search.js";
import type { SearchResult } from "../types/core.js";

describe("Search Component", () => {
  const mockSearchResults: SearchResult[] = [
    {
      id: "node1",
      label: "Test Node",
      type: "node",
      matchIndices: [[0, 4]],
    },
    {
      id: "container1",
      label: "Test Container",
      type: "container",
      matchIndices: [[0, 4]],
    },
  ];

  const defaultProps: SearchProps = {
    onSearch: vi.fn(),
    onClear: vi.fn(),
    onResultSelect: vi.fn(),
    searchResults: [],
    isSearching: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Integration Behavior", () => {
    it("should render both search input and results", () => {
      render(<Search {...defaultProps} searchResults={mockSearchResults} />);

      // Search input should be present
      expect(
        screen.getByRole("textbox", { name: /search/i }),
      ).toBeInTheDocument();

      // Results should be present
      expect(screen.getByTestId("search-result-node1")).toBeInTheDocument();
      expect(
        screen.getByTestId("search-result-container1"),
      ).toBeInTheDocument();
    });

    it("should handle search input and display results", async () => {
      const onSearch = vi.fn();
      render(<Search {...defaultProps} onSearch={onSearch} />);

      const input = screen.getByRole("textbox", { name: /search/i });
      fireEvent.change(input, { target: { value: "test" } });

      await waitFor(() => {
        expect(onSearch).toHaveBeenCalledWith("test");
      });
    });

    it("should navigate through results with keyboard", async () => {
      const onResultSelect = vi.fn();
      render(
        <Search
          {...defaultProps}
          searchResults={mockSearchResults}
          onResultSelect={onResultSelect}
        />,
      );

      const input = screen.getByRole("textbox", { name: /search/i });

      // Navigate down to first result
      fireEvent.keyDown(input, { key: "ArrowDown" });

      // Should highlight first result
      const firstResult = screen.getByTestId("search-result-node1");
      expect(firstResult).toHaveClass("current-result");
    });

    it("should select result when clicked", () => {
      const onResultSelect = vi.fn();
      render(
        <Search
          {...defaultProps}
          searchResults={mockSearchResults}
          onResultSelect={onResultSelect}
        />,
      );

      const firstResult = screen.getByTestId("search-result-node1");
      fireEvent.click(firstResult);

      expect(onResultSelect).toHaveBeenCalledWith(mockSearchResults[0]);
    });

    it("should clear search and results", () => {
      const onClear = vi.fn();
      render(
        <Search
          {...defaultProps}
          onClear={onClear}
          searchResults={mockSearchResults}
          query="test"
        />,
      );

      const clearButton = screen.getByRole("button", { name: /clear/i });
      fireEvent.click(clearButton);

      expect(onClear).toHaveBeenCalled();
    });
  });

  describe("Navigation State Management", () => {
    it("should track current result index correctly", () => {
      render(<Search {...defaultProps} searchResults={mockSearchResults} />);

      const input = screen.getByRole("textbox", { name: /search/i });

      // Navigate to first result
      fireEvent.keyDown(input, { key: "ArrowDown" });

      let firstResult = screen.getByTestId("search-result-node1");
      expect(firstResult).toHaveClass("current-result");

      // Navigate to second result
      fireEvent.keyDown(input, { key: "ArrowDown" });

      const secondResult = screen.getByTestId("search-result-container1");
      expect(secondResult).toHaveClass("current-result");

      // First result should no longer be current
      firstResult = screen.getByTestId("search-result-node1");
      expect(firstResult).not.toHaveClass("current-result");
    });

    it("should wrap navigation at boundaries", () => {
      render(<Search {...defaultProps} searchResults={mockSearchResults} />);

      const input = screen.getByRole("textbox", { name: /search/i });

      // Navigate to last result
      fireEvent.keyDown(input, { key: "ArrowDown" }); // First
      fireEvent.keyDown(input, { key: "ArrowDown" }); // Second

      const secondResult = screen.getByTestId("search-result-container1");
      expect(secondResult).toHaveClass("current-result");

      // Navigate past last should wrap to first
      fireEvent.keyDown(input, { key: "ArrowDown" });

      const firstResult = screen.getByTestId("search-result-node1");
      expect(firstResult).toHaveClass("current-result");
    });

    it("should handle navigation with empty results", () => {
      render(<Search {...defaultProps} searchResults={[]} />);

      const input = screen.getByRole("textbox", { name: /search/i });

      // Should not crash when navigating with no results
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowUp" });

      // The results panel should not be shown when there are no results and no query
      expect(screen.queryByText("No search results")).not.toBeInTheDocument();
    });
  });

  describe("Search State Synchronization", () => {
    it("should reset navigation when search results change", () => {
      const { rerender } = render(
        <Search {...defaultProps} searchResults={mockSearchResults} />,
      );

      const input = screen.getByRole("textbox", { name: /search/i });

      // Navigate to second result
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowDown" });

      const secondResult = screen.getByTestId("search-result-container1");
      expect(secondResult).toHaveClass("current-result");

      // Change search results
      const newResults = [mockSearchResults[0]]; // Only first result
      rerender(<Search {...defaultProps} searchResults={newResults} />);

      // Navigation should reset - no result should be current initially
      const remainingResult = screen.getByTestId("search-result-node1");
      expect(remainingResult).not.toHaveClass("current-result");
    });

    it("should maintain navigation state when results are the same", () => {
      const { rerender } = render(
        <Search {...defaultProps} searchResults={mockSearchResults} />,
      );

      const input = screen.getByRole("textbox", { name: /search/i });

      // Navigate to second result
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowDown" });

      let secondResult = screen.getByTestId("search-result-container1");
      expect(secondResult).toHaveClass("current-result");

      // Re-render with same results
      rerender(<Search {...defaultProps} searchResults={mockSearchResults} />);

      // Navigation should be maintained
      secondResult = screen.getByTestId("search-result-container1");
      expect(secondResult).toHaveClass("current-result");
    });
  });

  describe("Accessibility Integration", () => {
    it("should announce search results to screen readers", () => {
      render(<Search {...defaultProps} searchResults={mockSearchResults} />);

      const resultsContainer = screen.getByRole("list", {
        name: /search results/i,
      });
      expect(resultsContainer).toBeInTheDocument();
    });

    it("should provide proper keyboard navigation flow", () => {
      render(<Search {...defaultProps} searchResults={mockSearchResults} />);

      const input = screen.getByRole("textbox", { name: /search/i });
      const results = screen.getAllByRole("listitem");

      // Input should be focusable (inputs are focusable by default, no tabindex needed)
      expect(input).toBeInTheDocument();

      // Results should be focusable
      results.forEach((result) => {
        if (result.getAttribute("data-testid")?.startsWith("search-result-")) {
          expect(result).toHaveAttribute("tabindex", "0");
        }
      });
    });
  });
});
