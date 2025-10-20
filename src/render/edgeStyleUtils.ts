/**
 * Unified edge styling utilities
 * Handles all edge visual properties: lineStyle, waviness, halo, markers
 */

import type { CSSProperties } from "react";
import { WAVY_EDGE_CONFIG } from "../shared/config.js";

export interface EdgeStyleData {
  lineStyle?: "single" | "hash-marks";
  waviness?: boolean;
  haloColor?: string;
  style?: CSSProperties;
}

/**
 * Extract edge style data from edge props
 */
export function extractEdgeStyleData(data: any, style: any): EdgeStyleData {
  return {
    lineStyle: (data as any)?.lineStyle || "single",
    waviness: (data as any)?.waviness || false,
    haloColor: (style as any)?.haloColor,
    style,
  };
}

/**
 * Parse an SVG path string and extract points
 */
function parseSVGPath(pathString: string): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];

  // Simple parser for M, L, C, Q commands
  const commands = pathString.match(/[MLCQmlcq][^MLCQmlcq]*/g) || [];

  for (const cmd of commands) {
    const type = cmd[0];
    const coords = cmd
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number);

    if (type === "M" || type === "m") {
      points.push({ x: coords[0], y: coords[1] });
    } else if (type === "L" || type === "l") {
      points.push({ x: coords[0], y: coords[1] });
    } else if (type === "C" || type === "c") {
      // Cubic bezier - sample the curve
      const startPoint = points[points.length - 1] || { x: 0, y: 0 };
      const cp1 = { x: coords[0], y: coords[1] };
      const cp2 = { x: coords[2], y: coords[3] };
      const endPoint = { x: coords[4], y: coords[5] };

      // Sample 10 points along the bezier curve
      for (let t = 0.1; t <= 1; t += 0.1) {
        const point = sampleCubicBezier(startPoint, cp1, cp2, endPoint, t);
        points.push(point);
      }
    } else if (type === "Q" || type === "q") {
      // Quadratic bezier - sample the curve
      const startPoint = points[points.length - 1] || { x: 0, y: 0 };
      const cp = { x: coords[0], y: coords[1] };
      const endPoint = { x: coords[2], y: coords[3] };

      // Sample 10 points along the bezier curve
      for (let t = 0.1; t <= 1; t += 0.1) {
        const point = sampleQuadraticBezier(startPoint, cp, endPoint, t);
        points.push(point);
      }
    }
  }

  return points;
}

/**
 * Sample a point on a cubic bezier curve
 */
