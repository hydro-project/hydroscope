import { BaseEdge, EdgeProps, getStraightPath } from "@xyflow/react";
import { memo } from "react";

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
 * Custom edge component supporting double lines and wavy paths
 *
 * Features:
 * - Double-line rendering for keyed streams (lineStyle: "double")
 * - Wavy path rendering for cycles (waviness: true)
 * - Combination of both (double wavy lines)
 */
export const CustomEdge = memo(function CustomEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, markerEnd, style, data } = props;

  // Extract edge styling properties from data
  const lineStyle = (data as any)?.lineStyle;
  const waviness = (data as any)?.waviness;

  const isDouble = lineStyle === "double";
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
  if (!isDouble) {
    return <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />;
  }

  // Double line rendering - calculate perpendicular offset
  // For parallel lines, we need to offset perpendicular to the edge direction
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.sqrt(dx * dx + dy * dy);

  // Calculate perpendicular offset vector (2px offset for each line)
  const offset = 2;
  const perpX = (-dy / length) * offset;
  const perpY = (dx / length) * offset;

  const pathStyle = {
    stroke: stroke || "#b1b1b7",
    strokeWidth: strokeWidth || 1,
    strokeDasharray,
    fill: "none",
  };

  return (
    <g>
      {/* First line with arrow marker - offset one direction */}
      <g transform={`translate(${perpX}, ${perpY})`}>
        <path d={edgePath} style={pathStyle} markerEnd={markerEnd} />
      </g>
      {/* Second line - offset opposite direction */}
      <g transform={`translate(${-perpX}, ${-perpY})`}>
        <path d={edgePath} style={pathStyle} />
      </g>
    </g>
  );
});
