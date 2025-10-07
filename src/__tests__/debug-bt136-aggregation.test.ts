/**
 * Debug test to understand when bt_136 aggregated edges are created
 */

import fs from "fs";
import path from "path";
import { describe, it, expect, beforeEach } from "vitest";

import { VisualizationState } from "../core/VisualizationState.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";

describe("Debug bt_136 Aggregation", () => {
  let paxosFlippedData: HydroscopeData;
  let visualizationState: VisualizationState;

  beforeEach(async () => {
    // Load the actual paxos-flipped.json file
    const paxosFlippedPath = path.join(
      process.cwd(),
      "test-data",
      "paxos-flipped.json",
    );
    const paxosFlippedContent = fs.readFileSync(paxosFlippedPath, "utf-8");
    paxosFlippedData = JSON.parse(paxosFlippedContent) as HydroscopeData;

    // Parse the data
    const parser = JSONParser.createPaxosParser({ debug: false });
    const parseResult = await parser.parseData(paxosFlippedData);
    visualizationState = parseResult.visualizationState;
  });

  it("should trace edge creation and resolution for bt_136", () => {
    console.log("🔍 Tracing edge creation and resolution for bt_136...");

    // Check initial state - before any operations
    const allContainers = visualizationState.getAllContainers();
    const bt136Container = visualizationState.getContainer("bt_136");
    const parent = allContainers.find((c) => c.children.has("bt_136"));

    console.log(`📦 INITIAL STATE:`);
    console.log(
      `  bt_136: hidden=${bt136Container?.hidden}, collapsed=${bt136Container?.collapsed}`,
    );
    console.log(
      `  parent: ${parent?.id} (hidden=${parent?.hidden}, collapsed=${parent?.collapsed})`,
    );

    // Check what edges exist initially
    const initialAggregatedEdges = Array.from(
      (visualizationState as any)._aggregatedEdges.values(),
    ) as any[];
    const initialBt136AggEdges = initialAggregatedEdges.filter(
      (edge: any) => edge.source === "bt_136" || edge.target === "bt_136",
    );

    const initialRegularEdges = Array.from(
      (visualizationState as any)._edges.values(),
    ) as any[];
    const initialBt136RegularEdges = initialRegularEdges.filter(
      (edge: any) => edge.source === "bt_136" || edge.target === "bt_136",
    );

    console.log(`📊 INITIAL EDGES:`);
    console.log(
      `  Aggregated edges referencing bt_136: ${initialBt136AggEdges.length}`,
    );
    console.log(
      `  Regular edges referencing bt_136: ${initialBt136RegularEdges.length}`,
    );

    if (initialBt136AggEdges.length > 0) {
      console.log(`🚨 INITIAL bt_136 aggregated edges:`);
      initialBt136AggEdges.forEach((edge: any) => {
        console.log(`    ${edge.id}: ${edge.source} -> ${edge.target}`);
      });
    }

    // Now expand runtime/park.rs and see what changes
    const runtimeParkContainer = allContainers.find(
      (container) =>
        container.id.includes("runtime/park.rs") ||
        container.label.includes("runtime/park.rs") ||
        container.id.includes("park.rs") ||
        container.label.includes("park.rs"),
    );

    if (runtimeParkContainer) {
      console.log(`🔄 EXPANDING: ${runtimeParkContainer.id}`);
      visualizationState.expandContainer(runtimeParkContainer.id);

      // Check edges after expansion
      const finalAggregatedEdges = Array.from(
        (visualizationState as any)._aggregatedEdges.values(),
      ) as any[];
      const finalBt136AggEdges = finalAggregatedEdges.filter(
        (edge: any) => edge.source === "bt_136" || edge.target === "bt_136",
      );

      const finalRegularEdges = Array.from(
        (visualizationState as any)._edges.values(),
      ) as any[];
      const finalBt136RegularEdges = finalRegularEdges.filter(
        (edge: any) => edge.source === "bt_136" || edge.target === "bt_136",
      );

      console.log(`📊 FINAL EDGES:`);
      console.log(
        `  Aggregated edges referencing bt_136: ${finalBt136AggEdges.length}`,
      );
      console.log(
        `  Regular edges referencing bt_136: ${finalBt136RegularEdges.length}`,
      );

      if (finalBt136AggEdges.length > 0) {
        console.log(`🚨 FINAL bt_136 aggregated edges:`);
        finalBt136AggEdges.forEach((edge: any) => {
          console.log(`    ${edge.id}: ${edge.source} -> ${edge.target}`);
        });
      }

      // Check if bt_136 is now visible
      const finalBt136 = visualizationState.getContainer("bt_136");
      const finalParent = allContainers.find((c) => c.children.has("bt_136"));
      console.log(`📦 FINAL STATE:`);
      console.log(
        `  bt_136: hidden=${finalBt136?.hidden}, collapsed=${finalBt136?.collapsed}`,
      );
      console.log(
        `  parent: ${finalParent?.id} (hidden=${finalParent?.hidden}, collapsed=${finalParent?.collapsed})`,
      );

      // The key insight: edges should be cleaned up if bt_136 was initially hidden
      const wasInitiallyHidden = bt136Container?.hidden || parent?.hidden;
      const isNowVisible = !finalBt136?.hidden && !finalParent?.hidden;

      const debugInfo = {
        initialState: {
          bt_136_hidden: bt136Container?.hidden,
          parent_hidden: parent?.hidden,
          parent_id: parent?.id,
        },
        finalState: {
          bt_136_hidden: finalBt136?.hidden,
          parent_hidden: finalParent?.hidden,
          parent_id: finalParent?.id,
        },
        edges: {
          initial_agg: initialBt136AggEdges.length,
          final_agg: finalBt136AggEdges.length,
          initial_regular: initialBt136RegularEdges.length,
          final_regular: finalBt136RegularEdges.length,
        },
        analysis: {
          was_initially_hidden: wasInitiallyHidden,
          is_now_visible: isNowVisible,
        },
      };

      // Verify that the debug info is captured correctly
      expect(debugInfo).toBeDefined();
      expect(debugInfo.analysis.is_now_visible).toBe(true);
    }
  });

  it("should trace bt_136 ancestor visibility during runtime/park.rs expansion", () => {
    console.log("🔍 Tracing bt_136 ancestor visibility...");

    // Get initial state
    const bt136Container = visualizationState.getContainer("bt_136");
    const allContainers = visualizationState.getAllContainers();
    const parent = allContainers.find((c) => c.children.has("bt_136"));
    const grandparent = parent
      ? allContainers.find((c) => c.children.has(parent.id))
      : null;
    const greatGrandparent = grandparent
      ? allContainers.find((c) => c.children.has(grandparent.id))
      : null;

    // Find runtime/park.rs container
    const runtimeParkContainer = allContainers.find(
      (container) =>
        container.id.includes("runtime/park.rs") ||
        container.label.includes("runtime/park.rs") ||
        container.id.includes("park.rs") ||
        container.label.includes("park.rs"),
    );

    // Log initial hierarchy
    const initialState = {
      bt_136: bt136Container
        ? `hidden=${bt136Container.hidden}, collapsed=${bt136Container.collapsed}`
        : "NOT_FOUND",
      parent: parent
        ? `${parent.id}(hidden=${parent.hidden}, collapsed=${parent.collapsed})`
        : "NOT_FOUND",
      grandparent: grandparent
        ? `${grandparent.id}(hidden=${grandparent.hidden}, collapsed=${grandparent.collapsed})`
        : "NOT_FOUND",
      greatGrandparent: greatGrandparent
        ? `${greatGrandparent.id}(hidden=${greatGrandparent.hidden}, collapsed=${greatGrandparent.collapsed})`
        : "NOT_FOUND",
      runtimePark: runtimeParkContainer
        ? `${runtimeParkContainer.id}(hidden=${runtimeParkContainer.hidden}, collapsed=${runtimeParkContainer.collapsed})`
        : "NOT_FOUND",
    };

    if (runtimeParkContainer) {
      // Expand runtime/park.rs
      visualizationState.expandContainer(runtimeParkContainer.id);

      // Check state after expansion
      const bt136After = visualizationState.getContainer("bt_136");
      const parentAfter = allContainers.find((c) => c.children.has("bt_136"));
      const grandparentAfter = parentAfter
        ? allContainers.find((c) => c.children.has(parentAfter.id))
        : null;
      const greatGrandparentAfter = grandparentAfter
        ? allContainers.find((c) => c.children.has(grandparentAfter.id))
        : null;

      const finalState = {
        bt_136: bt136After
          ? `hidden=${bt136After.hidden}, collapsed=${bt136After.collapsed}`
          : "NOT_FOUND",
        parent: parentAfter
          ? `${parentAfter.id}(hidden=${parentAfter.hidden}, collapsed=${parentAfter.collapsed})`
          : "NOT_FOUND",
        grandparent: grandparentAfter
          ? `${grandparentAfter.id}(hidden=${grandparentAfter.hidden}, collapsed=${grandparentAfter.collapsed})`
          : "NOT_FOUND",
        greatGrandparent: greatGrandparentAfter
          ? `${greatGrandparentAfter.id}(hidden=${greatGrandparentAfter.hidden}, collapsed=${greatGrandparentAfter.collapsed})`
          : "NOT_FOUND",
      };

      // Check if any ancestor is hidden
      const hasHiddenAncestor =
        bt136After?.hidden ||
        parentAfter?.hidden ||
        grandparentAfter?.hidden ||
        greatGrandparentAfter?.hidden;

      expect(
        hasHiddenAncestor,
        `INITIAL: ${JSON.stringify(initialState)} | FINAL: ${JSON.stringify(finalState)} | HAS_HIDDEN_ANCESTOR: ${hasHiddenAncestor}`,
      ).toBe(false);
    } else {
      throw new Error(
        `runtime/park.rs container not found. Available containers: ${allContainers
          .map((c) => c.id)
          .slice(0, 10)
          .join(", ")}...`,
      );
    }
  });

  it("should show the container hierarchy around bt_136", () => {
    console.log("🌳 Container hierarchy around bt_136:");

    const allContainers = visualizationState.getAllContainers();

    // Find bt_136
    const bt136 = allContainers.find((c) => c.id === "bt_136");
    if (!bt136) {
      console.log("❌ bt_136 not found");
      return;
    }

    // Find its parent
    const parent = allContainers.find((c) => c.children.has("bt_136"));
    if (parent) {
      console.log(
        `📦 Parent: ${parent.id} (hidden=${parent.hidden}, collapsed=${parent.collapsed})`,
      );

      // Find grandparent
      const grandparent = allContainers.find((c) => c.children.has(parent.id));
      if (grandparent) {
        console.log(
          `📦 Grandparent: ${grandparent.id} (hidden=${grandparent.hidden}, collapsed=${grandparent.collapsed})`,
        );
      }
    }

    console.log(
      `📦 bt_136: (hidden=${bt136.hidden}, collapsed=${bt136.collapsed})`,
    );
    console.log(`📦 bt_136 children: ${Array.from(bt136.children).join(", ")}`);

    expect(
      bt136,
      `bt_136 container: hidden=${bt136?.hidden}, collapsed=${bt136?.collapsed}`,
    ).toBeDefined();
    expect(
      parent,
      `bt_136 parent: ${parent?.id} (hidden=${parent?.hidden}, collapsed=${parent?.collapsed})`,
    ).toBeDefined();
  });
});
