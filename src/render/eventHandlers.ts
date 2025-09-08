/**
 * @fileoverview Bridge-Based Event Handlers
 *
 * Compatibility wrappers for alpha event handling.
 */

import type {
  Node as ReactFlowNode,
  Edge as ReactFlowEdge,
  NodeMouseHandler as _NodeMouseHandler,
  EdgeMouseHandler as _EdgeMouseHandler,
} from '@xyflow/react';

export function createNodeEventHandlers(_config?: unknown) {
  return {
    onClick: (_event: React.MouseEvent, _node: ReactFlowNode) => {},
  };
}

export function createEdgeEventHandlers(_config?: unknown) {
  return {
    onClick: (_event: React.MouseEvent, _edge: ReactFlowEdge) => {},
  };
}

export function createContainerEventHandlers(_config?: unknown) {
  return {
    onClick: (_event: React.MouseEvent, _container: unknown) => {},
  };
}
