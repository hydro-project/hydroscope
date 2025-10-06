/**
 * BridgeFactory tests - Singleton pattern for stateless bridge instances
 */

import { describe, it, expect, beforeEach } from "vitest";
import { BridgeFactory, bridgeFactory } from "../bridges/BridgeFactory.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";

describe("BridgeFactory", () => {
  beforeEach(() => {
    // Reset factory state for each test
    bridgeFactory.reset();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance when called multiple times", () => {
      const instance1 = BridgeFactory.getInstance();
      const instance2 = BridgeFactory.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBe(bridgeFactory);
    });

    it("should use singleton pattern correctly", () => {
      // TypeScript prevents direct instantiation at compile time
      // At runtime, the singleton pattern ensures same instance is returned
      const instance1 = BridgeFactory.getInstance();
      const instance2 = BridgeFactory.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("ReactFlowBridge Management", () => {
    it("should create and return ReactFlowBridge instance", () => {
      const bridge = bridgeFactory.getReactFlowBridge();

      expect(bridge).toBeInstanceOf(ReactFlowBridge);
    });

    it("should return the same ReactFlowBridge instance on subsequent calls", () => {
      const bridge1 = bridgeFactory.getReactFlowBridge();
      const bridge2 = bridgeFactory.getReactFlowBridge();

      expect(bridge1).toBe(bridge2);
    });

    it("should create ReactFlowBridge with custom style config", () => {
      const styleConfig = {
        nodeStyles: new Map([["test", { color: "red" }]]),
        edgeStyles: new Map([["test", { color: "blue" }]]),
      };

      const bridge = bridgeFactory.getReactFlowBridge(styleConfig);

      expect(bridge).toBeInstanceOf(ReactFlowBridge);
    });

    it("should update ReactFlowBridge configuration", () => {
      const initialBridge = bridgeFactory.getReactFlowBridge();

      const newStyleConfig = {
        nodeStyles: new Map([["updated", { color: "green" }]]),
        edgeStyles: new Map([["updated", { color: "yellow" }]]),
      };

      bridgeFactory.updateReactFlowBridgeConfig(newStyleConfig);
      const updatedBridge = bridgeFactory.getReactFlowBridge();

      // Should be a new instance with updated config
      expect(updatedBridge).toBeInstanceOf(ReactFlowBridge);
      expect(updatedBridge).not.toBe(initialBridge);
    });
  });

  describe("ELKBridge Management", () => {
    it("should create and return ELKBridge instance", () => {
      const bridge = bridgeFactory.getELKBridge();

      expect(bridge).toBeInstanceOf(ELKBridge);
    });

    it("should return the same ELKBridge instance on subsequent calls", () => {
      const bridge1 = bridgeFactory.getELKBridge();
      const bridge2 = bridgeFactory.getELKBridge();

      expect(bridge1).toBe(bridge2);
    });

    it("should create ELKBridge with custom layout config", () => {
      const layoutConfig = {
        algorithm: "force" as const,
        direction: "RIGHT" as const,
        nodeSpacing: 100,
        layerSpacing: 50,
      };

      const bridge = bridgeFactory.getELKBridge(layoutConfig);

      expect(bridge).toBeInstanceOf(ELKBridge);
      expect(bridge.getConfiguration().algorithm).toBe("force");
      expect(bridge.getConfiguration().direction).toBe("RIGHT");
    });

    it("should update ELKBridge configuration", () => {
      const initialBridge = bridgeFactory.getELKBridge();

      const newLayoutConfig = {
        algorithm: "stress" as const,
        direction: "LEFT" as const,
        nodeSpacing: 75,
      };

      bridgeFactory.updateELKBridgeConfig(newLayoutConfig);
      const updatedBridge = bridgeFactory.getELKBridge();

      // Should be a new instance with updated config
      expect(updatedBridge).toBeInstanceOf(ELKBridge);
      expect(updatedBridge).not.toBe(initialBridge);
      expect(updatedBridge.getConfiguration().algorithm).toBe("stress");
      expect(updatedBridge.getConfiguration().direction).toBe("LEFT");
    });
  });

  describe("Factory Reset", () => {
    it("should reset both bridge instances", () => {
      const reactFlowBridge1 = bridgeFactory.getReactFlowBridge();
      const elkBridge1 = bridgeFactory.getELKBridge();

      bridgeFactory.reset();

      const reactFlowBridge2 = bridgeFactory.getReactFlowBridge();
      const elkBridge2 = bridgeFactory.getELKBridge();

      expect(reactFlowBridge2).not.toBe(reactFlowBridge1);
      expect(elkBridge2).not.toBe(elkBridge1);
      expect(reactFlowBridge2).toBeInstanceOf(ReactFlowBridge);
      expect(elkBridge2).toBeInstanceOf(ELKBridge);
    });
  });

  describe("Bridge Statelessness", () => {
    it("should ensure bridges are stateless and reusable", () => {
      const reactFlowBridge = bridgeFactory.getReactFlowBridge();
      const elkBridge = bridgeFactory.getELKBridge();

      // Bridges should be stateless - no internal state to verify
      // This test ensures they can be created and reused safely
      expect(reactFlowBridge).toBeInstanceOf(ReactFlowBridge);
      expect(elkBridge).toBeInstanceOf(ELKBridge);

      // Multiple calls should return the same instances
      expect(bridgeFactory.getReactFlowBridge()).toBe(reactFlowBridge);
      expect(bridgeFactory.getELKBridge()).toBe(elkBridge);
    });
  });
});
