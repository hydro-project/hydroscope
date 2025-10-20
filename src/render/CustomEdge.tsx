import {
  EdgeProps,
  getStraightPath,
  getBezierPath,
  getSmoothStepPath,
} from "@xyflow/react";
import { memo } from "react";
import {
  extractEdgeStyleData,
  applyWavinessToPath,
  trimPathForMarkers,
  generateHashMarks,
} from "./edgeStyleUtils.js";
import { EDGE_MARKER_CONFIG } from "../shared/config.js";
import {
  TriangleOpenMarker,
  TriangleFilledMarker,
  CircleFilledMarker,
  DiamondOpenMarker,
  calculateMarkerAngle,
  calculateMarkerOffset,
} from "./EdgeMarkers.js";

/**
 * Custom edge component supporting double lines, wavy paths, and halo effects
 *
 * Features:
 * - Double-line rendering for keyed streams (lineStyle: "double")
 * - Wavy path rendering for cycles (waviness: true) - works with all path types
 * - Halo/glow effects (haloColor)
 * - Respects edge style type (straight, bezier, smoothstep)
 * - Combination of all features
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

  // Extract edge styling properties
  const { lineStyle, waviness, haloColor } = extractEdgeStyleData(data, style);
  const isHashed = lineStyle === "double"; // Reuse "double" to mean "hashed"
  const isWavy = waviness === true;

  // Get edge style type from data (straight, bezier, smoothstep)
  const edgeStyleType = (data as any)?.edgeStyleType || "bezier";

  // Determine marker type
  const markerType =
    typeof markerEnd === "object" && markerEnd
      ? (markerEnd as any).type
      : undefined;

  // Always use custom markers for proper perpendicular orientation
  const hasCustomMarker = !!markerEnd;
  const markerSize = 8;

  // Calculate marker offset - this shortens the edge so it ends at marker base
  const markerOffset = hasCustomMarker
    ? calculateMarkerOffset(targetPosition, markerSize)
    : { x: 0, y: 0 };

  // Generate edge path with adjusted target (shortened to marker base)
  const pathParams = {
    sourceX,
    sourceY,
    sourcePosition,
    targetX: targetX + markerOffset.x,
    targetY: targetY + markerOffset.y,
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

  // Apply waviness to the base path if needed
  let styledPath = isWavy ? applyWavinessToPath(basePath) : basePath;

  // Don't trim edges anymore - halos now fade at the ends
  // Wavy, double, and halo edges all go directly to the nodes
  const needsTrimming = false;
  let mainPath = styledPath;
  let connectionPaths: { source: string; target: string } | null = null;

  if (needsTrimming) {
    const { trimmedPath, sourcePoint, targetPoint } = trimPathForMarkers(
      styledPath,
      EDGE_MARKER_CONFIG.trimPercentage,
    );
    mainPath = trimmedPath;

    // Create simple straight connection lines from nodes to styled path
    // These should always be straight to connect smoothly
    // Target connection should end at marker base (with offset applied)
    const connectionTargetX = targetX + markerOffset.x;
    const connectionTargetY = targetY + markerOffset.y;

    connectionPaths = {
      source: `M ${sourceX} ${sourceY} L ${sourcePoint.x} ${sourcePoint.y}`,
      target: `M ${targetPoint.x} ${targetPoint.y} L ${connectionTargetX} ${connectionTargetY}`,
    };
  }

  // Extract style properties
  const { stroke, strokeWidth, strokeDasharray } = style || {};
  const baseStroke = stroke || "#b1b1b7";
  const baseStrokeWidth = (strokeWidth as number) || 1;

  const pathStyle = {
    stroke: baseStroke,
    strokeWidth: baseStrokeWidth,
    strokeDasharray,
    fill: "none",
  };

  // Calculate marker angle based on target position (perpendicular to node)
  const markerAngle = calculateMarkerAngle(targetPosition);

  // Render custom marker component based on type
  const renderCustomMarker = () => {
    if (!hasCustomMarker) {
      return null;
    }

    const markerProps = {
      x: targetX,
      y: targetY,
      angle: markerAngle,
      color: baseStroke,
      size: markerSize,
    };

    switch (markerType) {
      case "arrow":
        return <TriangleOpenMarker {...markerProps} />;
      case "triangle-open":
        return <TriangleOpenMarker {...markerProps} />;
      case "triangle-filled":
        return <TriangleFilledMarker {...markerProps} />;
      case "circle-filled":
        return <CircleFilledMarker {...markerProps} />;
      case "diamond-open":
        return <DiamondOpenMarker {...markerProps} />;
      case "arrowclosed":
      default:
        // Default to filled triangle for standard edges
        return <TriangleFilledMarker {...markerProps} />;
    }
  };

  const customMarker = renderCustomMarker();
  // Never use ReactFlow markers - always use our custom ones for consistent orientation
  const useReactFlowMarker = false;

  // Generate unique gradient ID for halo fade effect
  const edgeId = `${props.id || "edge"}-${sourceX}-${sourceY}-${targetX}-${targetY}`;
  const gradientId = `halo-gradient-${edgeId}`;

  // Calculate actual path length using SVG path API
  const calculatePathLength = (pathString: string): number => {
    if (typeof document === "undefined") return 0;
    const tempPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    tempPath.setAttribute("d", pathString);
    // getTotalLength may not be available in test environments (jsdom)
    if (typeof tempPath.getTotalLength === "function") {
      return tempPath.getTotalLength();
    }
    // Fallback: estimate length from path string for tests
    return 100;
  };

  const actualPathLength = calculatePathLength(mainPath);
  const fadeDistance = 25; // Fixed pixel distance for fade
  const fadeStartPercent = Math.max(
    0,
    ((actualPathLength - fadeDistance) / actualPathLength) * 100,
  );

  // Determine if we need to reverse the gradient based on edge direction
  // For objectBoundingBox, gradient goes left-to-right, top-to-bottom
  // We need to reverse if target is to the left or above the source
  const needsReverseGradient = targetX < sourceX || targetY < sourceY;

  // Render edge (with optional hash marks for keyed streams)
  if (!isHashed) {
    return (
      <g>
        {/* Define gradient for halo fade effect - fades last 25px before marker */}
        {haloColor && (
          <defs>
            <linearGradient id={gradientId}>
              {needsReverseGradient ? (
                <>
                  <stop offset="0%" stopColor={haloColor} stopOpacity="0" />
                  <stop
                    offset={`${100 - fadeStartPercent}%`}
                    stopColor={haloColor}
                    stopOpacity="0.6"
                  />
                  <stop offset="100%" stopColor={haloColor} stopOpacity="0.6" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor={haloColor} stopOpacity="0.6" />
                  <stop
                    offset={`${fadeStartPercent}%`}
                    stopColor={haloColor}
                    stopOpacity="0.6"
                  />
                  <stop offset="100%" stopColor={haloColor} stopOpacity="0" />
                </>
              )}
            </linearGradient>
          </defs>
        )}
        {/* 1. Halo/glow effect (back layer - fades at ends) */}
        {haloColor && (
          <path
            d={mainPath}
            stroke={`url(#${gradientId})`}
            strokeWidth={baseStrokeWidth + 4}
            fill="none"
            style={{ strokeDasharray: "none" }}
          />
        )}
        {/* 2. Connection lines (middle layer - plain, no halo) */}
        {connectionPaths && (
          <>
            <path d={connectionPaths.source} style={pathStyle} />
            <path
              d={connectionPaths.target}
              style={pathStyle}
              markerEnd={useReactFlowMarker ? markerEnd : undefined}
            />
          </>
        )}
        {/* 3. Main styled edge (front layer) */}
        <path
          d={mainPath}
          style={{ ...pathStyle, strokeLinecap: "round" }}
          markerEnd={
            !connectionPaths && useReactFlowMarker ? markerEnd : undefined
          }
        />
        {/* 4. Custom marker (if not using ReactFlow's built-in) */}
        {customMarker}
      </g>
    );
  }

  // Hashed line rendering (keyed streams)
  // Generate hash marks along the path
  const hashMarks = generateHashMarks(mainPath, 15, 6);

  return (
    <g>
      {/* Define gradient for halo fade effect - fades last 25px before marker */}
      {haloColor && (
        <defs>
          <linearGradient id={`${gradientId}-hashed`}>
            {needsReverseGradient ? (
              <>
                <stop offset="0%" stopColor={haloColor} stopOpacity="0" />
                <stop
                  offset={`${100 - fadeStartPercent}%`}
                  stopColor={haloColor}
                  stopOpacity="0.6"
                />
                <stop offset="100%" stopColor={haloColor} stopOpacity="0.6" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor={haloColor} stopOpacity="0.6" />
                <stop
                  offset={`${fadeStartPercent}%`}
                  stopColor={haloColor}
                  stopOpacity="0.6"
                />
                <stop offset="100%" stopColor={haloColor} stopOpacity="0" />
              </>
            )}
          </linearGradient>
        </defs>
      )}
      {/* 1. Halo/glow effect (back layer - fades at ends) */}
      {haloColor && (
        <path
          d={mainPath}
          stroke={`url(#${gradientId}-hashed)`}
          strokeWidth={baseStrokeWidth + 4}
          fill="none"
          style={{ strokeDasharray: "none" }}
        />
      )}
      {/* 2. Connection lines (middle layer - plain, no halo) */}
      {connectionPaths && (
        <>
          <path d={connectionPaths.source} style={pathStyle} />
          <path
            d={connectionPaths.target}
            style={pathStyle}
            markerEnd={useReactFlowMarker ? markerEnd : undefined}
          />
        </>
      )}
      {/* 3. Main line (front layer) */}
      <path
        d={mainPath}
        style={{ ...pathStyle, strokeLinecap: "round" }}
        markerEnd={
          !connectionPaths && useReactFlowMarker ? markerEnd : undefined
        }
      />
      {/* 4. Hash marks (perpendicular tick marks) */}
      {hashMarks.map((mark, idx) => (
        <line
          key={idx}
          x1={mark.x1}
          y1={mark.y1}
          x2={mark.x2}
          y2={mark.y2}
          stroke={baseStroke}
          strokeWidth={baseStrokeWidth * 0.8}
          strokeOpacity={0.5}
          strokeLinecap="round"
        />
      ))}
      {/* 5. Custom marker (if not using ReactFlow's built-in) */}
      {customMarker}
    </g>
  );
});
