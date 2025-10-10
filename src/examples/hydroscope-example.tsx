/**
 * Example usage of the new Hydroscope component
 *
 * This example demonstrates how to use the new Hydroscope component
 * with all its enhanced features including file upload, InfoPanel,
 * StyleTuner, and CustomControls.
 */

import React, { useState } from "react";
import { Hydroscope } from "../components/Hydroscope";
import type { HydroscopeData, RenderConfig } from "../components/Hydroscope";
import { DEFAULT_ELK_ALGORITHM } from "@/shared/config";

// Sample data for demonstration
const sampleData: HydroscopeData = {
  nodes: [
    { id: "node1", label: "Input Node", type: "input" },
    { id: "node2", label: "Process Node", type: "process" },
    { id: "node3", label: "Output Node", type: "output" },
    { id: "node4", label: "Filter Node", type: "filter" },
  ],
  edges: [
    { id: "edge1", source: "node1", target: "node2", label: "data flow" },
    { id: "edge2", source: "node2", target: "node3", label: "processed" },
    { id: "edge3", source: "node2", target: "node4", label: "filtered" },
  ],
  hierarchyChoices: [
    { id: "by-type", name: "By Type" },
    { id: "by-function", name: "By Function" },
  ],
  nodeAssignments: {
    "by-type": {
      node1: "inputs",
      node2: "processors",
      node3: "outputs",
      node4: "filters",
    },
  },
  nodeTypeConfig: {
    types: [
      { id: "input", label: "Input", colorIndex: 0 },
      { id: "process", label: "Process", colorIndex: 1 },
      { id: "output", label: "Output", colorIndex: 2 },
      { id: "filter", label: "Filter", colorIndex: 3 },
    ],
  },
  legend: {
    title: "Node Types",
    items: [
      { type: "input", label: "Input Nodes", color: "blue" },
      { type: "process", label: "Process Nodes", color: "green" },
      { type: "output", label: "Output Nodes", color: "orange" },
      { type: "filter", label: "Filter Nodes", color: "purple" },
    ],
  },
};

export default function HydroscopeExample() {
  const [data, setData] = useState<HydroscopeData | undefined>(sampleData);
  const [config, setConfig] = useState<RenderConfig>({});

  return (
    <div style={{ height: "100vh", width: "100vw", padding: "20px" }}>
      <h1
        style={{ margin: "0 0 20px 0", fontSize: "24px", fontWeight: "bold" }}
      >
        New Hydroscope Component Example
      </h1>

      <div
        style={{
          height: "calc(100vh - 80px)",
          border: "1px solid #ccc",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <Hydroscope
          data={data}
          height="100%"
          width="100%"
          showControls={true}
          showMiniMap={true}
          showBackground={true}
          showFileUpload={true}
          showInfoPanel={true}
          showStylePanel={true}
          enableCollapse={true}
          initialLayoutAlgorithm={DEFAULT_ELK_ALGORITHM}
          initialColorPalette="Set3"
          onFileUpload={(uploadedData, filename) => {
            console.log(`File uploaded: ${filename}`);
            setData(uploadedData);
          }}
          onNodeClick={(event, node, visualizationState) => {
            console.log("Node clicked:", {
              nodeId: node.id,
              position: node.position,
              hasVisualizationState: !!visualizationState,
            });
          }}
          onContainerCollapse={(containerId, visualizationState) => {
            console.log("Container collapsed:", {
              containerId,
              hasVisualizationState: !!visualizationState,
            });
          }}
          onContainerExpand={(containerId, visualizationState) => {
            console.log("Container expanded:", {
              containerId,
              hasVisualizationState: !!visualizationState,
            });
          }}
          onConfigChange={(newConfig) => {
            console.log("Configuration changed:", newConfig);
            setConfig(newConfig);
          }}
          className="hydroscope-example"
          style={{ backgroundColor: "#f9f9f9" }}
        />
      </div>

      <div
        style={{
          marginTop: "10px",
          padding: "10px",
          backgroundColor: "#f0f0f0",
          borderRadius: "4px",
          fontSize: "12px",
        }}
      >
        <strong>Features demonstrated:</strong>
        <ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
          <li>File upload with drag-and-drop support</li>
          <li>InfoPanel with search and hierarchy controls</li>
          <li>StyleTuner for real-time appearance customization</li>
          <li>CustomControls for pack/unpack and auto-fit operations</li>
          <li>Configuration persistence to localStorage</li>
          <li>Error boundaries and graceful error handling</li>
          <li>Responsive layout and keyboard shortcuts</li>
        </ul>
        <p style={{ margin: "5px 0" }}>
          <strong>Current config:</strong> {JSON.stringify(config, null, 2)}
        </p>
      </div>
    </div>
  );
}

// Export for use in other examples
export { sampleData };