function sampleCubicBezier(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

/**
 * Sample a point on a quadratic bezier curve
 */
function sampleQuadraticBezier(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  return {
    x: mt2 * p0.x + 2 * mt * t * p1.x + t2 * p2.x,
    y: mt2 * p0.y + 2 * mt * t * p1.y + t2 * p2.y,
  };
}

/**
 * Calculate path length from points
 */
function calculatePathLength(points: Array<{ x: number; y: number }>): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

/**
 * Apply waviness to any path (straight, bezier, smoothstep)
 */
export function applyWavinessToPath(
  basePath: string,
  amplitude: number = WAVY_EDGE_CONFIG.amplitude,
  frequency: number = WAVY_EDGE_CONFIG.frequency,
): string {
  // Parse the base path to get points
  const points = parseSVGPath(basePath);

  if (points.length < 2) {
    return basePath;
  }

  // Calculate total path length
  const pathLength = calculatePathLength(points);

  if (pathLength < WAVY_EDGE_CONFIG.minEdgeLength) {
    return basePath;
  }

  // Calculate wave parameters
  const totalWaves = (pathLength / WAVY_EDGE_CONFIG.baseWaveLength) * frequency;
  const pointsPerWave = WAVY_EDGE_CONFIG.pointsPerWave;
  const totalSamplePoints = Math.max(
    pointsPerWave,
    Math.ceil(totalWaves * pointsPerWave),
  );

  // Resample the path to get enough points for smooth waves
  const resampledPoints: Array<{ x: number; y: number }> = [];
  resampledPoints.push(points[0]);

  let accumulatedLength = 0;
  const segmentLengths: number[] = [];

  // Calculate segment lengths
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const length = Math.sqrt(dx * dx + dy * dy);
    segmentLengths.push(length);
  }

  // Resample points along the path
  for (let i = 1; i < totalSamplePoints; i++) {
    const targetLength = (i / totalSamplePoints) * pathLength;
    let currentLength = 0;
    let segmentIndex = 0;

    // Find which segment this point falls on
    while (
      segmentIndex < segmentLengths.length &&
      currentLength + segmentLengths[segmentIndex] < targetLength
    ) {
      currentLength += segmentLengths[segmentIndex];
      segmentIndex++;
    }

    if (segmentIndex >= points.length - 1) {
      resampledPoints.push(points[points.length - 1]);
      continue;
    }

    // Interpolate within the segment
    const segmentProgress =
      (targetLength - currentLength) / segmentLengths[segmentIndex];
    const p0 = points[segmentIndex];
    const p1 = points[segmentIndex + 1];

    resampledPoints.push({
      x: p0.x + (p1.x - p0.x) * segmentProgress,
      y: p0.y + (p1.y - p0.y) * segmentProgress,
    });
  }

  resampledPoints.push(points[points.length - 1]);

  // Build wavy path by applying perpendicular offsets to resampled points
  let wavyPath = `M ${resampledPoints[0].x} ${resampledPoints[0].y}`;
  accumulatedLength = 0;

  for (let i = 1; i < resampledPoints.length; i++) {
    const p0 = resampledPoints[i - 1];
    const p1 = resampledPoints[i];

    // Calculate segment length and direction
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const segmentLength = Math.sqrt(dx * dx + dy * dy);

    if (segmentLength === 0) continue;

    // Calculate perpendicular direction
    const perpX = -dy / segmentLength;
    const perpY = dx / segmentLength;

    // Calculate wave phase based on accumulated length
    const t = accumulatedLength / pathLength;
    const wavePhase = t * totalWaves * 2 * Math.PI;
    const offset = Math.sin(wavePhase) * amplitude;

    // Apply offset
    const finalX = p1.x + perpX * offset;
    const finalY = p1.y + perpY * offset;

    wavyPath += ` L ${finalX.toFixed(2)} ${finalY.toFixed(2)}`;
    accumulatedLength += segmentLength;
  }

  return wavyPath;
}

/**
 * Generate a smooth sinusoidal wavy path (for straight lines)
 */
export function getWavyPath(params: {
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
    amplitude = WAVY_EDGE_CONFIG.amplitude,
    frequency = WAVY_EDGE_CONFIG.frequency,
  } = params;

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < WAVY_EDGE_CONFIG.minEdgeLength) {
    return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  }

  const angle = Math.atan2(dy, dx);
  const perpAngle = angle + Math.PI / 2;

  const pointsPerWave = WAVY_EDGE_CONFIG.pointsPerWave;
  const totalWaves = (distance / WAVY_EDGE_CONFIG.baseWaveLength) * frequency;
  const totalPoints = Math.max(
    pointsPerWave,
    Math.ceil(totalWaves * pointsPerWave),
  );

  let path = `M ${sourceX} ${sourceY}`;

  for (let i = 1; i <= totalPoints; i++) {
    const t = i / totalPoints;
    const x = sourceX + dx * t;
    const y = sourceY + dy * t;
    const wavePhase = t * totalWaves * 2 * Math.PI;
    const offset = Math.sin(wavePhase) * amplitude;
    const finalX = x + Math.cos(perpAngle) * offset;
    const finalY = y + Math.sin(perpAngle) * offset;
    path += ` L ${finalX.toFixed(2)} ${finalY.toFixed(2)}`;
  }

  return path;
}

/**
 * Calculate perpendicular offset for double lines
 */
export function calculateDoubleLineOffset(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  offset: number = 2,
): { perpX: number; perpY: number } {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    return { perpX: 0, perpY: 0 };
  }

  const perpX = (-dy / length) * offset;
  const perpY = (dx / length) * offset;

  return { perpX, perpY };
}

/**
 * Trim a path to leave plain ends for marker visibility
 * Returns the trimmed path and the connection points
 */
