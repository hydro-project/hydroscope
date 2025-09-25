import { describe, it, expect, beforeEach } from "vitest";
import { ELKBridge } from "../bridges/ELKBridge.js";

describe("Interface Compliance Tests", () => {
  let elkBridge: ELKBridge;

  beforeEach(() => {
    elkBridge = new ELKBridge();
  });
  describe("VisualizationState compliance", () => {
    it("should export VisualizationState class", async () => {
      const module = await import("../core/VisualizationState.js");
      expect(module.VisualizationState).toBeDefined();
      expect(typeof module.VisualizationState).toBe("function");
    });

    it("should have required methods", async () => {
      const { VisualizationState } = await import(
        "../core/VisualizationState.js"
      );
      const instance = new VisualizationState();

      expect(typeof instance.addNode).toBe("function");
      expect(typeof instance.addEdge).toBe("function");
      expect(typeof instance.addContainer).toBe("function");
      expect(typeof instance.expandContainer).toBe("function");
      expect(typeof instance.collapseContainer).toBe("function");
      expect(typeof instance.validateInvariants).toBe("function");

      expect(instance.visibleNodes).toBeDefined();
      expect(instance.visibleEdges).toBeDefined();
      expect(instance.visibleContainers).toBeDefined();
    });

    it("should be React-free", async () => {
      const { VisualizationState } = await import(
        "../core/VisualizationState.js"
      );
      const instance = new VisualizationState();

      // Should not have React-specific properties
      expect(instance.setState).toBeUndefined();
      expect(instance.render).toBeUndefined();
      expect(instance.componentDidMount).toBeUndefined();
    });
  });

  describe("Bridge compliance", () => {
    it("should export stateless ELKBridge", async () => {
      const module = await import("../bridges/ELKBridge.js");
      expect(module.ELKBridge).toBeDefined();

      const instance = new module.ELKBridge({});
      expect(typeof instance.toELKGraph).toBe("function");
      expect(typeof instance.applyELKResults).toBe("function");
    });

    it("should export stateless ReactFlowBridge", async () => {
      const module = await import("../bridges/ReactFlowBridge.js");
      expect(module.ReactFlowBridge).toBeDefined();

      const instance = new module.ReactFlowBridge({});
      expect(typeof instance.toReactFlowData).toBe("function");
    });
  });
});
