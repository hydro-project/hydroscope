/**
 * @fileoverview Simple handles renderer component
 *
 * Renders basic ReactFlow handles for nodes.
 */

import React from 'react';
import { Handle, Position } from '@xyflow/react';

const HANDLE_STYLE = {
  width: 8,
  height: 8,
  background: '#555',
  border: '2px solid #fff',
};

export function HandlesRenderer() {
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={HANDLE_STYLE}
        isConnectable={true}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={HANDLE_STYLE}
        isConnectable={true}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={HANDLE_STYLE}
        isConnectable={true}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={HANDLE_STYLE}
        isConnectable={true}
      />
    </>
  );
}
