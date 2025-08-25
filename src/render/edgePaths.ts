/**
 * @fileoverview Edge path utilities
 *
 * Shared SVG path generators for custom edge rendering.
 */

import { WAVY_EDGE_CONFIG } from '../shared/config';

/**
 * Generates a wavy (sinusoidal) SVG path between two points.
 * Behavior preserved from original implementation in edges.tsx.
 */
export function getWavyPath({
  sourceX,
  sourceY,
  targetX,
  targetY,
  amplitude = WAVY_EDGE_CONFIG.standardEdge.amplitude,
  frequency = WAVY_EDGE_CONFIG.standardEdge.frequency,
}: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  amplitude?: number;
  frequency?: number;
}): string {
  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  if (distance === 0) {
    return `M ${sourceX} ${sourceY}`;
  }

  // Angle of the straight line
  const angle = Math.atan2(deltaY, deltaX);

  // Number of segments for smooth curve
  const segments = Math.max(
    WAVY_EDGE_CONFIG.calculation.segments.min, 
    Math.floor(distance / WAVY_EDGE_CONFIG.calculation.segments.divisor)
  );

  let path = `M ${sourceX} ${sourceY}`;

  // Calculate points for smooth curve
  const points: { x: number; y: number }[] = [];
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;

    // Base position along the straight line
    const baseX = sourceX + deltaX * t;
    const baseY = sourceY + deltaY * t;

    // Use actual distance traveled for consistent wave density
    const distanceTraveled = distance * t;
    const waveOffset = amplitude * Math.sin(
      (frequency * Math.PI * distanceTraveled) / WAVY_EDGE_CONFIG.calculation.frequencyDivisor
    );

    // Apply perpendicular offset
    const offsetX = -waveOffset * Math.sin(angle);
    const offsetY = waveOffset * Math.cos(angle);

    const x = baseX + offsetX;
    const y = baseY + offsetY;

    points.push({ x, y });
  }

  // Create smooth curve using cubic Bézier curves
  for (let i = 1; i < points.length; i++) {
    const prevPoint = points[i - 1];
    const currentPoint = points[i];
    
    if (i === 1) {
      // First curve segment
      const nextPoint = points[i + 1] || currentPoint;
      
      // Control points for smooth curve
      const cp1x = prevPoint.x + (currentPoint.x - prevPoint.x) * 0.25;
      const cp1y = prevPoint.y + (currentPoint.y - prevPoint.y) * 0.25;
      const cp2x = currentPoint.x - (nextPoint.x - prevPoint.x) * 0.25;
      const cp2y = currentPoint.y - (nextPoint.y - prevPoint.y) * 0.25;
      
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${currentPoint.x} ${currentPoint.y}`;
    } else {
      // Subsequent curve segments
      const prevPrevPoint = points[i - 2] || prevPoint;
      const nextPoint = points[i + 1] || currentPoint;
      
      // Calculate smooth control points based on adjacent points
      const cp1x = prevPoint.x + (currentPoint.x - prevPrevPoint.x) * 0.25;
      const cp1y = prevPoint.y + (currentPoint.y - prevPrevPoint.y) * 0.25;
      const cp2x = currentPoint.x - (nextPoint.x - prevPoint.x) * 0.25;
      const cp2y = currentPoint.y - (nextPoint.y - prevPoint.y) * 0.25;
      
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${currentPoint.x} ${currentPoint.y}`;
    }
  }

  return path;
}
