/**
 * Container State Invariant Bug - FIXED
 *
 * This test verifies that the nested container hierarchy bug has been fixed.
 * The original bug was: containers in illegal "Expanded/Hidden" state and
 * child containers not properly collapsed when ancestor is collapsed.
 *
 * Fix: In VisualizationState._hideAllDescendants(), child containers are now
 * both hidden AND collapsed when their parent is collapsed.
 */

import fs from "fs";
import path from "path";
import { describe, it, expect, beforeEach } from "vitest";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";

import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";

describe("Container State Invariant Bug - FIXED", () => {
  let paxosFlippedData: HydroscopeData;
  let visualizationState: VisualizationState;
  let elkBridge: ELKBridge;

  beforeEach(async () => {
    // Load the actual paxos-flipped.json file
    const paxosFlippedPath = path.join(
      process.cwd(),
      "test-data",
      "paxos-flipped.json",
    );
    const paxosFlippedContent = fs.readFileSync(paxosFlippedPath, "utf-8");
    paxosFlippedData = JSON.parse(paxosFlippedContent) as HydroscopeData;

    // Initialize components
    visualizationState = new VisualizationState();
    elkBridge = new ELKBridge();
  });

  describe("Invariant Violations - FIXED", () => {
    let coordinator: AsyncCoordinator;
    beforeEach(() => {
      coordinator = new AsyncCoordinator();
    });

    it("should NOT find containers in illegal Expanded/Hidden state", async () => {
      // Parse the data to get the state
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      visualizationState = parseResult.visualizationState;

      // Check for illegal states - should find NONE after the fix
      const illegalContainers: string[] = [];
      const ancestorViolations: string[] = [];

      for (const container of visualizationState.visibleContainers) {
        // Check for Expanded/Hidden state (this shouldn't exist after fix)
        if (!container.collapsed && container.hidden) {
          illegalContainers.push(container.id);
        }

        // Check for ancestor collapse violations
        if (!container.collapsed) {
          const ancestors = findAncestorContainers(
            container.id,
            visualizationState,
          );
          const collapsedAncestor = ancestors.find(
            (ancestor) =>
              visualizationState.visibleContainers.find(
                (c) => c.id === ancestor,
              )?.collapsed,
          );

          if (collapsedAncestor) {
            ancestorViolations.push(
              `${container.id} should be collapsed because ancestor ${collapsedAncestor} is collapsed`,
            );
          }
        }
      }

      console.log(
        `✅ Illegal Expanded/Hidden containers: ${illegalContainers.length} (should be 0)`,
      );
      console.log(
        `✅ Ancestor collapse violations: ${ancestorViolations.length} (should be 0)`,
      );

      // After the fix, there should be NO violations
      expect(illegalContainers.length).toBe(0);
      expect(ancestorViolations.length).toBe(0);
    });

    it("should NOT fail with VisualizationState invariant violations", async () => {
      // Parse the data
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      visualizationState = parseResult.visualizationState;

      // Attempt ELK layout - should NOT fail with invariant violations
      let layoutError: Error | null = null;

      try {
        await elkBridge.layout(visualizationState);
        console.log("✅ ELK layout completed without invariant violations!");
      } catch (error) {
        layoutError = error as Error;

        // Should NOT be invariant violations anymore
        expect(layoutError.message).not.toContain(
          "VisualizationState invariant violations",
        );
        expect(layoutError.message).not.toContain(
          "illegal Expanded/Hidden state",
        );
        expect(layoutError.message).not.toContain(
          "should be collapsed because ancestor",
        );

        // If it fails, it should be a different ELK error (like the hitbox issue)
        console.log(
          `ℹ️  ELK failed with different error (not invariant violations): ${layoutError.message.substring(0, 100)}...`,
        );
      }

      // The key point is that we should NOT get invariant violations
      if (layoutError) {
        expect(layoutError.message).not.toContain("invariant violations");
      }
    });

    it("should properly handle nested container collapse cascade", async () => {
      // Create a simple test case to verify the fix
      const state = new VisualizationState();

      // Add node first
      state.addNode({
        id: "node1",
        label: "Node 1",
        type: "node",
        semanticTags: [],
        hidden: false,
      });

      // Create nested container structure: parent -> child -> grandchild -> node1
      state.addContainer({
        id: "grandchild",
        label: "Grandchild Container",
        children: new Set(["node1"]),
        collapsed: false,
        hidden: false,
      });

      state.addContainer({
        id: "child",
        label: "Child Container",
        children: new Set(["grandchild"]),
        collapsed: false,
        hidden: false,
      });

      state.addContainer({
        id: "parent",
        label: "Parent Container",
        children: new Set(["child"]),
        collapsed: false,
        hidden: false,
      });

      // Collapse the parent - this should cascade properly
      await coordinator.collapseContainer("parent", state, {
        triggerLayout: false,
      });

      // Verify the fix: child and grandchild should be both hidden AND collapsed
      const child = state.getContainer("child");
      const grandchild = state.getContainer("grandchild");

      expect(child?.hidden).toBe(true);
      expect(child?.collapsed).toBe(true); // This is the fix - should be collapsed too

      expect(grandchild?.hidden).toBe(true);
      expect(grandchild?.collapsed).toBe(true); // This is the fix - should be collapsed too

      console.log("✅ Nested container collapse cascade works correctly");
    });
  });

  describe("Verification of Fix", () => {
    it("should demonstrate the fix prevents illegal states", async () => {
      // Parse the problematic data
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      visualizationState = parseResult.visualizationState;

      // Count containers in various states
      let expandedVisible = 0;
      let collapsedVisible = 0;
      let expandedHidden = 0; // This should be 0 after the fix
      let collapsedHidden = 0;

      for (const container of visualizationState.visibleContainers) {
        if (container.collapsed && !container.hidden) {
          collapsedVisible++;
        } else if (!container.collapsed && !container.hidden) {
          expandedVisible++;
        } else if (!container.collapsed && container.hidden) {
          expandedHidden++; // ILLEGAL STATE - should be 0
        } else if (container.collapsed && container.hidden) {
          collapsedHidden++;
        }
      }

      console.log(`Container state distribution:`);
      console.log(`  Expanded + Visible: ${expandedVisible}`);
      console.log(`  Collapsed + Visible: ${collapsedVisible}`);
      console.log(
        `  Expanded + Hidden: ${expandedHidden} (ILLEGAL - should be 0)`,
      );
      console.log(`  Collapsed + Hidden: ${collapsedHidden}`);

      // The fix ensures no containers are in the illegal "Expanded + Hidden" state
      expect(expandedHidden).toBe(0);

      // Total should match
      const total =
        expandedVisible + collapsedVisible + expandedHidden + collapsedHidden;
      expect(total).toBe(visualizationState.visibleContainers.length);
    });
  });
});

/**
 * Helper function to find ancestor containers
 */
function findAncestorContainers(
  containerId: string,
  state: VisualizationState,
): string[] {
  const ancestors: string[] = [];

  // Find which container this container is a child of
  for (const container of state.visibleContainers) {
    if (container.children.has(containerId)) {
      ancestors.push(container.id);
      // Recursively find ancestors of this ancestor
      ancestors.push(...findAncestorContainers(container.id, state));
    }
  }

  return ancestors;
}
