import React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { CustomEdge } from "./CustomEdge.js";
// Helper function to get the appropriate path based on edge style type
const getEdgePath = (
  edgeStyleType: string,
  pathParams: {
    sourceX: number;
    sourceY: number;
    sourcePosition: any;
    targetX: number;
    targetY: number;
    targetPosition: any;
  },
) => {
  switch (edgeStyleType) {
    case "straight":
      return getStraightPath(pathParams);
    case "smoothstep":
      return getSmoothStepPath(pathParams);
    case "bezier":
    default:
      return getBezierPath(pathParams);
  }
};
// Aggregated Edge Component
// This edge type is used when multiple edges are collapsed into a single aggregated edge
// Uses CustomEdge to support lineStyle and waviness
export const AggregatedEdge: React.FC<EdgeProps> = (props) => {
  const { sourceX, sourceY, targetX, targetY, data } = props;

  // Show count of aggregated edges if available
  const originalEdgeCount = (data?.originalEdgeIds as string[])?.length || 0;
  const showLabel = originalEdgeCount > 1;

  // Calculate label position (midpoint of edge)
  const labelX = (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2;

  // Use CustomEdge for rendering to support lineStyle and waviness
  return (
    <>
      <CustomEdge {...props} />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 10,
              fontWeight: 600,
              background: "rgba(0, 0, 0, 0.7)",
              color: "white",
              padding: "2px 6px",
              borderRadius: "4px",
              pointerEvents: "all",
              border: "1px solid rgba(255, 255, 255, 0.3)",
            }}
            className="nodrag nopan"
          >
            {originalEdgeCount}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
// Default Edge Component
// This is the standard edge type with default arrowhead
export const DefaultEdge: React.FC<EdgeProps> = ({
  id: _id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}) => {
  // Get edge style type from data, default to bezier
  const edgeStyleType = (data as any)?.edgeStyleType || "bezier";
  const pathParams = {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  };
  const [edgePath] = getEdgePath(edgeStyleType, pathParams);
  // Default to triangle arrowhead if no markerEnd is specified
  const effectiveMarkerEnd = markerEnd || { type: "arrowclosed" };
  // Convert object marker to string format for BaseEdge
  const markerEndString: string | undefined =
    typeof effectiveMarkerEnd === "object" && effectiveMarkerEnd?.type
      ? `url(#react-flow__${effectiveMarkerEnd.type})`
      : (effectiveMarkerEnd as string | undefined);
  return <BaseEdge path={edgePath} markerEnd={markerEndString} style={style} />;
};
// Memoized versions for performance
export const MemoAggregatedEdge = React.memo(AggregatedEdge);
export const MemoDefaultEdge = React.memo(DefaultEdge);
// Edge types configuration
export const edgeTypes = {
  default: CustomEdge,
  aggregated: MemoAggregatedEdge,
};
