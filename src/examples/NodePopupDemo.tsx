/**
 * @fileoverview Demo component showing NodePopup functionality
 *
 * This example demonstrates how nodes with longLabel show popups when clicked.
 */
import { HydroscopeCore } from "../components/HydroscopeCore";
import type { HydroscopeData } from "../types/core";

const demoData: HydroscopeData = {
  nodes: [
    {
      id: "node1",
      label: "Short",
      longLabel:
        "This is a very long label that demonstrates the popup functionality when you click on the node",
      type: "process",
    },
    {
      id: "node2",
      label: "Medium Label",
      longLabel:
        "Another example of a long label that will show in a floating popup with proper styling and positioning",
      type: "service",
    },
    {
      id: "node3",
      label: "Regular Node",
      // No longLabel - clicking won't show popup
      type: "database",
    },
    {
      id: "node4",
      label: "Same Label",
      longLabel: "Same Label", // Same as label - won't show popup
      type: "cache",
    },
  ],
  edges: [
    {
      id: "edge1",
      source: "node1",
      target: "node2",
    },
    {
      id: "edge2",
      source: "node2",
      target: "node3",
    },
    {
      id: "edge3",
      source: "node3",
      target: "node4",
    },
  ],
  hierarchyChoices: [],
  nodeAssignments: {},
};

export function NodePopupDemo() {
  return (
    <div style={{ width: "100%", height: "600px", padding: "20px" }}>
      <h2>Node Popup Demo</h2>
      <p>Click on nodes with long labels to see popups. Try clicking:</p>
      <ul>
        <li>
          <strong>&quot;Short&quot;</strong> - Shows popup with long label
        </li>
        <li>
          <strong>&quot;Medium Label&quot;</strong> - Shows popup with long
          label
        </li>
        <li>
          <strong>&quot;Regular Node&quot;</strong> - No popup (no longLabel)
        </li>
        <li>
          <strong>&quot;Same Label&quot;</strong> - No popup (longLabel same as
          label)
        </li>
      </ul>

      <div
        style={{
          width: "100%",
          height: "400px",
          border: "1px solid #ccc",
          borderRadius: "8px",
          marginTop: "20px",
        }}
      >
        <HydroscopeCore
          data={demoData}
          height="100%"
          width="100%"
          showControls={true}
          showMiniMap={true}
          showBackground={true}
          onNodeClick={(_event, node) => {
            console.log("Node clicked:", node.id, node.data);
          }}
        />
      </div>

      <div style={{ marginTop: "20px", fontSize: "14px", color: "#666" }}>
        <h3>Features:</h3>
        <ul>
          <li>✅ Popup appears centered on and occludes the original node</li>
          <li>
            ✅ Popup is a proper ReactFlow node that follows container movement
          </li>
          <li>✅ Popup has floating shadow effect</li>
          <li>✅ Popup uses same colors as original node</li>
          <li>✅ Close button (×) in top-right corner</li>
          <li>✅ Click same node again to toggle popup</li>
          <li>✅ Popups auto-close when containers collapse</li>
          <li>✅ Replaces the old label toggle functionality</li>
        </ul>
      </div>
    </div>
  );
}

export default NodePopupDemo;
