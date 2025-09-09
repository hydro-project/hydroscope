/**
 * @fileoverview Standard Edge Component
 *
 * ReactFlow edge component for standard edges using bridge-based styling.
 */

import React from 'react';
import {
  BaseEdge,
  EdgeProps,
  getStraightPath,
  getBezierPath,
  getSmoothStepPath,
} from '@xyflow/react';
import { useStyleConfig } from './StyleConfigContext';
import { getWavyPath } from './edgePaths';
import { getStroke, getHaloColor, stripHaloStyle, isDoubleLineEdge, isWavyEdge } from './edgeStyle';
import { WAVY_EDGE_CONFIG } from '../shared/config';

/**
 * Standard graph edge component - uses ReactFlow's automatic routing
 */
export function StandardEdge(props: EdgeProps) {
  const styleCfg = useStyleConfig();

  // Debug logging for edge rendering
  const edgeId = props.id;
  const timestamp = Date.now();
  console.log(`[StandardEdge] 🔗 Rendering edge ${edgeId}:`, {
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    style: props.style,
    data: props.data,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
    markerEnd: props.markerEnd,
    styleCfg: {
      edgeStyle: styleCfg.edgeStyle,
    },
    timestamp,
  });

  // Check if this edge should be wavy (based on filter or direct style)
  const isWavy = isWavyEdge(props);

  let edgePath: string;

  if (isWavy) {
    // Use custom wavy path generation
    console.log(`[StandardEdge] 〰️ Using wavy path for edge ${edgeId}`);
    edgePath = getWavyPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: props.targetX,
      targetY: props.targetY,
      amplitude: WAVY_EDGE_CONFIG.standardEdge.amplitude,
      frequency: WAVY_EDGE_CONFIG.standardEdge.frequency,
    });
  } else if (styleCfg.edgeStyle === 'straight') {
    console.log(`[StandardEdge] ➡️ Using straight path for edge ${edgeId}`);
    [edgePath] = getStraightPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: props.targetX,
      targetY: props.targetY,
    });
  } else if (styleCfg.edgeStyle === 'smoothstep') {
    console.log(`[StandardEdge] 📐 Using smooth step path for edge ${edgeId}`);
    [edgePath] = getSmoothStepPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: props.targetX,
      targetY: props.targetY,
      sourcePosition: props.sourcePosition,
      targetPosition: props.targetPosition,
    });
  } else {
    console.log(`[StandardEdge] 🌊 Using bezier path for edge ${edgeId}`);
    [edgePath] = getBezierPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: props.targetX,
      targetY: props.targetY,
      sourcePosition: props.sourcePosition,
      targetPosition: props.targetPosition,
    });
  }

  const { stroke, strokeWidth, strokeDasharray } = getStroke(styleCfg, props.style);
  const isDouble = isDoubleLineEdge(props);
  const haloColor = getHaloColor(props.style as any);

  console.log(`[StandardEdge] 🎨 Edge styling for ${edgeId}:`, {
    stroke,
    strokeWidth,
    strokeDasharray,
    isDouble,
    haloColor,
    edgePathLength: edgePath.length,
    pathPreview: edgePath.substring(0, 50) + '...',
  });

  // Use simple rendering for regular edges (no halo, no double line)
  if (!isDouble && !haloColor) {
    // Ensure arrowhead color matches the computed stroke
    const markerEnd =
      typeof props.markerEnd === 'object' && props.markerEnd
        ? { ...(props.markerEnd as any), color: stroke }
        : props.markerEnd;

    console.log(`[StandardEdge] ✨ Rendering simple edge ${edgeId} with markerEnd:`, markerEnd);
    return (
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke, strokeWidth, strokeDasharray, ...props.style }}
      />
    );
  }

  // Use complex rendering for edges with halos or double lines
  console.log(`[StandardEdge] 🌟 Rendering complex edge ${edgeId} (halo: ${!!haloColor}, double: ${isDouble})`);
  return (
    <g>
      {/* Render halo layer if haloColor is specified */}
      {haloColor && (
        <BaseEdge
          path={edgePath}
          markerEnd={undefined}
          style={{
            stroke: haloColor,
            strokeWidth: strokeWidth + 4,
            strokeDasharray,
            strokeLinecap: 'round',
            opacity: 0.6,
          }}
        />
      )}

      {/* Render main edge - always render this */}
      {/* Main edge with matching arrowhead color */}
      <BaseEdge
        path={edgePath}
        markerEnd={
          typeof props.markerEnd === 'object' && props.markerEnd
            ? { ...(props.markerEnd as any), color: stroke }
            : props.markerEnd
        }
        style={{ stroke, strokeWidth, strokeDasharray, ...stripHaloStyle(props.style) }}
      />

      {/* Render additional rails for double lines */}
      {isDouble && (
        <>
          <BaseEdge
            path={edgePath}
            markerEnd={undefined}
            style={{ stroke, strokeWidth, strokeDasharray, transform: `translate(0, 2px)` }}
          />
          <BaseEdge
            path={edgePath}
            markerEnd={undefined}
            style={{ stroke, strokeWidth, strokeDasharray, transform: `translate(0, -2px)` }}
          />
        </>
      )}
    </g>
  );
}

// Internal memoized variant for use in edgeTypes to reduce re-renders
export const MemoStandardEdge = React.memo(StandardEdge);
