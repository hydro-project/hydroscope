/**
 * SearchResults Component Tests
 * Tests for search results display with highlighting
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SearchResults,
  type SearchResultsProps,
} from "../components/SearchResults.js";
import type { SearchResult } from "../types/core.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";

describe("SearchResults Component", () => {
  let coordinator: AsyncCoordinator;

  const mockSearchResults: SearchResult[] = [
    {
      id: "node1",
      label: "Test Node One",
      type: "node",
      matchIndices: [
        [0, 4],
        [5, 9],
      ], // "Test" and "Node"
    },
    {
      id: "container1",
      label: "Test Container",
      type: "container",
      matchIndices: [[0, 4]], // "Test"
    },
    {
      id: "node2",
      label: "Another Test Item",
      type: "node",
      matchIndices: [[8, 12]], // "Test"
    },
  ];

  const defaultProps: SearchResultsProps = {
    searchResults: mockSearchResults,
    currentResultIndex: 0,
    onResultClick: vi.fn(),
    onResultHover: vi.fn(),
    query: "test",
  };

  beforeEach(() => {
    const coordinator = new AsyncCoordinator();
    vi.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("should render all search results", () => {
      render(<SearchResults {...defaultProps} />);

      // Check that all results are rendered by their test IDs
      expect(screen.getByTestId("search-result-node1")).toBeInTheDocument();
      expect(
        screen.getByTestId("search-result-container1"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("search-result-node2")).toBeInTheDocument();
    });

    it("should render empty state when no results", () => {
      render(<SearchResults {...defaultProps} searchResults={[]} />);

      expect(screen.getByText("No search results")).toBeInTheDocument();
    });

    it("should display result types correctly", () => {
      render(<SearchResults {...defaultProps} />);

      // Check for type indicators - use getAllByText since there are multiple nodes
      expect(screen.getAllByText("node")).toHaveLength(2);
      expect(screen.getByText("container")).toBeInTheDocument();
    });
  });

  describe("Result Highlighting", () => {
    it("should highlight matching text in results", () => {
      const { container } = render(<SearchResults {...defaultProps} />);

      // Check for highlighted text elements
      const highlights = container.querySelectorAll(".search-highlight");
      expect(highlights.length).toBeGreaterThan(0);
    });

    it("should highlight multiple matches in single result", () => {
      render(<SearchResults {...defaultProps} />);

      // First result has two matches: "Test" and "Node"
      const firstResult = screen.getByTestId("search-result-node1");
      const highlights = firstResult.querySelectorAll(".search-highlight");
      expect(highlights.length).toBe(2);
    });

    it("should handle case-insensitive highlighting", () => {
      const propsWithUpperCase = {
        ...defaultProps,
        query: "TEST",
      };
      const { container } = render(<SearchResults {...propsWithUpperCase} />);

      const highlights = container.querySelectorAll(".search-highlight");
      expect(highlights.length).toBeGreaterThan(0);
    });
  });

  describe("Current Result Selection", () => {
    it("should highlight current result", () => {
      render(<SearchResults {...defaultProps} currentResultIndex={0} />);

      const currentResult = screen.getByTestId("search-result-node1");
      expect(currentResult).toHaveClass("current-result");
    });

    it("should change current result when index changes", () => {
      const { rerender } = render(
        <SearchResults {...defaultProps} currentResultIndex={0} />,
      );

      let currentResult = screen.getByTestId("search-result-node1");
      expect(currentResult).toHaveClass("current-result");

      rerender(<SearchResults {...defaultProps} currentResultIndex={1} />);

      currentResult = screen.getByTestId("search-result-container1");
      expect(currentResult).toHaveClass("current-result");
    });

    it("should handle invalid current result index gracefully", () => {
      render(<SearchResults {...defaultProps} currentResultIndex={999} />);

      // Should not crash and no result should be marked as current
      const results = screen.getAllByTestId(/search-result-/);
      results.forEach((result) => {
        expect(result).not.toHaveClass("current-result");
      });
    });
  });

  describe("Result Interaction", () => {
    it("should call onResultClick when result is clicked", () => {
      const onResultClick = vi.fn();
      render(<SearchResults {...defaultProps} onResultClick={onResultClick} />);

      const firstResult = screen.getByTestId("search-result-node1");
      fireEvent.click(firstResult);

      expect(onResultClick).toHaveBeenCalledWith(mockSearchResults[0], 0);
    });

    it("should call onResultHover when result is hovered", () => {
      const onResultHover = vi.fn();
      render(<SearchResults {...defaultProps} onResultHover={onResultHover} />);

      const firstResult = screen.getByTestId("search-result-node1");
      fireEvent.mouseEnter(firstResult);

      expect(onResultHover).toHaveBeenCalledWith(mockSearchResults[0], 0);
    });

    it("should handle keyboard navigation", () => {
      const onResultClick = vi.fn();
      render(<SearchResults {...defaultProps} onResultClick={onResultClick} />);

      const firstResult = screen.getByTestId("search-result-node1");
      fireEvent.keyDown(firstResult, { key: "Enter" });

      expect(onResultClick).toHaveBeenCalledWith(mockSearchResults[0], 0);
    });
  });

  describe("Result Grouping", () => {
    it("should group results by type when enabled", () => {
      render(<SearchResults {...defaultProps} groupByType={true} />);

      expect(screen.getByText("Nodes")).toBeInTheDocument();
      expect(screen.getByText("Containers")).toBeInTheDocument();
    });

    it("should not show grouping headers when disabled", () => {
      render(<SearchResults {...defaultProps} groupByType={false} />);

      expect(screen.queryByText("Nodes")).not.toBeInTheDocument();
      expect(screen.queryByText("Containers")).not.toBeInTheDocument();
    });
  });

  describe("Result Limiting", () => {
    it("should limit displayed results when maxResults is set", () => {
      render(<SearchResults {...defaultProps} maxResults={2} />);

      const results = screen.getAllByTestId(/search-result-/);
      expect(results).toHaveLength(2);
    });

    it('should show "more results" indicator when results are limited', () => {
      render(<SearchResults {...defaultProps} maxResults={2} />);

      expect(screen.getByText("+ 1 more result")).toBeInTheDocument();
    });

    it("should handle maxResults larger than actual results", () => {
      render(<SearchResults {...defaultProps} maxResults={10} />);

      const results = screen.getAllByTestId(/search-result-/);
      expect(results).toHaveLength(3); // All results shown
      expect(screen.queryByText(/more result/)).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA attributes", () => {
      render(<SearchResults {...defaultProps} />);

      const resultsList = screen.getByRole("list");
      expect(resultsList).toHaveAttribute("aria-label", "Search results");

      const results = screen.getAllByRole("listitem");
      expect(results).toHaveLength(3);
    });

    it("should have proper tabindex for keyboard navigation", () => {
      render(<SearchResults {...defaultProps} />);

      const results = screen.getAllByTestId(/search-result-/);
      results.forEach((result) => {
        expect(result).toHaveAttribute("tabindex", "0");
      });
    });

    it("should announce current result to screen readers", () => {
      render(<SearchResults {...defaultProps} currentResultIndex={0} />);

      const currentResult = screen.getByTestId("search-result-node1");
      expect(currentResult).toHaveAttribute("aria-selected", "true");
    });
  });
});
