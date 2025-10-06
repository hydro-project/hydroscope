/**
 * Paxos-Flipped Complete Fix Test
 * 
 * This test documents the complete fix for the nested container hierarchy bug
 * that was preventing paxos-flipped.json from processing successfully.
 * 
 * The fix involved two parts:
 * 1. VisualizationState: Fix invariant violations in nested container collapse
 * 2. ELKBridge: Add stress algorithm fallback for complex hierarchies
 */

import fs from "fs";
import path from "path";
import { describe, it, expect, beforeEach } from "vitest";

import { VisualizationState } from "../core/VisualizationState.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";

describe("Paxos-Flipped Complete Fix", () => {
  let paxosFlippedData: HydroscopeData;

  beforeEach(async () => {
    // Load the actual paxos-flipped.json file
    const paxosFlippedPath = path.join(process.cwd(), "test-data", "paxos-flipped.json");
    const paxosFlippedContent = fs.readFileSync(paxosFlippedPath, "utf-8");
    paxosFlippedData = JSON.parse(paxosFlippedContent) as HydroscopeData;
  });

  describe("Complete Pipeline Success", () => {
    it("should process paxos-flipped.json through the entire pipeline successfully", async () => {
      console.log("🚀 Starting complete pipeline test for paxos-flipped.json");
      
      // Step 1: JSON Parsing
      console.log("📝 Step 1: JSON Parsing");
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      
      expect(parseResult.visualizationState).toBeDefined();
      expect(parseResult.stats.nodeCount).toBeGreaterThan(0);
      expect(parseResult.stats.containerCount).toBeGreaterThan(0);
      
      console.log(`   ✅ Parsed: ${parseResult.stats.nodeCount} nodes, ${parseResult.stats.containerCount} containers`);
      
      // Step 2: VisualizationState Validation (should not throw invariant violations)
      console.log("🔍 Step 2: VisualizationState Validation");
      const visualizationState = parseResult.visualizationState;
      
      // This should not throw - the invariant violations are fixed
      expect(() => {
        visualizationState.validateInvariants();
      }).not.toThrow();
      
      console.log("   ✅ No invariant violations detected");
      
      // Step 3: ReactFlow Bridge Conversion
      console.log("🎨 Step 3: ReactFlow Bridge Conversion");
      const reactFlowBridge = new ReactFlowBridge({});
      const renderData = reactFlowBridge.toReactFlowData(visualizationState);
      
      expect(renderData.nodes).toBeDefined();
      expect(renderData.edges).toBeDefined();
      expect(renderData.nodes.length).toBeGreaterThan(0);
      
      console.log(`   ✅ Converted: ${renderData.nodes.length} nodes, ${renderData.edges.length} edges`);
      
      // Step 4: ELK Layout (with automatic fallback to stress algorithm)
      console.log("⚡ Step 4: ELK Layout");
      const elkBridge = new ELKBridge();
      
      // This should succeed with the stress algorithm fallback
      await elkBridge.layout(visualizationState);
      
      // Verify layout was applied
      const nodesWithPositions = visualizationState.visibleNodes.filter(n => n.position);
      const containersWithPositions = visualizationState.visibleContainers.filter(c => c.position);
      
      expect(nodesWithPositions.length).toBeGreaterThan(0);
      expect(containersWithPositions.length).toBeGreaterThan(0);
      
      console.log(`   ✅ Layout applied: ${nodesWithPositions.length} nodes, ${containersWithPositions.length} containers positioned`);
      
      // Step 5: Final Validation
      console.log("🔍 Step 5: Final Validation");
      
      // All visible nodes should have positions
      expect(nodesWithPositions.length).toBe(visualizationState.visibleNodes.length);
      
      // All visible containers should have positions
      expect(containersWithPositions.length).toBe(visualizationState.visibleContainers.length);
      
      // Positions should be valid numbers
      for (const node of nodesWithPositions) {
        expect(typeof node.position!.x).toBe('number');
        expect(typeof node.position!.y).toBe('number');
        expect(isFinite(node.position!.x)).toBe(true);
        expect(isFinite(node.position!.y)).toBe(true);
      }
      
      console.log("   ✅ All positions are valid");
      
      console.log("🎉 Complete pipeline test PASSED!");
    }, 30000); // 30 second timeout for complex processing

    it("should demonstrate the fix prevents the original errors", async () => {
      // Parse the data
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      const visualizationState = parseResult.visualizationState;

      // Verify no invariant violations (Fix #1)
      let invariantError: Error | null = null;
      try {
        visualizationState.validateInvariants();
      } catch (error) {
        invariantError = error as Error;
      }
      
      expect(invariantError).toBeNull();
      console.log("✅ Fix #1 verified: No invariant violations");

      // Verify ELK layout succeeds (Fix #2)
      const elkBridge = new ELKBridge();
      let layoutError: Error | null = null;
      
      try {
        await elkBridge.layout(visualizationState);
      } catch (error) {
        layoutError = error as Error;
      }
      
      expect(layoutError).toBeNull();
      console.log("✅ Fix #2 verified: ELK layout succeeds with stress algorithm fallback");

      // Verify final state
      const nodesWithPositions = visualizationState.visibleNodes.filter(n => n.position);
      expect(nodesWithPositions.length).toBe(visualizationState.visibleNodes.length);
      console.log(`✅ Final verification: All ${nodesWithPositions.length} nodes positioned`);
    });

    it("should handle the complex nested container structure correctly", async () => {
      // Parse the data
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      const visualizationState = parseResult.visualizationState;

      // Analyze the container structure
      const containers = visualizationState.visibleContainers;
      const nestedContainers = containers.filter(container => {
        // Check if this container has other containers as children
        for (const childId of container.children) {
          if (containers.some(c => c.id === childId)) {
            return true;
          }
        }
        return false;
      });

      console.log(`📊 Container analysis:`);
      console.log(`   Total containers: ${containers.length}`);
      console.log(`   Containers with nested containers: ${nestedContainers.length}`);

      // Verify all containers are in valid states
      for (const container of containers) {
        // No illegal "Expanded/Hidden" state
        expect(!(container.collapsed === false && container.hidden === true)).toBe(true);
        
        // If collapsed, children should be hidden
        if (container.collapsed) {
          for (const childId of container.children) {
            const childContainer = containers.find(c => c.id === childId);
            if (childContainer) {
              expect(childContainer.hidden).toBe(true);
              expect(childContainer.collapsed).toBe(true); // This is the key fix
            }
          }
        }
      }

      console.log("✅ All containers are in valid states");

      // Run layout to ensure it works with this complex structure
      const elkBridge = new ELKBridge();
      await elkBridge.layout(visualizationState);

      const containersWithPositions = visualizationState.visibleContainers.filter(c => c.position);
      expect(containersWithPositions.length).toBe(visualizationState.visibleContainers.length);
      
      console.log(`✅ Complex nested structure handled: ${containersWithPositions.length} containers positioned`);
    });
  });

  describe("Performance and Robustness", () => {
    it("should handle paxos-flipped.json within reasonable time limits", async () => {
      const startTime = Date.now();
      
      // Full pipeline
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      
      const reactFlowBridge = new ReactFlowBridge({});
      reactFlowBridge.toReactFlowData(parseResult.visualizationState);
      
      const elkBridge = new ELKBridge();
      await elkBridge.layout(parseResult.visualizationState);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`⏱️  Total processing time: ${duration}ms`);
      
      // Should complete within reasonable time (adjust as needed)
      expect(duration).toBeLessThan(10000); // 10 seconds max
      
      // Verify results
      const nodesWithPositions = parseResult.visualizationState.visibleNodes.filter(n => n.position);
      expect(nodesWithPositions.length).toBeGreaterThan(0);
    });

    it("should be deterministic - multiple runs should produce consistent results", async () => {
      const results: any[] = [];
      
      // Run the pipeline multiple times
      for (let i = 0; i < 3; i++) {
        const parser = JSONParser.createPaxosParser({ debug: false });
        const parseResult = await parser.parseData(paxosFlippedData);
        
        const elkBridge = new ELKBridge();
        await elkBridge.layout(parseResult.visualizationState);
        
        const nodesWithPositions = parseResult.visualizationState.visibleNodes.filter(n => n.position);
        const containersWithPositions = parseResult.visualizationState.visibleContainers.filter(c => c.position);
        
        results.push({
          run: i + 1,
          nodesPositioned: nodesWithPositions.length,
          containersPositioned: containersWithPositions.length,
          totalNodes: parseResult.visualizationState.visibleNodes.length,
          totalContainers: parseResult.visualizationState.visibleContainers.length
        });
      }
      
      // All runs should produce the same counts
      const firstResult = results[0];
      for (const result of results) {
        expect(result.nodesPositioned).toBe(firstResult.nodesPositioned);
        expect(result.containersPositioned).toBe(firstResult.containersPositioned);
        expect(result.totalNodes).toBe(firstResult.totalNodes);
        expect(result.totalContainers).toBe(firstResult.totalContainers);
      }
      
      console.log(`✅ Deterministic results across ${results.length} runs:`);
      console.log(`   Nodes positioned: ${firstResult.nodesPositioned}/${firstResult.totalNodes}`);
      console.log(`   Containers positioned: ${firstResult.containersPositioned}/${firstResult.totalContainers}`);
    });
  });
});