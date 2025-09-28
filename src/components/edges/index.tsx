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

  // Default style for aggregated edges
  const aggregatedStyle = {
    strokeWidth: 3,
    stroke: '#ff6b6b',
    strokeDasharray: '5,5',
    ...style,
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
              background: '#ff6b6b',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '4px',
              pointerEvents: 'all',
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