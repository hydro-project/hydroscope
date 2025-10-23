import {
  BaseEdge,
  EdgeProps,
  getStraightPath,
  getBezierPath,
  getSmoothStepPath,
} from "@xyflow/react";
import { memo } from "react";
import { generateHashMarks, applyWavinessToPath } from "./edgeStyleUtils.js";
import { DEFAULT_STYLE } from "../utils/StyleProcessor.js";

/**
 * Custom edge component supporting hash marks and wavy paths
 *
 * Features:
 * - Hash marks rendering for keyed streams (lineStyle: "hash-marks")
 * - Wavy path rendering for unordered streams (waviness: true)
 * - Combination of both (wavy lines with hash marks)
 */
export const CustomEdge = memo(function CustomEdge(props: EdgeProps) {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    style,
    data,
  } = props;

  // Extract edge styling properties from data
  const lineStyle = (data as any)?.lineStyle;
  const waviness = (data as any)?.waviness;
  const edgeStyleType = (data as any)?.edgeStyleType || "bezier";

  const hasHashMarks = lineStyle === "hash-marks";
  const isWavy = waviness === true;

  // Generate base edge path based on edgeStyleType
  const pathParams = {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  };

  let basePath: string;
  switch (edgeStyleType) {
    case "straight":
      [basePath] = getStraightPath(pathParams);
      break;
    case "smoothstep":
      [basePath] = getSmoothStepPath(pathParams);
      break;
    case "bezier":
    default:
      [basePath] = getBezierPath(pathParams);
      break;
  }

  // Apply waviness on top of the base path if needed (using config defaults)
  const edgePath = isWavy ? applyWavinessToPath(basePath) : basePath;

  // Extract style properties
  const { stroke, strokeWidth, strokeDasharray } = style || {};

  // Single line rendering (default case)
  if (!hasHashMarks) {
    return <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />;
  }

  // Hash marks rendering - vertical tick marks along the edge
  const pathStyle = {
    stroke: stroke || DEFAULT_STYLE.STROKE_COLOR,
    strokeWidth: strokeWidth || DEFAULT_STYLE.STROKE_WIDTH,
    strokeDasharray,
    fill: "none",
  };

  // Generate positions for circles along the path
  const circleSpacing = 20; // pixels between circles
  const circleRadius = 3; // radius of each circle
  const hashMarks = generateHashMarks(edgePath, circleSpacing, 0); // Use 0 for length since we just need positions

  return (
    <g>
      {/* Main edge path with arrow marker */}
      <path d={edgePath} style={pathStyle} markerEnd={markerEnd} />
      {/* Filled circles instead of hash marks */}
      {hashMarks.map((mark, i) => (
        <circle
          key={i}
          cx={(mark.x1 + mark.x2) / 2}
          cy={(mark.y1 + mark.y2) / 2}
          r={circleRadius}
          fill={pathStyle.stroke}
          stroke="none"
        />
      ))}
    </g>
  );
});
