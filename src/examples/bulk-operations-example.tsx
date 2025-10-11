/**
 * Example demonstrating HydroscopeCore bulk operations
 *
 * This example shows how to use the collapseAll and expandAll methods
 * through the imperative handle API.
 */
import React, { useRef, useState } from "react";
import {
  HydroscopeCore,
  type HydroscopeCoreHandle,
} from "../components/HydroscopeCore.js";
import type { HydroscopeData } from "../types/core.js";
// Example data with containers
const exampleData: HydroscopeData = {
  nodes: [
    { id: "node1", label: "Node 1" },
    { id: "node2", label: "Node 2" },
    { id: "node3", label: "Node 3" },
    { id: "node4", label: "Node 4" },
  ],
  edges: [
    { id: "edge1", source: "node1", target: "node2" },
    { id: "edge2", source: "node3", target: "node4" },
  ],
  hierarchyChoices: [
    { id: "container1", name: "Container 1", children: ["node1", "node2"] },
    { id: "container2", name: "Container 2", children: ["node3", "node4"] },
  ],
  nodeAssignments: {
    node1: "container1",
    node2: "container1",
    node3: "container2",
    node4: "container2",
  },
};
export const BulkOperationsExample: React.FC = () => {
  const hydroscopeRef = useRef<HydroscopeCoreHandle>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const handleCollapseAll = async () => {
    if (!hydroscopeRef.current) {
      setMessage("HydroscopeCore not ready");
      return;
    }
    setIsLoading(true);
    setMessage("Collapsing all containers...");
    try {
      await hydroscopeRef.current.collapseAll();
      setMessage("All containers collapsed successfully!");
    } catch (error) {
      setMessage(`Error collapsing containers: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };
  const handleExpandAll = async () => {
    if (!hydroscopeRef.current) {
      setMessage("HydroscopeCore not ready");
      return;
    }
    setIsLoading(true);
    setMessage("Expanding all containers...");
    try {
      await hydroscopeRef.current.expandAll();
      setMessage("All containers expanded successfully!");
    } catch (error) {
      setMessage(`Error expanding containers: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };
  const handleError = (error: Error) => {
    setMessage(`Visualization error: ${error.message}`);
  };
  const handleCollapseAllCallback = () => {
    setMessage("CollapseAll operation completed via callback");
  };
  const handleExpandAllCallback = () => {
    setMessage("ExpandAll operation completed via callback");
  };
  const handleIndividualOperation = async (
    operation: "collapse" | "expand" | "toggle",
    containerId: string,
  ) => {
    if (!hydroscopeRef.current) {
      setMessage("HydroscopeCore not ready");
      return;
    }
    setIsLoading(true);
    setMessage(`${operation}ing container ${containerId}...`);
    try {
      switch (operation) {
        case "collapse":
          await hydroscopeRef.current.collapse(containerId);
          setMessage(`Container ${containerId} collapsed successfully!`);
          break;
        case "expand":
          await hydroscopeRef.current.expand(containerId);
          setMessage(`Container ${containerId} expanded successfully!`);
          break;
        case "toggle":
          await hydroscopeRef.current.toggle(containerId);
          setMessage(`Container ${containerId} toggled successfully!`);
          break;
      }
    } catch (error) {
      setMessage(
        `Error ${operation}ing container ${containerId}: ${(error as Error).message}`,
      );
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Control Panel */}
      <div
        style={{
          padding: "20px",
          borderBottom: "1px solid #ccc",
          backgroundColor: "#f5f5f5",
        }}
      >
        <h2>HydroscopeCore Bulk Operations Example</h2>

        <div style={{ marginBottom: "10px" }}>
          <button
            onClick={handleCollapseAll}
            disabled={isLoading}
            style={{
              marginRight: "10px",
              padding: "8px 16px",
              backgroundColor: "#ff6b6b",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? "Processing..." : "Collapse All"}
          </button>

          <button
            onClick={handleExpandAll}
            disabled={isLoading}
            style={{
              padding: "8px 16px",
              backgroundColor: "#4ecdc4",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? "Processing..." : "Expand All"}
          </button>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <h3
            style={{ margin: "10px 0 5px 0", fontSize: "14px", color: "#666" }}
          >
            Individual Container Operations:
          </h3>
          <button
            onClick={() => handleIndividualOperation("collapse", "container_1")}
            disabled={isLoading}
            style={{
              marginRight: "5px",
              padding: "6px 12px",
              backgroundColor: "#ff9f43",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
              fontSize: "12px",
            }}
          >
            Collapse Container 1
          </button>

          <button
            onClick={() => handleIndividualOperation("expand", "container_1")}
            disabled={isLoading}
            style={{
              marginRight: "5px",
              padding: "6px 12px",
              backgroundColor: "#10ac84",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
              fontSize: "12px",
            }}
          >
            Expand Container 1
          </button>

          <button
            onClick={() => handleIndividualOperation("toggle", "container_1")}
            disabled={isLoading}
            style={{
              marginRight: "10px",
              padding: "6px 12px",
              backgroundColor: "#5f27cd",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
              fontSize: "12px",
            }}
          >
            Toggle Container 1
          </button>

          <button
            onClick={() => handleIndividualOperation("toggle", "container_2")}
            disabled={isLoading}
            style={{
              padding: "6px 12px",
              backgroundColor: "#5f27cd",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
              fontSize: "12px",
            }}
          >
            Toggle Container 2
          </button>
        </div>

        {message && (
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: message.includes("Error")
                ? "#ffebee"
                : "#e8f5e8",
              color: message.includes("Error") ? "#c62828" : "#2e7d32",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          >
            {message}
          </div>
        )}
      </div>

      {/* Visualization */}
      <div style={{ flex: 1 }}>
        <HydroscopeCore
          ref={hydroscopeRef}
          data={exampleData}
          height="100%"
          width="100%"
          showControls={true}
          showMiniMap={true}
          showBackground={true}
          enableCollapse={true}
          onError={handleError}
          onCollapseAll={handleCollapseAllCallback}
          onExpandAll={handleExpandAllCallback}
          onNodeClick={(event, node) => {
            // Node clicked: node.id
          }}
          onContainerCollapse={(containerId) => {
            // Container collapsed: containerId
          }}
          onContainerExpand={(containerId) => {
            // Container expanded: containerId
          }}
        />
      </div>
    </div>
  );
};
export default BulkOperationsExample;
