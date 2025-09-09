/**
 * Lightweight presentational component for global SVG defs used by edges.
 * Extracted from FlowGraph to reduce render complexity without behavior changes.
 */
import React from 'react';

export const GraphDefs: React.FC = React.memo(() => (
  <svg width="0" height="0" style={{ position: 'absolute' }}>
    <defs>
      {/* ReactFlow standard arrow markers - these are usually auto-generated but seem to be missing */}
      <marker
        id="1__height=15&type=arrowclosed&width=15"
        markerWidth="15"
        markerHeight="15"
        refX="13"
        refY="7.5"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path d="M0,0 L0,15 L15,7.5 z" fill="currentColor" />
      </marker>

      <marker
        id="2__height=15&type=arrowclosed&width=15"
        markerWidth="15"
        markerHeight="15"
        refX="13"
        refY="7.5"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path d="M0,0 L0,15 L15,7.5 z" fill="currentColor" />
      </marker>

      <marker
        id="3__height=15&type=arrowclosed&width=15"
        markerWidth="15"
        markerHeight="15"
        refX="13"
        refY="7.5"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path d="M0,0 L0,15 L15,7.5 z" fill="currentColor" />
      </marker>

      {/* Custom arrowhead markers for collection types */}
      <marker
        id="circle-filled"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <circle cx="4" cy="4" r="3" fill="currentColor" />
      </marker>

      <marker
        id="diamond-open"
        markerWidth="10"
        markerHeight="8"
        refX="8"
        refY="4"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path d="M2,4 L5,1 L8,4 L5,7 Z" fill="none" stroke="currentColor" strokeWidth="1" />
      </marker>
    </defs>
  </svg>
));

GraphDefs.displayName = 'GraphDefs';
