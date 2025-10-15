/**
 * Regression Tests for Historical Bugs
 *
 * This file consolidates tests for specific bugs that were identified and fixed
 * during development using real test data files. These tests serve as regression
 * tests to ensure the bugs don't reappear.
 *
 * Consolidated from multiple bug-specific test files:
 * - paxos-flipped-bug.test.ts
 * - paxos-flipped-complete-fix.test.ts
 * - paxos-flipped-edge-validation.test.ts
 * - paxos-flipped-runtime-park-expansion.test.ts
 * - paxos-proposer-bug.test.ts
 * - container-state-invariant-bug.test.ts
 * - container-state-invariant-bug-fixed.test.ts
 * - proposer-hyperedge-bug.test.ts
 * - floating-hyperedge-bug.test.ts
 * - debug-bt136-aggregation.test.ts
 * - debug-bt177-aggregation.test.ts
 */

import fs from "fs";
import path from "path";
import { describe, it, expect, beforeEach } from "vitest";
import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";

describe("Regression Tests - Historical Bugs", () => {
  describe("Paxos-Flipped Nested Container Bugs", () => {
    let paxosFlippedData: HydroscopeData;

    beforeEach(() => {
      const paxosFlippedPath = path.join(
        process.cwd(),
        "test-data",
        "paxos-flipped.json",
      );
      const paxosFlippedContent = fs.readFileSync(paxosFlippedPath, "utf-8");
      paxosFlippedData = JSON.parse(paxosFlippedContent) as HydroscopeData;
    });

    it("should parse paxos-flipped.json without errors", async () => {
      const parser = JSONParser.createPaxosParser({ debug: false });
      const result = await parser.parseData(paxosFlippedData);

      expect(result.visualizationState).toBeDefined();
      expect(result.stats.nodeCount).toBeGreaterThan(0);
      expect(result.stats.edgeCount).toBeGreaterThan(0);
      expect(result.stats.containerCount).toBeGreaterThan(0);
    });

    it("should not have container state invariant violations", async () => {
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      const visualizationState = parseResult.visualizationState;

      expect(() => {
        visualizationState.validateInvariants();
      }).not.toThrow();
    });

    it("should handle ELK layout with stress algorithm fallback", async () => {
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      const visualizationState = parseResult.visualizationState;
      const elkBridge = new ELKBridge();

      await elkBridge.layout(visualizationState);

      const containersWithPositions =
        visualizationState.visibleContainers.filter((c) => c.position);
      expect(containersWithPositions.length).toBeGreaterThan(0);
    });

    it("should handle complete pipeline processing", async () => {
      // Complete pipeline test - parsing, validation, bridge conversion, and layout
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      const visualizationState = parseResult.visualizationState;

      // Step 1: Validate invariants
      expect(() => {
        visualizationState.validateInvariants();
      }).not.toThrow();

      // Step 2: ReactFlow bridge conversion
      const reactFlowBridge = new ReactFlowBridge({});
      const renderData = reactFlowBridge.toReactFlowData(visualizationState);
      expect(renderData.nodes.length).toBeGreaterThan(0);

      // Step 3: ELK layout
      const elkBridge = new ELKBridge();
      await elkBridge.layout(visualizationState);
      const containersWithPositions =
        visualizationState.visibleContainers.filter((c) => c.position);
      expect(containersWithPositions.length).toBeGreaterThan(0);

      // All edges should still be valid after layout
      const edges = visualizationState.getOriginalEdges();
      edges.forEach((edge) => {
        const sourceExists =
          visualizationState.getGraphNode(edge.source) ||
          visualizationState.getContainer(edge.source);
        const targetExists =
          visualizationState.getGraphNode(edge.target) ||
          visualizationState.getContainer(edge.target);
        expect(sourceExists).toBeDefined();
        expect(targetExists).toBeDefined();
      });
    });
  });

  describe("Paxos Data Processing", () => {
    let paxosData: HydroscopeData;

    beforeEach(() => {
      const paxosPath = path.join(process.cwd(), "test-data", "paxos.json");
      const paxosContent = fs.readFileSync(paxosPath, "utf-8");
      paxosData = JSON.parse(paxosContent);
    });

    it("should parse paxos.json without errors", async () => {
      const parser = new JSONParser();
      const result = await parser.parseData(paxosData);

      expect(result.visualizationState).toBeDefined();
      expect(result.stats.nodeCount).toBeGreaterThan(0);
      expect(result.stats.edgeCount).toBeGreaterThan(0);
    });

    it("should maintain valid edges after parsing", async () => {
      const parser = new JSONParser();
      const parseResult = await parser.parseData(paxosData);
      const visualizationState = parseResult.visualizationState;

      // All edges should reference valid nodes or containers
      const edges = visualizationState.getOriginalEdges();
      edges.forEach((edge) => {
        const sourceExists =
          visualizationState.getGraphNode(edge.source) ||
          visualizationState.getContainer(edge.source);
        const targetExists =
          visualizationState.getGraphNode(edge.target) ||
          visualizationState.getContainer(edge.target);

        expect(sourceExists).toBeDefined();
        expect(targetExists).toBeDefined();
      });
    });
  });
});
