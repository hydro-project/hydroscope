/**
 * Example demonstrating HydroscopeCore readOnly mode
 *
 * This example shows how to use HydroscopeCore in read-only mode for
 * embedding graphs in documentation or dashboards without interactions.
 */

import React, { useState } from "react";
import { HydroscopeCore } from "../components/HydroscopeCore.js";
import type { HydroscopeData } from "../types/core.js";

// Example data for demonstration
const exampleData: HydroscopeData = {
  nodes: [
    { id: "node1", label: "Input", fullLabel: "Input Node", shortLabel: "In" },
    {
      id: "node2",
      label: "Process",
      fullLabel: "Processing Node",
      shortLabel: "Proc",
    },
    {
      id: "node3",
      label: "Output",
      fullLabel: "Output Node",
      shortLabel: "Out",
    },
  ],
  edges: [
    { id: "edge1", source: "node1", target: "node2", label: "data" },
    { id: "edge2", source: "node2", target: "node3", label: "result" },
  ],
  hierarchyChoices: [],
  nodeAssignments: {
    node1: "container1",
    node2: "container1",
    node3: "container1",
  },
  containers: [
    {
      id: "container1",
      label: "Main Process",
      children: ["node1", "node2", "node3"],
    },
  ],
};

export const ReadOnlyExample: React.FC = () => {
  const [readOnly, setReadOnly] = useState(true);

  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        backgroundColor: "#f5f5f5",
      }}
    >
      <h2>HydroscopeCore Read-Only Mode Example</h2>

      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="checkbox"
            checked={readOnly}
            onChange={(e) => setReadOnly(e.target.checked)}
          />
          Read-Only Mode
        </label>
        <p style={{ margin: "8px 0", fontSize: "14px", color: "#666" }}>
          {readOnly
            ? "Interactions disabled - perfect for documentation or dashboards"
            : "Interactions enabled - containers can be collapsed/expanded"}
        </p>
      </div>

      {/* Visualization */}
      <div
        style={{
          height: "400px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          backgroundColor: "white",
        }}
      >
        <HydroscopeCore
          data={exampleData}
          height="100%"
          width="100%"
          readOnly={readOnly}
          showControls={true}
          showMiniMap={false}
          showBackground={true}
          onNodeClick={(event, node) => {
            if (!readOnly) {
              console.log("Node clicked:", node.id);
            }
          }}
          onContainerCollapse={(containerId) => {
            console.log("Container collapsed:", containerId);
          }}
          onContainerExpand={(containerId) => {
            console.log("Container expanded:", containerId);
          }}
        />
      </div>

      <div style={{ marginTop: "20px", fontSize: "14px", color: "#666" }}>
        <h3>Usage:</h3>
        <pre
          style={{
            backgroundColor: "#f8f8f8",
            padding: "12px",
            borderRadius: "4px",
            overflow: "auto",
          }}
        >
          {`import { HydroscopeCore } from '@hydro-project/hydroscope';

// Read-only mode for documentation/dashboards
<HydroscopeCore
  data={graphData}
  readOnly={true}
  showControls={false}
  showMiniMap={false}
/>

// Interactive mode for full functionality  
<HydroscopeCore
  data={graphData}
  readOnly={false}
  onNodeClick={handleNodeClick}
  onContainerCollapse={handleCollapse}
/>`}
        </pre>
      </div>
    </div>
  );
};

export default ReadOnlyExample;
