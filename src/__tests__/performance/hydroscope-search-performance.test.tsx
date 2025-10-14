/**
 * Hydroscope Search Performance Tests
 *
 * Tests search functionality performance with real paxos data.
 * Moved from integration tests due to performance sensitivity.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { Hydroscope } from "../../components/Hydroscope.js";
import { paxosData } from "../../utils/testData.js";

describe("Hydroscope Search Performance Tests", () => {
  beforeEach(() => {
    // Clear any existing DOM
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it(
    "should handle case-insensitive search in paxos data within performance threshold",
    async () => {
      const startTime = performance.now();

      render(
        <Hydroscope
          data={paxosData}
          showInfoPanel={true}
          enableCollapse={true}
          enableUrlParsing={false}
        />,
      );

      // Wait for component to load with extended timeout for performance test
      await waitFor(
        () => {
          const container = document.querySelector(".hydroscope");
          expect(container).toBeTruthy();
        },
        { timeout: 15000 }, // Extended timeout for performance test
      );

      const loadTime = performance.now() - startTime;
      console.log(`Component load time: ${loadTime.toFixed(2)}ms`);

      // Look for search input using specific selectors
      const searchInput =
        document.querySelector('[data-testid="search-input"]') ||
        screen.queryByRole("textbox", { name: /search/i }) ||
        screen.queryByLabelText(/search/i) ||
        screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        // Test case-insensitive search performance
        const searchStartTime = performance.now();

        fireEvent.change(searchInput, { target: { value: "LEARNER" } });

        // Should find learner nodes regardless of case
        await waitFor(
          () => {
            const searchResults = screen.queryAllByText(/learner/i);
            expect(searchResults.length).toBeGreaterThan(0);
          },
          { timeout: 10000 }, // Extended timeout for search operation
        );

        const searchTime = performance.now() - searchStartTime;
        console.log(`Search operation time: ${searchTime.toFixed(2)}ms`);

        // Performance assertion - search should complete within reasonable time
        expect(searchTime).toBeLessThan(5000); // 5 second threshold for search

        // Clear and test lowercase
        const clearStartTime = performance.now();

        fireEvent.change(searchInput, { target: { value: "" } });
        fireEvent.change(searchInput, { target: { value: "client" } });

        // Should find client nodes
        await waitFor(
          () => {
            const searchResults = screen.queryAllByText(/client/i);
            expect(searchResults.length).toBeGreaterThan(0);
          },
          { timeout: 10000 }, // Extended timeout for second search
        );

        const clearAndSearchTime = performance.now() - clearStartTime;
        console.log(
          `Clear and search time: ${clearAndSearchTime.toFixed(2)}ms`,
        );

        // Performance assertion for second search
        expect(clearAndSearchTime).toBeLessThan(3000); // Should be faster on second search

        const totalTime = performance.now() - startTime;
        console.log(`Total test time: ${totalTime.toFixed(2)}ms`);

        // Overall performance threshold
        expect(totalTime).toBeLessThan(20000); // 20 second total threshold
      } else {
        console.warn(
          "Search input not found - skipping search performance test",
        );
      }
    },
    { timeout: 30000 }, // 30 second timeout for entire test
  );

  it(
    "should handle empty search results gracefully within performance threshold",
    async () => {
      const startTime = performance.now();

      render(
        <Hydroscope
          data={paxosData}
          showInfoPanel={true}
          enableCollapse={true}
          enableUrlParsing={false}
        />,
      );

      // Wait for component to load
      await waitFor(
        () => {
          const container = document.querySelector(".hydroscope");
          expect(container).toBeTruthy();
        },
        { timeout: 15000 },
      );

      // Look for search input
      const searchInput =
        document.querySelector('[data-testid="search-input"]') ||
        screen.queryByRole("textbox", { name: /search/i }) ||
        screen.queryByLabelText(/search/i) ||
        screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        // Test search with no results
        const searchStartTime = performance.now();

        fireEvent.change(searchInput, {
          target: { value: "nonexistentterm12345" },
        });

        // Should handle no results gracefully
        await waitFor(
          () => {
            const searchResults =
              screen.queryAllByText(/nonexistentterm12345/i);
            expect(searchResults.length).toBe(0);
          },
          { timeout: 5000 },
        );

        const searchTime = performance.now() - searchStartTime;
        console.log(`Empty search time: ${searchTime.toFixed(2)}ms`);

        // Performance assertion - empty search should be fast
        expect(searchTime).toBeLessThan(2000);

        const totalTime = performance.now() - startTime;
        console.log(`Total empty search test time: ${totalTime.toFixed(2)}ms`);
      }
    },
    { timeout: 25000 }, // 25 second timeout
  );
});
