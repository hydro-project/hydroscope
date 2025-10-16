/**
 * Example test demonstrating sync invariant validation
 *
 * This test shows how the invariant checking utility can be used
 * to validate that collapsedContainers always matches VisualizationState
 */

import { describe, it, expect } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import {
  validateSyncInvariant,
  deriveCollapsedContainers,
} from "../utils/syncInvariantValidation.js";
import type { GraphNode, Container } from "../types/core.js";

describe("Sync Invariant Validation Example", () => {
  function createTestState(): VisualizationState {
    const state = new VisualizationState();

    // Create a simple hierarchy with containers
    const node1: GraphNode = {
      id: "node1",
      label: "Node 1",
      longLabel: "Node 1",
      type: "process",
      semanticTags: [],
      hidden: false,
    };
    const node2: GraphNode = {
      id: "node2",
      label: "Node 2",
      longLabel: "Node 2",
      type: "process",
      semanticTags: [],
      hidden: false,
    };
    const node3: GraphNode = {
      id: "node3",
      label: "Node 3",
      longLabel: "Node 3",
      type: "process",
      semanticTags: [],
      hidden: false,
    };

    state.addNode(node1);
    state.addNode(node2);
    state.addNode(node3);

    const container1: Container = {
      id: "container1",
      label: "Container 1",
      collapsed: false,
      children: new Set([node1.id]),
      hidden: false,
    };
    const container2: Container = {
      id: "container2",
      label: "Container 2",
      collapsed: true,
      children: new Set([node2.id]),
      hidden: false,
    };
    const container3: Container = {
      id: "container3",
      label: "Container 3",
      collapsed: false,
      children: new Set([node3.id, container2.id]),
      hidden: false,
    };

    state.addContainer(container1);
    state.addContainer(container2);
    state.addContainer(container3);

    return state;
  }

  it("should validate invariant after initialization", () => {
    const state = createTestState();

    // Derive the collapsedContainers set (mimics Hydroscope.tsx)
    const collapsedContainers = deriveCollapsedContainers(state);

    // Validate the invariant - should not throw
    expect(() => {
      validateSyncInvariant(state, collapsedContainers, "initialization");
    }).not.toThrow();

    // Verify expected state
    expect(collapsedContainers.has("container1")).toBe(false);
    expect(collapsedContainers.has("container2")).toBe(true);
    expect(collapsedContainers.has("container3")).toBe(false);

    console.log(
      `✓ Invariant validated: ${collapsedContainers.size} container(s) collapsed`,
    );
  });

  it("should detect invariant violation if collapsedContainers is out of sync", () => {
    const state = createTestState();

    // Create a deliberately incorrect collapsedContainers set
    const incorrectSet = new Set<string>(["container1", "container3"]); // Wrong!

    // Validation should detect the mismatch
    expect(() => {
      validateSyncInvariant(state, incorrectSet, "test violation");
    }).toThrow(/Sync invariant violated/);

    console.log("✓ Invariant violation correctly detected");
  });

  it("should validate invariant after container toggle", () => {
    const state = createTestState();

    const container1 = state.getContainer("container1");
    expect(container1).toBeDefined();
    expect(container1?.collapsed).toBe(false);

    // Toggle the container
    if (container1) {
      container1.collapsed = true;
    }

    // Re-derive collapsedContainers (mimics React re-render)
    const collapsedContainers = deriveCollapsedContainers(state);

    // Validate invariant - should still hold
    expect(() => {
      validateSyncInvariant(state, collapsedContainers, "toggle container1");
    }).not.toThrow();

    // Verify new state
    expect(collapsedContainers.has("container1")).toBe(true);
    expect(collapsedContainers.has("container2")).toBe(true);
    expect(collapsedContainers.has("container3")).toBe(false);

    console.log("✓ Invariant validated after toggling container1");
  });

  it("should validate invariant after multiple toggles", () => {
    const state = createTestState();

    const containers = Array.from(state.getAllContainers());
    expect(containers.length).toBe(3);

    // Toggle each container twice
    for (const container of containers) {
      // First toggle
      container.collapsed = !container.collapsed;
      let collapsedContainers = deriveCollapsedContainers(state);
      expect(() => {
        validateSyncInvariant(
          state,
          collapsedContainers,
          `toggle ${container.id} (1)`,
        );
      }).not.toThrow();

      // Second toggle (back to original)
      container.collapsed = !container.collapsed;
      collapsedContainers = deriveCollapsedContainers(state);
      expect(() => {
        validateSyncInvariant(
          state,
          collapsedContainers,
          `toggle ${container.id} (2)`,
        );
      }).not.toThrow();
    }

    // Verify back to original state
    const finalCollapsedContainers = deriveCollapsedContainers(state);
    expect(finalCollapsedContainers.has("container1")).toBe(false);
    expect(finalCollapsedContainers.has("container2")).toBe(true);
    expect(finalCollapsedContainers.has("container3")).toBe(false);

    console.log("✓ Invariant validated after multiple toggles");
  });
});