export function trimPathForMarkers(
  pathString: string,
  trimPercentage: number = 0.15,
): {
  trimmedPath: string;
  sourcePoint: { x: number; y: number };
  targetPoint: { x: number; y: number };
} {
  const points = parseSVGPath(pathString);

  if (points.length < 2) {
    return {
      trimmedPath: pathString,
      sourcePoint: points[0] || { x: 0, y: 0 },
      targetPoint: points[points.length - 1] || { x: 0, y: 0 },
    };
  }

  // Calculate cumulative lengths
  const lengths: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    lengths.push(lengths[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }

  const totalLength = lengths[lengths.length - 1];

  // Calculate trim length based on percentage, with min/max bounds
  const calculatedTrimLength = totalLength * trimPercentage;
  const trimLength = Math.max(
    8, // minTrimLength
    Math.min(30, calculatedTrimLength), // maxTrimLength
  );

  // If path is too short, don't trim
  if (totalLength < trimLength * 2) {
    return {
      trimmedPath: pathString,
      sourcePoint: points[0],
      targetPoint: points[points.length - 1],
    };
  }

  // Find trim points
  const startTrimLength = trimLength;
  const endTrimLength = totalLength - trimLength;

  // Find start trim point
  let startIndex = 0;
  while (
    startIndex < lengths.length - 1 &&
    lengths[startIndex + 1] < startTrimLength
  ) {
    startIndex++;
  }

  const startT =
    (startTrimLength - lengths[startIndex]) /
    (lengths[startIndex + 1] - lengths[startIndex]);
  const startPoint = {
    x:
      points[startIndex].x +
      (points[startIndex + 1].x - points[startIndex].x) * startT,
    y:
      points[startIndex].y +
      (points[startIndex + 1].y - points[startIndex].y) * startT,
  };

  // Find end trim point
  let endIndex = 0;
  while (
    endIndex < lengths.length - 1 &&
    lengths[endIndex + 1] < endTrimLength
  ) {
    endIndex++;
  }

  const endT =
    (endTrimLength - lengths[endIndex]) /
    (lengths[endIndex + 1] - lengths[endIndex]);
  const endPoint = {
    x:
      points[endIndex].x + (points[endIndex + 1].x - points[endIndex].x) * endT,
    y:
      points[endIndex].y + (points[endIndex + 1].y - points[endIndex].y) * endT,
  };

  // Build trimmed path
  let trimmedPath = `M ${startPoint.x.toFixed(2)} ${startPoint.y.toFixed(2)}`;

  // Add intermediate points
  for (let i = startIndex + 1; i <= endIndex; i++) {
    if (i < endIndex) {
      trimmedPath += ` L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
    }
  }

  // Always add the end point
  trimmedPath += ` L ${endPoint.x.toFixed(2)} ${endPoint.y.toFixed(2)}`;

  return {
    trimmedPath,
    sourcePoint: startPoint,
    targetPoint: endPoint,
  };
}

/**
 * Generate hash marks (perpendicular tick marks) along a path
 * Used for keyed streams to show multiplicity
 * Hash marks are always perpendicular to the overall edge direction (source to target)
 * to maintain parallel alignment even on wavy paths
 */
export function generateHashMarks(
  pathString: string,
  spacing: number = 15,
  markLength: number = 6,
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const points = parseSVGPath(pathString);
  if (points.length < 2) return [];

  // Calculate overall edge direction (from first to last point)
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const overallDx = lastPoint.x - firstPoint.x;
  const overallDy = lastPoint.y - firstPoint.y;
  const overallLength = Math.sqrt(
    overallDx * overallDx + overallDy * overallDy,
  );

  if (overallLength === 0) return [];

  // Overall perpendicular direction (constant for all marks)
  const perpX = -overallDy / overallLength;
  const perpY = overallDx / overallLength;

  const marks: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  let accumulatedLength = 0;
  let nextMarkDistance = spacing / 2; // Start first mark at half spacing

  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const segmentLength = Math.sqrt(dx * dx + dy * dy);

    if (segmentLength === 0) continue;

    // Direction vector (normalized) for this segment
    const dirX = dx / segmentLength;
    const dirY = dy / segmentLength;

    // Check if we should place marks in this segment
    let segmentDistance = 0;
    while (
      accumulatedLength + segmentDistance < nextMarkDistance &&
      segmentDistance < segmentLength
    ) {
      segmentDistance = nextMarkDistance - accumulatedLength;

      if (segmentDistance <= segmentLength) {
        // Calculate mark position along the segment
        const markX = p0.x + dirX * segmentDistance;
        const markY = p0.y + dirY * segmentDistance;

        // Create perpendicular mark using OVERALL direction (not local)
        const halfLength = markLength / 2;
        marks.push({
          x1: markX - perpX * halfLength,
          y1: markY - perpY * halfLength,
          x2: markX + perpX * halfLength,
          y2: markY + perpY * halfLength,
        });

        nextMarkDistance += spacing;
      }
    }

    accumulatedLength += segmentLength;
  }

  return marks;
}
