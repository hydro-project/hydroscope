/**
 * Custom edge marker components for different arrowhead types
 */

import { memo } from "react";

export interface MarkerProps {
  x: number;
  y: number;
  angle: number;
  color: string;
  size?: number;
}

/**
 * Triangle open marker (outline only)
 */
export const TriangleOpenMarker = memo(function TriangleOpenMarker({
  x,
  y,
  angle,
  color,
  size = 8,
}: MarkerProps) {
  return (
    <g transform={`translate(${x}, ${y}) rotate(${angle})`}>
      <path
        d={`M 0 0 L ${-size} ${size / 2} L ${-size} ${-size / 2} Z`}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="miter"
      />
    </g>
  );
});

/**
 * Triangle filled marker
 */
export const TriangleFilledMarker = memo(function TriangleFilledMarker({
  x,
  y,
  angle,
  color,
  size = 8,
}: MarkerProps) {
  return (
    <g transform={`translate(${x}, ${y}) rotate(${angle})`}>
      <path
        d={`M 0 0 L ${-size} ${size / 2} L ${-size} ${-size / 2} Z`}
        fill={color}
        stroke={color}
        strokeWidth={0.5}
        strokeLinejoin="miter"
      />
    </g>
  );
});

/**
 * Circle filled marker
 */
export const CircleFilledMarker = memo(function CircleFilledMarker({
  x,
  y,
  color,
  size = 5,
}: MarkerProps) {
  return (
    <circle
      cx={x}
      cy={y}
      r={size}
      fill={color}
      stroke={color}
      strokeWidth={0.5}
    />
  );
});

/**
 * Diamond open marker (outline only)
 */
export const DiamondOpenMarker = memo(function DiamondOpenMarker({
  x,
  y,
  angle,
  color,
  size = 6,
}: MarkerProps) {
  return (
    <g transform={`translate(${x}, ${y}) rotate(${angle})`}>
      <path
        d={`M 0 0 L ${-size} ${size} L ${-size * 2} 0 L ${-size} ${-size} Z`}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="miter"
      />
    </g>
  );
});

import type { Position } from "@xyflow/react";

/**
 * Calculate the angle for marker rotation based on target node position
 * Markers should be perpendicular to the node edge they're pointing at
 */
export function calculateMarkerAngle(targetPosition: Position): number {
  // targetPosition tells us which side of the target node the edge connects to
  // The marker should point INTO the node from that side
  switch (targetPosition) {
    case "left":
      return 0; // Connects to left side, point right (into node)
    case "right":
      return 180; // Connects to right side, point left (into node)
    case "top":
      return 90; // Connects to top side, point down (into node)
    case "bottom":
      return -90; // Connects to bottom side, point up (into node)
    default:
      return 0;
  }
}

/**
 * Calculate the marker position offset from the target point
 * This ensures the edge line ends at the base of the marker
 */
export function calculateMarkerOffset(
  targetPosition: Position,
  markerSize: number = 8,
): { x: number; y: number } {
  // Offset moves the edge endpoint BACK from the target (toward source)
  // so the edge line stops at the marker base, leaving room for the marker
  // The marker itself stays at the target position (node boundary)
  switch (targetPosition) {
    case "left":
      return { x: -markerSize, y: 0 }; // Move left (back toward source)
    case "right":
      return { x: markerSize, y: 0 }; // Move right (back toward source)
    case "top":
      return { x: 0, y: -markerSize }; // Move up (back toward source)
    case "bottom":
      return { x: 0, y: markerSize }; // Move down (back toward source)
    default:
      return { x: 0, y: 0 };
  }
}
