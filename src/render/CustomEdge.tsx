import { BaseEdge, EdgeProps, getStraightPath } from "@xyflow/react";
import { memo } from "react";
import { generateHashMarks } from "./edgeStyleUtils.js";

/**
 * Generate a wavy path using SVG path commands
 * Creates a sine wave between source and target points
 */
function getWavyPath(params: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  amplitude?: number;
  frequency?: number;
}): string {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    amplitude = 8,
    frequency = 4,
  } = params;

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Avoid division by zero for very short edges
  if (distance < 10) {
    return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  }

  // Number of wave cycles based on distance and frequency
  const cycles = Math.max(1, Math.floor(distance / (100 / frequency)));
  const segmentsPerCycle = 8; // Smooth wave with 8 segments per cycle
  const totalSegments = cycles * segmentsPerCycle;

  // Calculate angle for perpendicular offset
  const angle = Math.atan2(dy, dx);
  const perpAngle = angle + Math.PI / 2;

  // Build SVG path with quadratic curves to approximate sine wave
  let path = `M ${sourceX} ${sourceY}`;

  for (let i = 0; i < totalSegments; i++) {
    const t = (i + 1) / totalSegments; // Progress along edge (0 to 1)
    const waveT = t * cycles * 2 * Math.PI; // Wave position

    // Current point position
    const x = sourceX + dx * t;
    const y = sourceY + dy * t;

    // Perpendicular offset based on sine wave
    const offset = Math.sin(waveT) * amplitude;
    const offsetX = Math.cos(perpAngle) * offset;
    const offsetY = Math.sin(perpAngle) * offset;

    // Add line segment to point with wave offset
    path += ` L ${x + offsetX} ${y + offsetY}`;
  }

  return path;
}

/**
 * Custom edge component supporting hash marks and wavy paths
 *
 * Features:
 * - Hash marks rendering for keyed streams (lineStyle: "hash-marks")
 * - Wavy path rendering for unordered streams (waviness: true)
 * - Combination of both (wavy lines with hash marks)
 */
export const CustomEdge = memo(function CustomEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, markerEnd, style, data } = props;

  // Extract edge styling properties from data
  const lineStyle = (data as any)?.lineStyle;
  const waviness = (data as any)?.waviness;

  const hasHashMarks = lineStyle === "hash-marks";
  const isWavy = waviness === true;

  // Generate edge path (wavy or straight)
  let edgePath: string;
  if (isWavy) {
    edgePath = getWavyPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      amplitude: 8,
      frequency: 4,
    });
  } else {
    [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  }

  // Extract style properties
  const { stroke, strokeWidth, strokeDasharray } = style || {};

  // Single line rendering (default case)
  if (!hasHashMarks) {
    return <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />;
  }

  // Hash marks rendering - vertical tick marks along the edge
  const pathStyle = {
    stroke: stroke || "#666666",
    strokeWidth: strokeWidth || 3,
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
