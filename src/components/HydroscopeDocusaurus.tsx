/**
 * Docusaurus-compatible Hydroscope component
 * This component can be embedded in Docusaurus pages
 */

import React, { useEffect, useRef, useState } from "react";
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./hydroscope-docusaurus.css";

import { nodeTypes } from "./nodes/index.js";
import { StyleConfigProvider } from "../render/StyleConfigContext.js";

import { VisualizationState } from "../core/VisualizationState.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import { InteractionHandler } from "../core/InteractionHandler.js";
import type { HydroscopeData } from "../types/core.js";

interface HydroscopeDocusaurusProps {
  /** JSON data to visualize (optional - will show demo data if not provided) */
  data?: HydroscopeData;
  /** Height of the visualization container */
  height?: string | number;
  /** Width of the visualization container */
  width?: string | number;
  /** Whether to show controls */
  showControls?: boolean;
  /** Whether to show minimap */
  showMiniMap?: boolean;
  /** Whether to show background pattern */
  showBackground?: boolean;
  /** Demo mode - loads paxos.json data */
  demo?: boolean;
}

export const HydroscopeDocusaurus: React.FC<HydroscopeDocusaurusProps> = ({
  data,
  height = 600,
  width = "100%",
  showControls = true,
  showMiniMap = true,
  showBackground = true,
  demo = false,
}) => {
  const [visualizationState, setVisualizationState] =
    useState<VisualizationState | null>(null);
  const [reactFlowData, setReactFlowData] = useState<{
    nodes: any[];
    edges: any[];
  }>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const interactionHandlerRef = useRef<InteractionHandler | null>(null);

  // Initialize the visualization
  useEffect(() => {
    const initializeVisualization = async () => {
      try {
        setLoading(true);
        setError(null);

        let dataToUse = data;

        // Only load demo data if no real data is provided
        if (!dataToUse) {
          if (demo) {
            try {
              // Try to load paxos.json demo data
              const response = await fetch("/test-data/paxos.json");
              if (response.ok) {
                dataToUse = await response.json();
              } else {
                // Fallback to minimal demo data
                dataToUse = createMinimalDemoData();
              }
            } catch {
              // Fallback to minimal demo data
              dataToUse = createMinimalDemoData();
            }
          } else {
            // No demo mode and no data - use minimal data as placeholder
            dataToUse = createMinimalDemoData();
          }
        }

        // Parse the data
        const parser = JSONParser.createPaxosParser({ debug: false });
        const parseResult = await parser.parseData(dataToUse!);
        const state = parseResult.visualizationState;

        // Set up bridges with default configs
        const elkBridge = new ELKBridge({});
        const reactFlowBridge = new ReactFlowBridge({});

        // Perform layout using real ELK calculation
        await elkBridge.layout(state);

        // Convert to ReactFlow format
        const flowData = reactFlowBridge.toReactFlowData(state);

        // Set up interaction handler
        const interactionHandler = new InteractionHandler(state);
        interactionHandlerRef.current = interactionHandler;

        // Update state
        setVisualizationState(state);
        setReactFlowData(flowData);
        setLoading(false);
      } catch (err) {
        console.error("Failed to initialize Hydroscope:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        setLoading(false);
      }
    };

    initializeVisualization();
  }, [data, demo]);

  // Handle node/edge clicks
  const handleNodeClick = async (event: React.MouseEvent, node: any) => {
    if (!visualizationState || !interactionHandlerRef.current) return;

    try {
      // Handle container expand/collapse
      if (node.type === "container") {
        const container = visualizationState.getContainer(node.id);
        if (container) {
          if (container.collapsed) {
            visualizationState.expandContainer(node.id);
          } else {
            visualizationState.collapseContainer(node.id);
          }

          // Update ReactFlow data
          const elkBridge = new ELKBridge({});
          const reactFlowBridge = new ReactFlowBridge({});

          try {
            await elkBridge.layout(visualizationState);
            const flowData =
              reactFlowBridge.toReactFlowData(visualizationState);
            setReactFlowData(flowData);
          } catch (err) {
            console.error("Error updating layout:", err);
          }
        }
      }
      // Handle node label toggle
      else if (node.type === "node") {
        const graphNode = visualizationState.getGraphNode(node.id);
        if (graphNode) {
          visualizationState.toggleNodeLabel(node.id);

          // Update ReactFlow data
          const reactFlowBridge = new ReactFlowBridge({});
          const flowData = reactFlowBridge.toReactFlowData(visualizationState);
          setReactFlowData(flowData);
        }
      }
    } catch (err) {
      console.error("Error handling node click:", err);
    }
  };

  if (loading) {
    return (
      <div className="hydroscope-loading" style={{ height, width }}>
        <div>Loading Hydroscope visualization...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hydroscope-error" style={{ height, width }}>
        <div>Error loading visualization: {error}</div>
      </div>
    );
  }

  return (
    <div className="hydroscope-docusaurus" style={{ height, width }}>
      <StyleConfigProvider>
        <ReactFlow
          nodes={reactFlowData.nodes}
          edges={reactFlowData.edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
          attributionPosition="bottom-left"
        >
          {showBackground && <Background />}
          {showControls && <Controls />}
          {showMiniMap && <MiniMap />}
        </ReactFlow>
      </StyleConfigProvider>
    </div>
  );
};

// Helper function to create minimal demo data
function createMinimalDemoData(): HydroscopeData {
  return {
    nodes: [
      {
        id: "node1",
        shortLabel: "Source",
        fullLabel: "Data Source Node",
        nodeType: "Source",
        data: { locationId: 0, locationType: "Process" },
      },
      {
        id: "node2",
        shortLabel: "Transform",
        fullLabel: "Data Transform Node",
        nodeType: "Transform",
        data: { locationId: 0, locationType: "Process" },
      },
      {
        id: "node3",
        shortLabel: "Sink",
        fullLabel: "Data Sink Node",
        nodeType: "Sink",
        data: { locationId: 1, locationType: "Process" },
      },
    ],
    edges: [
      {
        id: "edge1",
        source: "node1",
        target: "node2",
        semanticTags: ["DataFlow"],
      },
      {
        id: "edge2",
        source: "node2",
        target: "node3",
        semanticTags: ["DataFlow"],
      },
    ],
    hierarchyChoices: [
      {
        id: "location",
        name: "Location",
        children: [
          { id: "loc_0", name: "Process 0", children: [] },
          { id: "loc_1", name: "Process 1", children: [] },
        ],
      },
    ],
    nodeAssignments: {
      location: {
        node1: "loc_0",
        node2: "loc_0",
        node3: "loc_1",
      },
    },
  };
}

export default HydroscopeDocusaurus;
