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

  // Double line rendering - render three BaseEdge components
  // Technique: CSS transform to offset parallel lines by ±2px
  // - Main line: normal position with arrow marker
  // - Top rail: offset -2px, no arrow
  // - Bottom rail: offset +2px, no arrow
  return (
    <g>
      {/* Main line with arrow marker */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke, strokeWidth, strokeDasharray }}
      />
      {/* Top rail (no arrow) */}
      <BaseEdge
        path={edgePath}
        markerEnd={undefined}
        style={{
          stroke,
          strokeWidth,
          strokeDasharray,
          transform: "translate(0, -2px)",
        }}
      />
      {/* Bottom rail (no arrow) */}
      <BaseEdge
        path={edgePath}
        markerEnd={undefined}
        style={{
          stroke,
          strokeWidth,
          strokeDasharray,
          transform: "translate(0, 2px)",
        }}
      />
    </g>
  );
});

