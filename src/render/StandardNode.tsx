/**
 * @fileoverview Standard graph node component
 */

import React from 'react';
import { type NodeProps } from '@xyflow/react';
import { generateNodeColors } from '../shared/colorUtils';
import { useStyleConfig } from './StyleConfigContext';
import { HandlesRenderer } from './handles';

export function StandardNode({ id, data }: NodeProps) {
  const styleCfg = useStyleConfig();
  // Get dynamic colors based on node type (preferred) or style as fallback
  // Support nodeType possibly nested under a 'data' payload coming from JSON
  const nodeType = String((data as any).nodeType || (data as any)?.data?.nodeType || data.style || 'default');
  const colorPalette = String(data.colorPalette || 'Set3');
  const colors = generateNodeColors([nodeType], colorPalette);

  // Dev-only: log computed color mapping to verify at runtime
  if (process.env.NODE_ENV !== 'production') {
    // Only log a small sample to avoid noise
    if ((window as any).__hydroColorLogCount__ === undefined) (window as any).__hydroColorLogCount__ = 0;
    if ((window as any).__hydroColorLogCount__ < 8) {
      (window as any).__hydroColorLogCount__++;
      // eslint-disable-next-line no-console
      console.debug(`[StandardNode] ${id} type=${nodeType} palette=${colorPalette} ->`, colors);
    }
  }

  // Determine which label to display
  // Priority: data.label (if set by toggle) > data.shortLabel > id
  const displayLabel = data.label || data.shortLabel || id;

  return (
    <div
      style={{
        padding: `${styleCfg.nodePadding ?? 12}px 16px`,
  backgroundColor: colors.primary,
        border: `1px solid ${colors.border}`,
        borderRadius: `${styleCfg.nodeBorderRadius ?? 4}px`,
        fontSize: `${styleCfg.nodeFontSize ?? 12}px`,
        textAlign: 'center',
        minWidth: '120px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        position: 'relative',
  cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
      title={data.fullLabel ? `Click to toggle between:\n"${data.shortLabel || id}"\n"${data.fullLabel}"` : undefined}
    >
      <HandlesRenderer />
      {String(displayLabel)}
    </div>
  );
}

// Memoized variant to avoid unnecessary re-renders when props are unchanged
export const MemoStandardNode = React.memo(StandardNode);

export default StandardNode;
