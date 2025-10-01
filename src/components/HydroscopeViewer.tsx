/**
 * HydroscopeViewer - Simple, read-only graph visualization component
 *
 * A lightweight component that displays Hydroscope graphs with only basic
 * pan/zoom interaction. No panels, no file upload, no editing - just visualization.
 *
 * Perfect for:
 * - Embedding graphs in documentation
 * - Read-only dashboards
 * - Simple graph display without interaction complexity
 *
 * @example
 * ```tsx
 * import { HydroscopeViewer } from '@hydro-project/hydroscope';
 *
 * function MyComponent() {
 *   return (
 *     <HydroscopeViewer
 *       data={graphData}
 *       height="400px"
 *       // layoutAlgorithm prop removed - not implemented in simple viewer
 *     />
 *   );
 * }
 * ```
 */

import React, { useState, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "./nodes/index.js";
import { edgeTypes } from "./edges/index.js";

import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import type { HydroscopeData } from "../types/core.js";

// ============================================================================
// Types
// ============================================================================

export interface HydroscopeViewerProps {
  /**
   * Graph data to visualize
   */
  data: HydroscopeData;

  /**
   * Height of the visualization
   * @default "400px"
   */
  height?: string | number;

  /**
   * Width of the visualization
   * @default "100%"
   */
  width?: string | number;

  // Removed layoutAlgorithm prop - not implemented in simple viewer

  /**
   * Whether to show zoom/pan controls
   * @default true
   */
  showControls?: boolean;

  /**
   * Whether to show minimap
   * @default false
   */
  showMiniMap?: boolean;

  /**
   * Whether to show background pattern
   * @default true
   */
  showBackground?: boolean;

  /**
   * Whether to fit the graph to viewport on load
   * @default true
   */
  fitView?: boolean;

  /**
   * Custom CSS class
   */
  className?: string;

  /**
   * Custom inline styles
   */
  style?: React.CSSProperties;
}

// ============================================================================
// Component
// ============================================================================

export const HydroscopeViewer: React.FC<HydroscopeViewerProps> = ({
  data,
  height = "400px",
  width = "100%",
  // Removed layoutAlgorithm parameter - not implemented
  showControls = true,
  showMiniMap = false,
  showBackground = true,
  fitView = true,
  className,
  style,
}) => {
  const [reactFlowData, setReactFlowData] = useState<{
    nodes: Array<{
      id: string;
      position: { x: number; y: number };
      data: Record<string, unknown>;
    }>;
    edges: Array<{ id: string; source: string; target: string }>;
  }>({ nodes: [], edges: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Process data and generate layout
  useEffect(() => {
    if (!data) {
      setError("No data provided");
      setIsLoading(false);
      return;
    }

    const processData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Parse the data
        const parser = JSONParser.createPaxosParser({ debug: false });
        const parseResult = await parser.parseData(data);
        const visualizationState = parseResult.visualizationState;

        // Set up bridges
        const elkBridge = new ELKBridge({});
        const reactFlowBridge = new ReactFlowBridge({
          nodeStyles: {},
          edgeStyles: {},
          semanticMappings: {},
          propertyMappings: {},
        });

        // Perform layout
        await elkBridge.layout(visualizationState);

        // Convert to ReactFlow format
        const flowData = reactFlowBridge.toReactFlowData(visualizationState);

        if (mountedRef.current) {
          setReactFlowData(flowData);
          setIsLoading(false);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(
            err instanceof Error ? err.message : "Failed to process graph data",
          );
          setIsLoading(false);
        }
      }
    };

    processData();
  }, [data]); // Removed layoutAlgorithm dependency - not implemented

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Container styles
  const containerStyle: React.CSSProperties = {
    height,
    width,
    position: "relative",
    border: "1px solid #e0e0e0",
    borderRadius: "4px",
    overflow: "hidden",
    ...style,
  };

  if (isLoading) {
    return (
      <div className={className} style={containerStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "#666",
          }}
        >
          Loading graph...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className} style={containerStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "#d32f2f",
            textAlign: "center",
            padding: "20px",
          }}
        >
          <div>
            <div style={{ fontSize: "18px", marginBottom: "8px" }}>⚠️</div>
            <div>Error loading graph</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.7 }}>
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={containerStyle}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={reactFlowData.nodes}
          edges={reactFlowData.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView={fitView}
          fitViewOptions={{ padding: 0.1 }}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          style={{ width: "100%", height: "100%" }}
        >
          {showBackground && <Background />}
          {showControls && <Controls showInteractive={false} />}
          {showMiniMap && <MiniMap />}
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

export default HydroscopeViewer;
