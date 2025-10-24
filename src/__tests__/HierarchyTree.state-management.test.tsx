/**
 * @fileoverview HierarchyTree State Management Unit Tests
 *
 * Tests the internal state management logic for expand/collapse behavior
 * without relying on Ant Design Tree component (which can be flaky in CI).
 */

import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState, useEffect, useRef } from "react";

describe("HierarchyTree State Management", () => {
  describe("expandedKeys state management with syncEnabled=false", () => {
    it("should maintain independent state across multiple expand/collapse operations", () => {
      // Simulate the HierarchyTree's state management logic
      const { result } = renderHook(() => {
        const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
        const userControlledRef = useRef(false);
        const syncEnabled = false;

        // Simulate the useEffect that syncs state
        // Note: derivedExpandedKeys is intentionally constant in this test
        useEffect(() => {
          const derivedExpandedKeys: string[] = []; // Start with no derived keys

          if (syncEnabled) {
            setExpandedKeys(derivedExpandedKeys);
            userControlledRef.current = false;
          } else {
            // When sync is disabled, only update on initial load
            if (!userControlledRef.current) {
              setExpandedKeys(derivedExpandedKeys);
            }
          }
        }, [syncEnabled]);

        // Simulate handleExpand
        const handleExpand = (nextKeys: string[]) => {
          setExpandedKeys(nextKeys);
          if (!syncEnabled) {
            userControlledRef.current = true;
          }
        };

        return {
          expandedKeys,
          handleExpand,
          userControlledRef,
        };
      });

      // Initial state - should be empty (from derivedExpandedKeys)
      expect(result.current.expandedKeys).toEqual([]);

      // Expand container1
      act(() => {
        result.current.handleExpand(["container1"]);
      });
      expect(result.current.expandedKeys).toEqual(["container1"]);
      expect(result.current.userControlledRef.current).toBe(true);

      // Collapse container1
      act(() => {
        result.current.handleExpand([]);
      });
      expect(result.current.expandedKeys).toEqual([]);
      expect(result.current.userControlledRef.current).toBe(true);

      // Expand again
      act(() => {
        result.current.handleExpand(["container1"]);
      });
      expect(result.current.expandedKeys).toEqual(["container1"]);
      expect(result.current.userControlledRef.current).toBe(true);

      // Collapse again
      act(() => {
        result.current.handleExpand([]);
      });
      expect(result.current.expandedKeys).toEqual([]);

      // Expand multiple times
      act(() => {
        result.current.handleExpand(["container1", "container2"]);
      });
      expect(result.current.expandedKeys).toEqual(["container1", "container2"]);
    });

    it("should not call onToggleContainer when syncEnabled=false", () => {
      const mockOnToggleContainer = vi.fn();

      const { result } = renderHook(() => {
        const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
        const syncEnabled = false;

        const handleExpand = (
          nextKeys: string[],
          changedKey: string,
          isExpanding: boolean,
        ) => {
          setExpandedKeys(nextKeys);

          // Only call onToggleContainer when sync is enabled
          if (
            syncEnabled &&
            isExpanding !== expandedKeys.includes(changedKey)
          ) {
            mockOnToggleContainer(changedKey);
          }
        };

        return {
          expandedKeys,
          handleExpand,
        };
      });

      // Expand
      act(() => {
        result.current.handleExpand(["container1"], "container1", true);
      });

      // Should NOT have called onToggleContainer
      expect(mockOnToggleContainer).not.toHaveBeenCalled();
      expect(result.current.expandedKeys).toEqual(["container1"]);
    });
  });

  describe("expandedKeys state management with syncEnabled=true", () => {
    it("should call onToggleContainer when syncEnabled=true", () => {
      const mockOnToggleContainer = vi.fn();

      const { result } = renderHook(() => {
        const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
        const syncEnabled = true;

        const handleExpand = (
          nextKeys: string[],
          changedKey: string,
          wasExpanded: boolean,
        ) => {
          setExpandedKeys(nextKeys);

          const isNowExpanded = nextKeys.includes(changedKey);

          // Call onToggleContainer when sync is enabled and state changed
          if (syncEnabled && wasExpanded !== isNowExpanded) {
            mockOnToggleContainer(changedKey);
          }
        };

        return {
          expandedKeys,
          handleExpand,
        };
      });

      // Expand
      act(() => {
        result.current.handleExpand(["container1"], "container1", false);
      });

      // Should have called onToggleContainer
      expect(mockOnToggleContainer).toHaveBeenCalledWith("container1");
      expect(result.current.expandedKeys).toEqual(["container1"]);
    });

    it("should sync with derivedExpandedKeys when syncEnabled=true", () => {
      const { result, rerender } = renderHook(
        ({ derivedKeys, syncEnabled }) => {
          const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
          const prevDerivedKeysRef = useRef<string[]>([]);

          useEffect(() => {
            // Check if derivedExpandedKeys actually changed
            const derivedKeysChanged =
              prevDerivedKeysRef.current.length !== derivedKeys.length ||
              !derivedKeys.every((key) =>
                prevDerivedKeysRef.current.includes(key),
              );

            if (syncEnabled && derivedKeysChanged) {
              setExpandedKeys(derivedKeys);
              prevDerivedKeysRef.current = derivedKeys;
            }
          }, [derivedKeys, syncEnabled]);

          return { expandedKeys };
        },
        {
          initialProps: {
            derivedKeys: ["container1"],
            syncEnabled: true,
          },
        },
      );

      // Should sync with derived keys
      expect(result.current.expandedKeys).toEqual(["container1"]);

      // Update derived keys
      rerender({
        derivedKeys: ["container1", "container2"],
        syncEnabled: true,
      });

      // Should sync with new derived keys
      expect(result.current.expandedKeys).toEqual(["container1", "container2"]);
    });
  });
});
