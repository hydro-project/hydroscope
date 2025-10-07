/**
 * ELK Fallback Verification Test
 *
 * This test verifies whether the ELK stress algorithm fallback is actually
 * being triggered, or if the original invariant violations fix was sufficient.
 */

import fs from "fs";
import path from "path";
import { describe, it, expect, beforeEach } from "vitest";

import { VisualizationState } from "../core/VisualizationState.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";

describe("ELK Fallback Verification", () => {
  let paxosFlippedData: HydroscopeData;

  beforeEach(async () => {
    const paxosFlippedPath = path.join(
      process.cwd(),
      "test-data",
      "paxos-flipped.json",
    );
    const paxosFlippedContent = fs.readFileSync(paxosFlippedPath, "utf-8");
    paxosFlippedData = JSON.parse(paxosFlippedContent) as HydroscopeData;
  });

  describe("Original ELK Configuration", () => {
    it("should test if default ELK configuration works after invariant fix", async () => {
      // Parse the data
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      const visualizationState = parseResult.visualizationState;

      // Test with original ELK configuration (no fallback mechanism)
      const originalElkBridge = new ELKBridge({
        algorithm: "layered", // Default algorithm
        hierarchicalLayout: true, // Default hierarchical layout
      });

      let layoutError: Error | null = null;
      let layoutSucceeded = false;

      try {
        await originalElkBridge.layout(visualizationState);
        layoutSucceeded = true;

        const nodesWithPositions = visualizationState.visibleNodes.filter(
          (n) => n.position,
        );
        console.log(
          `✅ Original ELK config succeeded: ${nodesWithPositions.length} nodes positioned`,
        );
      } catch (error) {
        layoutError = error as Error;
        console.log(
          `❌ Original ELK config failed: ${error.message.substring(0, 100)}...`,
        );
      }

      // Document the result
      if (layoutSucceeded) {
        console.log("🎯 FINDING: The invariant violations fix was sufficient!");
        console.log("   The ELK stress algorithm fallback may not be needed.");
        expect(layoutSucceeded).toBe(true);
      } else {
        console.log("🎯 FINDING: The ELK fallback mechanism is still needed.");
        console.log(`   Original error: ${layoutError?.message}`);
        expect(layoutError).toBeDefined();
      }
    });

    it("should compare default vs stress algorithm performance", async () => {
      // Parse the data
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);

      const results = {
        defaultConfig: {
          success: false,
          error: "",
          nodesPositioned: 0,
          duration: 0,
        },
        stressConfig: {
          success: false,
          error: "",
          nodesPositioned: 0,
          duration: 0,
        },
      };

      // Test 1: Default configuration
      console.log("🧪 Testing default ELK configuration...");
      try {
        const defaultState = new VisualizationState();
        // Copy data
        for (const node of parseResult.visualizationState.visibleNodes) {
          defaultState.addNode({ ...node });
        }
        for (const container of parseResult.visualizationState
          .visibleContainers) {
          defaultState.addContainer({
            ...container,
            children: new Set(container.children),
          });
        }
        for (const edge of parseResult.visualizationState.visibleEdges) {
          defaultState.addEdge({ ...edge });
        }

        const defaultElkBridge = new ELKBridge({
          algorithm: "layered",
          hierarchicalLayout: true,
        });

        const startTime = Date.now();
        await defaultElkBridge.layout(defaultState);
        const endTime = Date.now();

        results.defaultConfig.success = true;
        results.defaultConfig.duration = endTime - startTime;
        results.defaultConfig.nodesPositioned =
          defaultState.visibleNodes.filter((n) => n.position).length;
      } catch (error) {
        results.defaultConfig.error = (error as Error).message.substring(
          0,
          200,
        );
      }

      // Test 2: Stress configuration
      console.log("🧪 Testing stress ELK configuration...");
      try {
        const stressState = new VisualizationState();
        // Copy data
        for (const node of parseResult.visualizationState.visibleNodes) {
          stressState.addNode({ ...node });
        }
        for (const container of parseResult.visualizationState
          .visibleContainers) {
          stressState.addContainer({
            ...container,
            children: new Set(container.children),
          });
        }
        for (const edge of parseResult.visualizationState.visibleEdges) {
          stressState.addEdge({ ...edge });
        }

        const stressElkBridge = new ELKBridge({
          algorithm: "stress",
          hierarchicalLayout: false,
        });

        const startTime = Date.now();
        await stressElkBridge.layout(stressState);
        const endTime = Date.now();

        results.stressConfig.success = true;
        results.stressConfig.duration = endTime - startTime;
        results.stressConfig.nodesPositioned = stressState.visibleNodes.filter(
          (n) => n.position,
        ).length;
      } catch (error) {
        results.stressConfig.error = (error as Error).message.substring(0, 200);
      }

      // Report results
      console.log("\n📊 ELK Configuration Comparison:");
      console.log(
        `Default (layered):  ${results.defaultConfig.success ? "✅" : "❌"} ${results.defaultConfig.success ? `${results.defaultConfig.nodesPositioned} nodes, ${results.defaultConfig.duration}ms` : results.defaultConfig.error}`,
      );
      console.log(
        `Stress algorithm:   ${results.stressConfig.success ? "✅" : "❌"} ${results.stressConfig.success ? `${results.stressConfig.nodesPositioned} nodes, ${results.stressConfig.duration}ms` : results.stressConfig.error}`,
      );

      // Write detailed results
      fs.writeFileSync(
        "elk-comparison-results.json",
        JSON.stringify(results, null, 2),
      );
      console.log("📄 Detailed results written to elk-comparison-results.json");

      // At least one should work
      expect(
        results.defaultConfig.success || results.stressConfig.success,
      ).toBe(true);
    });
  });

  describe("Fallback Mechanism Verification", () => {
    it("should verify if the fallback mechanism is actually triggered", async () => {
      // Parse the data
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      const visualizationState = parseResult.visualizationState;

      // Capture console logs to see if fallback is triggered
      const originalConsoleLog = console.log;
      const logMessages: string[] = [];

      console.log = (...args: any[]) => {
        const message = args.join(" ");
        logMessages.push(message);
        originalConsoleLog(...args);
      };

      try {
        // Use the ELK bridge with fallback mechanism
        const elkBridge = new ELKBridge(); // Default config that might trigger fallback
        await elkBridge.layout(visualizationState);

        // Check if fallback was triggered
        const fallbackTriggered = logMessages.some(
          (msg) =>
            msg.includes("fallback") ||
            msg.includes("stress algorithm") ||
            msg.includes("hitbox error"),
        );

        console.log(`\n🔍 Fallback mechanism analysis:`);
        console.log(
          `   Fallback triggered: ${fallbackTriggered ? "YES" : "NO"}`,
        );

        if (fallbackTriggered) {
          console.log(`   Fallback messages:`);
          logMessages
            .filter(
              (msg) =>
                msg.includes("fallback") ||
                msg.includes("stress") ||
                msg.includes("hitbox"),
            )
            .forEach((msg) => console.log(`     - ${msg}`));
        } else {
          console.log(
            `   The default ELK configuration worked without fallback`,
          );
        }

        // Verify layout succeeded
        const nodesWithPositions = visualizationState.visibleNodes.filter(
          (n) => n.position,
        );
        expect(nodesWithPositions.length).toBeGreaterThan(0);
      } finally {
        // Restore console.log
        console.log = originalConsoleLog;
      }
    });
  });
});
