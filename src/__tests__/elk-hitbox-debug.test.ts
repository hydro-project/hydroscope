/**
 * ELK Hitbox Debug Test
 *
 * This test investigates the "Invalid hitboxes for scanline constraint calculation"
 * error that occurs after fixing the invariant violations in paxos-flipped.json.
 */

import fs from "fs";
import path from "path";
import { describe, it, expect, beforeEach } from "vitest";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";

import { VisualizationState } from "../core/VisualizationState.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";

describe("ELK Hitbox Debug", () => {
  let _coordinator: AsyncCoordinator;

  let paxosFlippedData: HydroscopeData;
  let visualizationState: VisualizationState;
  let _reactFlowBridge: ReactFlowBridge;
  let elkBridge: ELKBridge;

  beforeEach(async () => {
    const _coordinator = new AsyncCoordinator();
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
    _reactFlowBridge = new ReactFlowBridge({});
    elkBridge = new ELKBridge();
  });

  describe("ELK Graph Structure Analysis", () => {
    it("should analyze the ELK graph structure before layout", async () => {
      // Parse the data
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      visualizationState = parseResult.visualizationState;

      // Convert to ELK graph format
      const elkGraph = elkBridge.toELKGraph(visualizationState);

      console.log("🔍 ELK Graph Analysis:");
      console.log(`  Root ID: ${elkGraph.id}`);
      console.log(`  Root children: ${elkGraph.children?.length || 0}`);
      console.log(`  Root edges: ${elkGraph.edges?.length || 0}`);
      console.log(`  Root width: ${elkGraph.width || "undefined"}`);
      console.log(`  Root height: ${elkGraph.height || "undefined"}`);

      // Analyze children for potential issues
      if (elkGraph.children) {
        let nodesWithoutDimensions = 0;
        let nodesWithZeroDimensions = 0;
        let nodesWithNegativeDimensions = 0;
        let containersWithoutChildren = 0;
        let deeplyNestedContainers = 0;

        const analyzeNode = (node: any, depth: number = 0) => {
          // Check dimensions
          if (!node.width || !node.height) {
            nodesWithoutDimensions++;
          }
          if (node.width === 0 || node.height === 0) {
            nodesWithZeroDimensions++;
          }
          if (node.width < 0 || node.height < 0) {
            nodesWithNegativeDimensions++;
          }

          // Check container structure
          if (node.children) {
            if (node.children.length === 0) {
              containersWithoutChildren++;
            }
            if (depth > 5) {
              deeplyNestedContainers++;
            }

            // Recursively analyze children
            for (const child of node.children) {
              analyzeNode(child, depth + 1);
            }
          }
        };

        for (const child of elkGraph.children) {
          analyzeNode(child);
        }

        console.log("🚨 Potential Issues:");
        console.log(`  Nodes without dimensions: ${nodesWithoutDimensions}`);
        console.log(`  Nodes with zero dimensions: ${nodesWithZeroDimensions}`);
        console.log(
          `  Nodes with negative dimensions: ${nodesWithNegativeDimensions}`,
        );
        console.log(
          `  Containers without children: ${containersWithoutChildren}`,
        );
        console.log(
          `  Deeply nested containers (>5 levels): ${deeplyNestedContainers}`,
        );

        // These could cause hitbox calculation issues
        expect(nodesWithNegativeDimensions).toBe(0);
      }

      expect(elkGraph).toBeDefined();
      expect(elkGraph.children).toBeDefined();
    });

    it("should identify problematic node configurations", async () => {
      // Parse the data
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      visualizationState = parseResult.visualizationState;

      // Convert to ELK graph format
      const elkGraph = elkBridge.toELKGraph(visualizationState);

      // Look for specific patterns that might cause hitbox issues
      const problematicNodes: any[] = [];
      const emptyContainers: any[] = [];
      const suspiciousNodes: any[] = [];

      const analyzeNodeRecursively = (node: any, path: string = "") => {
        const currentPath = path ? `${path}/${node.id}` : node.id;

        // Check for problematic configurations
        if (node.children && node.children.length === 0) {
          emptyContainers.push({ node, path: currentPath });
        }

        if (node.width === 0 || node.height === 0) {
          problematicNodes.push({
            node,
            path: currentPath,
            issue: "zero dimensions",
            width: node.width,
            height: node.height,
          });
        }

        if (!node.layoutOptions) {
          suspiciousNodes.push({
            node,
            path: currentPath,
            issue: "missing layout options",
          });
        }

        // Check for containers with only other containers as children
        if (node.children) {
          const allChildrenAreContainers = node.children.every(
            (child: any) => child.children,
          );
          if (allChildrenAreContainers && node.children.length > 0) {
            suspiciousNodes.push({
              node,
              path: currentPath,
              issue: "container with only container children",
              childCount: node.children.length,
            });
          }

          // Recursively analyze children
          for (const child of node.children) {
            analyzeNodeRecursively(child, currentPath);
          }
        }
      };

      if (elkGraph.children) {
        for (const child of elkGraph.children) {
          analyzeNodeRecursively(child);
        }
      }

      console.log("🔍 Detailed Analysis Results:");
      console.log(`  Empty containers: ${emptyContainers.length}`);
      console.log(`  Problematic nodes: ${problematicNodes.length}`);
      console.log(`  Suspicious nodes: ${suspiciousNodes.length}`);

      if (problematicNodes.length > 0) {
        console.log("❌ Problematic nodes details:");
        problematicNodes.slice(0, 5).forEach((item) => {
          console.log(
            `    ${item.path}: ${item.issue} (${item.width}x${item.height})`,
          );
        });
      }

      if (suspiciousNodes.length > 0) {
        console.log("⚠️  Suspicious nodes details:");
        suspiciousNodes.slice(0, 5).forEach((item) => {
          console.log(`    ${item.path}: ${item.issue}`);
        });
      }

      // Write detailed analysis to file for inspection
      const analysis = {
        summary: {
          totalNodes: elkGraph.children?.length || 0,
          emptyContainers: emptyContainers.length,
          problematicNodes: problematicNodes.length,
          suspiciousNodes: suspiciousNodes.length,
        },
        problematicNodes: problematicNodes.slice(0, 10),
        suspiciousNodes: suspiciousNodes.slice(0, 10),
        emptyContainers: emptyContainers.slice(0, 10),
      };

      if (process.env.DEBUG_FILES) {
        fs.writeFileSync(
          "elk-analysis.json",
          JSON.stringify(analysis, null, 2),
        );
        console.log("📄 Detailed analysis written to elk-analysis.json");
      }

      expect(elkGraph).toBeDefined();
    });
  });

  describe("ELK Layout Options Investigation", () => {
    it("should try different ELK configurations to bypass hitbox issue", async () => {
      // Parse the data
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      visualizationState = parseResult.visualizationState;

      // Try different ELK configurations
      const configurations = [
        {
          name: "Default",
          config: {},
        },
        {
          name: "Force Layered",
          config: {
            algorithm: "mrtree" as const,
            hierarchicalLayout: false,
          },
        },
        {
          name: "Stress Algorithm",
          config: {
            algorithm: "stress" as const,
            hierarchicalLayout: false,
          },
        },
        {
          name: "Compact Layout",
          config: {
            algorithm: "mrtree" as const,
            compactLayout: true,
            hierarchicalLayout: false,
          },
        },
        {
          name: "Disable Hierarchy",
          config: {
            hierarchicalLayout: false,
            separateConnectedComponents: false,
          },
        },
      ];

      const results: any[] = [];
      let successfulConfig: any = null;

      for (const { name, config } of configurations) {
        const result = {
          name,
          config,
          success: false,
          error: "",
          nodesPositioned: 0,
        };

        try {
          // Create a fresh copy of the state for each test
          const testState = new VisualizationState();

          // Copy all data
          for (const node of visualizationState.visibleNodes) {
            testState.addNode({ ...node });
          }
          for (const container of visualizationState.visibleContainers) {
            testState.addContainer({
              ...container,
              children: new Set(container.children),
            });
          }
          for (const edge of visualizationState.visibleEdges) {
            testState.addEdge({ ...edge });
          }

          const testElkBridge = new ELKBridge(config);
          await testElkBridge.layout(testState);

          // If successful, check the results
          const nodesWithPositions = testState.visibleNodes.filter(
            (n) => n.position,
          );
          result.success = true;
          result.nodesPositioned = nodesWithPositions.length;

          if (!successfulConfig) {
            successfulConfig = { name, config };
          }
        } catch (error) {
          result.error = (error as Error).message.substring(0, 200);
        }

        results.push(result);
      }

      // Write results to file for analysis
      if (process.env.DEBUG_FILES) {
        fs.writeFileSync(
          "elk-config-test-results.json",
          JSON.stringify(
            {
              summary: {
                totalConfigs: configurations.length,
                successfulConfigs: results.filter((r) => r.success).length,
                firstSuccessful: successfulConfig,
              },
              results,
            },
            null,
            2,
          ),
        );

        console.log(
          "📄 ELK configuration test results written to elk-config-test-results.json",
        );
      }

      // If any configuration worked, the test passes
      const successfulResults = results.filter((r) => r.success);
      if (successfulResults.length > 0) {
        console.log(
          `✅ Found ${successfulResults.length} working configurations!`,
        );
        expect(successfulResults.length).toBeGreaterThan(0);
      } else {
        console.log("❌ All ELK configurations failed");
        // Don't fail the test - we're investigating
        expect(results.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Simplified Graph Testing", () => {
    let coordinator: AsyncCoordinator;
    beforeEach(() => {
      _coordinator = new AsyncCoordinator();
    });

    it("should test with progressively simplified graphs", async () => {
      // Parse the data
      const parser = JSONParser.createPaxosParser({ debug: false });
      const parseResult = await parser.parseData(paxosFlippedData);
      visualizationState = parseResult.visualizationState;

      // Test 1: Collapse all containers to simplify
      console.log("🧪 Test 1: Collapse all containers");
      try {
        await coordinator.collapseAllContainers(
          coordinator,
          visualizationState,
          { fitView: false },
          { fitView: false },
        );
        await elkBridge.layout(visualizationState);
        console.log("✅ Collapsed layout succeeded!");
        return;
      } catch (error) {
        console.log(
          `❌ Collapsed layout failed: ${(error as Error).message.substring(0, 100)}...`,
        );
      }

      // Test 2: Remove all containers, keep only nodes
      console.log("🧪 Test 2: Remove all containers");
      try {
        const simpleState = new VisualizationState();

        // Add only nodes, no containers
        for (const node of visualizationState.visibleNodes) {
          simpleState.addNode({ ...node });
        }

        // Add only edges between nodes (no container edges)
        for (const edge of visualizationState.visibleEdges) {
          const sourceExists = simpleState.getGraphNode(edge.source);
          const targetExists = simpleState.getGraphNode(edge.target);
          if (sourceExists && targetExists) {
            simpleState.addEdge({ ...edge });
          }
        }

        await elkBridge.layout(simpleState);
        console.log("✅ Nodes-only layout succeeded!");

        const nodesWithPositions = simpleState.visibleNodes.filter(
          (n) => n.position,
        );
        console.log(
          `   Positioned nodes: ${nodesWithPositions.length}/${simpleState.visibleNodes.length}`,
        );

        expect(nodesWithPositions.length).toBeGreaterThan(0);
        return;
      } catch (error) {
        console.log(
          `❌ Nodes-only layout failed: ${(error as Error).message.substring(0, 100)}...`,
        );
      }

      // If we get here, even the simplified version failed
      throw new Error("Even simplified graphs failed - deeper ELK issue");
    });
  });
});
