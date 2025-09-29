import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';

// Aggregated Edge Component
// This edge type is used when multiple edges are collapsed into a single aggregated edge
export const AggregatedEdge: React.FC<EdgeProps> = ({
  id,
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
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Use provided style from semantic processing, with subtle aggregation indicator
  const aggregatedStyle = {
    // Apply semantic styles first
    ...style,
    // Add subtle visual cue that this is aggregated (slightly thicker than normal)
    strokeWidth: style.strokeWidth ? (style.strokeWidth as number) + 1 : 3,
  };

  // Show count of aggregated edges if available
  const originalEdgeCount = (data?.originalEdgeIds as string[])?.length || 0;
  const showLabel = originalEdgeCount > 1;

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={aggregatedStyle}
      />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 10,
              fontWeight: 600,
              background: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '4px',
              pointerEvents: 'all',
              border: '1px solid rgba(255, 255, 255, 0.3)',
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

// Memoized version for performance
export const MemoAggregatedEdge = React.memo(AggregatedEdge);

// Edge types configuration
export const edgeTypes = {
  aggregated: MemoAggregatedEdge,
};