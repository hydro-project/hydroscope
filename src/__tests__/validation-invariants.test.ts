import { describe, it, expect, vi } from "vitest";

describe("Validation Invariants", () => {
  describe("Container State Invariants", () => {
    it("should prevent illegal Expanded/Hidden state", async () => {
      const { VisualizationState } = await import(
        "../core/VisualizationState.js"
      );
      const state = new VisualizationState();

      // Add container and test illegal state
      state.addContainer({
        id: "c1",
        label: "Container 1",
        children: new Set(),
      });

      // This should throw when trying to create illegal state
      expect(() => {
        // Simulate illegal state: expanded (collapsed: false) + hidden (hidden: true)
        const container = state.getContainer("c1");
        if (container) {
          container.collapsed = false;
          container.hidden = true;
          state.validateInvariants();
        }
      }).toThrow(/illegal.*state/i);
    });

    it("should enforce descendant collapse when parent collapsed", async () => {
      const { VisualizationState } = await import(
        "../core/VisualizationState.js"
      );
      const state = new VisualizationState();

      // Add nested containers
      state.addContainer({
        id: "parent",
        label: "Parent",
        children: new Set(["child"]),
      });
      state.addContainer({ id: "child", label: "Child", children: new Set() });

      // Collapse parent
      state.collapseContainer("parent");

      // Child should be collapsed and hidden
      const child = state.getContainer("child");
      expect(child?.collapsed).toBe(true);
      expect(child?.hidden).toBe(true);
    });

    it("should enforce ancestor visibility when child visible", async () => {
      const { VisualizationState } = await import(
        "../core/VisualizationState.js"
      );
      const state = new VisualizationState();

      // Add nested containers
      state.addContainer({
        id: "parent",
        label: "Parent",
        children: new Set(["child"]),
      });
      state.addContainer({ id: "child", label: "Child", children: new Set() });

      // Make child visible - parent must also be visible
      const child = state.getContainer("child");
      if (child) {
        child.hidden = false;
        const parent = state.getContainer("parent");
        expect(parent?.hidden).toBe(false);
      }
    });
  });

  describe("Edge Invariants", () => {
    it("should prevent edges to non-existent entities", async () => {
      const { VisualizationState } = await import(
        "../core/VisualizationState.js"
      );
      const state = new VisualizationState();

      expect(() => {
        state.addEdge({
          id: "e1",
          source: "nonexistent",
          target: "alsononexistent",
          type: "edge",
        });
        state.validateInvariants();
      }).toThrow(/non-existent/i);
    });

    it("should prevent visible edges to hidden entities", async () => {
      const { VisualizationState } = await import(
        "../core/VisualizationState.js"
      );
      const state = new VisualizationState();

      // Add nodes
      state.addNode({ id: "n1", label: "Node 1", type: "node", hidden: false });
      state.addNode({ id: "n2", label: "Node 2", type: "node", hidden: true });

      expect(() => {
        state.addEdge({
          id: "e1",
          source: "n1",
          target: "n2",
          type: "edge",
          hidden: false,
        });
        state.validateInvariants();
      }).toThrow(/hidden.*target/i);
    });
  });

  describe("Node Container Relationships", () => {
    it("should hide nodes in collapsed containers", async () => {
      const { VisualizationState } = await import(
        "../core/VisualizationState.js"
      );
      const state = new VisualizationState();

      // Add container and node
      state.addContainer({
        id: "c1",
        label: "Container",
        children: new Set(["n1"]),
      });
      state.addNode({ id: "n1", label: "Node", type: "node", hidden: false });

      // Collapse container
      state.collapseContainer("c1");

      // Node should be hidden
      const node = state.getGraphNode("n1");
      expect(node?.hidden).toBe(true);
    });
  });

  describe("Layout Invariants", () => {
    it("should warn about large collapsed container dimensions", async () => {
      const { VisualizationState } = await import(
        "../core/VisualizationState.js"
      );
      const state = new VisualizationState();

      // Add container with large dimensions
      state.addContainer({
        id: "c1",
        label: "Large Container",
        children: new Set(),
        collapsed: true,
        width: 1000,
        height: 1000,
      });

      // Should generate warning (not error)
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      state.validateInvariants();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Invariant warnings/i),
        expect.arrayContaining([
          expect.objectContaining({
            type: "COLLAPSED_CONTAINER_LARGE_DIMENSIONS",
            message: expect.stringMatching(/large dimensions/i),
          }),
        ]),
      );
      consoleSpy.mockRestore();
    });
  });
});
