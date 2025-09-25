import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import type { GraphNode, Container } from "../types/core.js";

describe("VisualizationState Container Hierarchy and Relationships", () => {
  let state: VisualizationState;

  beforeEach(() => {
    state = new VisualizationState();
  });

  describe("Parent-Child Relationships", () => {
    it("should establish basic parent-child relationships", () => {
      const parent: Container = {
        id: "parent",
        label: "Parent",
        children: new Set(["child"]),
        collapsed: false,
        hidden: false,
      };

      const child: Container = {
        id: "child",
        label: "Child",
        children: new Set(),
        collapsed: false,
        hidden: false,
      };

      state.addContainer(parent);
      state.addContainer(child);

      expect(state.getContainerParent("child")).toBe("parent");
      expect(state.getContainerChildren("parent")).toEqual(new Set(["child"]));
    });

    it("should handle nested container hierarchies", () => {
      const grandparent: Container = {
        id: "grandparent",
        label: "Grandparent",
        children: new Set(["parent"]),
        collapsed: false,
        hidden: false,
      };

      const parent: Container = {
        id: "parent",
        label: "Parent",
        children: new Set(["child"]),
        collapsed: false,
        hidden: false,
      };

      const child: Container = {
        id: "child",
        label: "Child",
        children: new Set(["n1"]),
        collapsed: false,
        hidden: false,
      };

      state.addContainer(grandparent);
      state.addContainer(parent);
      state.addContainer(child);

      expect(state.getContainerParent("parent")).toBe("grandparent");
      expect(state.getContainerParent("child")).toBe("parent");
      expect(state.getContainerAncestors("child")).toEqual([
        "parent",
        "grandparent",
      ]);
      expect(state.getContainerDescendants("grandparent")).toEqual([
        "parent",
        "child",
      ]);
    });

    it("should handle nodes within containers", () => {
      const node1: GraphNode = {
        id: "n1",
        label: "Node 1",
        longLabel: "Node 1 Long Label",
        type: "process",
        semanticTags: [],
        hidden: false,
      };

      const node2: GraphNode = {
        id: "n2",
        label: "Node 2",
        longLabel: "Node 2 Long Label",
        type: "process",
        semanticTags: [],
        hidden: false,
      };

      const container: Container = {
        id: "c1",
        label: "Container 1",
        children: new Set(["n1", "n2"]),
        collapsed: false,
        hidden: false,
      };

      state.addNode(node1);
      state.addNode(node2);
      state.addContainer(container);

      expect(state.getNodeContainer("n1")).toBe("c1");
      expect(state.getNodeContainer("n2")).toBe("c1");
      expect(state.getContainerNodes("c1")).toEqual(new Set(["n1", "n2"]));
    });
  });

  describe("Circular Dependency Validation", () => {
    it("should detect self-reference circular dependency", () => {
      const container: Container = {
        id: "c1",
        label: "Container 1",
        children: new Set(["c1"]), // Self-reference
        collapsed: false,
        hidden: false,
      };

      expect(() => state.addContainer(container)).toThrow(
        /circular.*dependency/i,
      );
    });

    it("should detect direct circular dependencies", () => {
      const container1: Container = {
        id: "c1",
        label: "Container 1",
        children: new Set(["c2"]),
        collapsed: false,
        hidden: false,
      };

      const container2: Container = {
        id: "c2",
        label: "Container 2",
        children: new Set(["c1"]), // Creates circular dependency
        collapsed: false,
        hidden: false,
      };

      state.addContainer(container1);

      expect(() => state.addContainer(container2)).toThrow(
        /circular.*dependency/i,
      );
    });

    it("should detect indirect circular dependencies", () => {
      const container1: Container = {
        id: "c1",
        label: "Container 1",
        children: new Set(["c2"]),
        collapsed: false,
        hidden: false,
      };

      const container2: Container = {
        id: "c2",
        label: "Container 2",
        children: new Set(["c3"]),
        collapsed: false,
        hidden: false,
      };

      const container3: Container = {
        id: "c3",
        label: "Container 3",
        children: new Set(["c1"]), // Creates indirect circular dependency
        collapsed: false,
        hidden: false,
      };

      state.addContainer(container1);
      state.addContainer(container2);

      expect(() => state.addContainer(container3)).toThrow(
        /circular.*dependency/i,
      );
    });
  });

  describe("Efficient Lookups", () => {
    it("should provide O(1) lookup for container parent relationships", () => {
      const parent: Container = {
        id: "parent",
        label: "Parent",
        children: new Set(["child1", "child2", "child3"]),
        collapsed: false,
        hidden: false,
      };

      const children = ["child1", "child2", "child3"].map((id) => ({
        id,
        label: `Child ${id}`,
        children: new Set<string>(),
        collapsed: false,
        hidden: false,
      }));

      state.addContainer(parent);
      children.forEach((child) => state.addContainer(child));

      // These should be O(1) lookups
      expect(state.getContainerParent("child1")).toBe("parent");
      expect(state.getContainerParent("child2")).toBe("parent");
      expect(state.getContainerParent("child3")).toBe("parent");
    });

    it("should efficiently find all nodes in a container hierarchy", () => {
      const nodes = ["n1", "n2", "n3", "n4"].map((id) => ({
        id,
        label: `Node ${id}`,
        longLabel: `Node ${id} Long Label`,
        type: "process",
        semanticTags: [],
        hidden: false,
      }));

      const childContainer: Container = {
        id: "child",
        label: "Child Container",
        children: new Set(["n3", "n4"]),
        collapsed: false,
        hidden: false,
      };

      const parentContainer: Container = {
        id: "parent",
        label: "Parent Container",
        children: new Set(["n1", "n2", "child"]),
        collapsed: false,
        hidden: false,
      };

      nodes.forEach((node) => state.addNode(node));
      state.addContainer(childContainer);
      state.addContainer(parentContainer);

      const allNodes = state.getAllNodesInHierarchy("parent");
      expect(allNodes).toEqual(new Set(["n1", "n2", "n3", "n4"]));
    });
  });

  describe("Orphaned Entity Management", () => {
    it("should detect orphaned nodes when container is removed", () => {
      const node: GraphNode = {
        id: "n1",
        label: "Node 1",
        longLabel: "Node 1 Long Label",
        type: "process",
        semanticTags: [],
        hidden: false,
      };

      const container: Container = {
        id: "c1",
        label: "Container 1",
        children: new Set(["n1"]),
        collapsed: false,
        hidden: false,
      };

      state.addNode(node);
      state.addContainer(container);

      expect(state.getNodeContainer("n1")).toBe("c1");

      state.removeContainer("c1");

      expect(state.getNodeContainer("n1")).toBeUndefined();
      expect(state.getOrphanedNodes()).toContain("n1");
    });

    it("should handle orphaned containers when parent is removed", () => {
      const parent: Container = {
        id: "parent",
        label: "Parent",
        children: new Set(["child"]),
        collapsed: false,
        hidden: false,
      };

      const child: Container = {
        id: "child",
        label: "Child",
        children: new Set(["n1"]),
        collapsed: false,
        hidden: false,
      };

      state.addContainer(parent);
      state.addContainer(child);

      expect(state.getContainerParent("child")).toBe("parent");

      state.removeContainer("parent");

      expect(state.getContainerParent("child")).toBeUndefined();
      expect(state.getOrphanedContainers()).toContain("child");
    });

    it("should provide method to clean up orphaned entities", () => {
      const node: GraphNode = {
        id: "n1",
        label: "Node 1",
        longLabel: "Node 1 Long Label",
        type: "process",
        semanticTags: [],
        hidden: false,
      };

      const container: Container = {
        id: "c1",
        label: "Container 1",
        children: new Set(["n1"]),
        collapsed: false,
        hidden: false,
      };

      state.addNode(node);
      state.addContainer(container);
      state.removeContainer("c1");

      expect(state.getOrphanedNodes()).toContain("n1");

      state.cleanupOrphanedEntities();

      expect(state.getOrphanedNodes()).toEqual([]);
      expect(state.getGraphNode("n1")).toBeUndefined();
    });
  });

  describe("Relationship Updates", () => {
    it("should update relationships when container children change", () => {
      const container: Container = {
        id: "c1",
        label: "Container 1",
        children: new Set(["n1", "n2"]),
        collapsed: false,
        hidden: false,
      };

      state.addContainer(container);

      expect(state.getNodeContainer("n1")).toBe("c1");
      expect(state.getNodeContainer("n2")).toBe("c1");

      const updatedContainer: Container = {
        ...container,
        children: new Set(["n2", "n3"]),
      };

      state.updateContainer("c1", updatedContainer);

      expect(state.getNodeContainer("n1")).toBeUndefined();
      expect(state.getNodeContainer("n2")).toBe("c1");
      expect(state.getNodeContainer("n3")).toBe("c1");
    });

    it("should maintain consistency when moving nodes between containers", () => {
      const container1: Container = {
        id: "c1",
        label: "Container 1",
        children: new Set(["n1", "n2"]),
        collapsed: false,
        hidden: false,
      };

      const container2: Container = {
        id: "c2",
        label: "Container 2",
        children: new Set(["n3"]),
        collapsed: false,
        hidden: false,
      };

      state.addContainer(container1);
      state.addContainer(container2);

      expect(state.getNodeContainer("n1")).toBe("c1");
      expect(state.getNodeContainer("n3")).toBe("c2");

      // Move n1 from c1 to c2
      state.moveNodeToContainer("n1", "c2");

      expect(state.getNodeContainer("n1")).toBe("c2");
      expect(state.getContainerChildren("c1")).toEqual(new Set(["n2"]));
      expect(state.getContainerChildren("c2")).toEqual(new Set(["n3", "n1"]));
    });
  });
});
