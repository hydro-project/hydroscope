/**
 * @fileoverview Standard graph node component
 */

import React from 'react';
import { type NodeProps } from '@xyflow/react';
import { generateNodeColors } from '../shared/colorUtils';
import { truncateLabel } from '../shared/textUtils';
import { useStyleConfig } from './StyleConfigContext';
import { HandlesRenderer } from './handles';

// Container color generation (copied from ContainerNode for consistency)
function generateContainerColors(containerId: string, palette: string) {
  const hash = containerId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const colorPalettes: Record<string, string[]> = {
    Set3: ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69'],
    Pastel1: ['#fbb4ae', '#b3cde3', '#ccebc5', '#decbe4', '#fed9a6', '#ffffcc', '#e5d8bd'],
    Dark2: ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02', '#a6761d'],
    Set1: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628'],
    Set2: ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494']
  };

  const colors = colorPalettes[palette] || colorPalettes['Set3'];
  const baseColor = colors[hash % colors.length];

  const lighten = (color: string, factor: number) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const newR = Math.floor(r + (255 - r) * factor);
    const newG = Math.floor(g + (255 - g) * factor);
    const newB = Math.floor(b + (255 - b) * factor);
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  };

  const darken = (color: string, factor: number) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const newR = Math.floor(r * (1 - factor));
    const newG = Math.floor(g * (1 - factor));
    const newB = Math.floor(b * (1 - factor));
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  };

  return { 
    background: lighten(baseColor, 0.8), 
    border: darken(baseColor, 0.2), 
    text: darken(baseColor, 0.4) 
  };
}

export function StandardNode({ id, data }: NodeProps) {
  const styleCfg = useStyleConfig();
  
  // Check if this is a collapsed container
  const isCollapsedContainer = data.collapsed === true;
  
  // Get dynamic colors based on node type (preferred) or style as fallback
  // Support nodeType possibly nested under a 'data' payload coming from JSON
  const nodeType = String((data as any).nodeType || (data as any)?.data?.nodeType || data.style || 'default');
  const colorPalette = String(data.colorPalette || 'Set3');
  
  // Use different color generation for collapsed containers
  const colors = isCollapsedContainer 
    ? generateContainerColors(id, colorPalette)
    : generateNodeColors([nodeType], colorPalette);
    
  // For collapsed containers, get the same variables as ContainerNode
  const width = data.width || (isCollapsedContainer ? 180 : 120);
  const height = data.height || (isCollapsedContainer ? 100 : 40);
  const nodeCount = Number(data.nodeCount || 0);
  const containerLabel = String(data.label || id);

  // Dev-only: log computed color mapping to verify at runtime
  if (process.env.NODE_ENV !== 'production') {
    // Only log a small sample to avoid noise
    if ((window as any).__hydroColorLogCount__ === undefined) (window as any).__hydroColorLogCount__ = 0;
    if ((window as any).__hydroColorLogCount__ < 8) {
      (window as any).__hydroColorLogCount__++;
    }
  }

  // Different styling for collapsed containers vs regular nodes
  if (isCollapsedContainer) {
    const containerColors = generateContainerColors(id, colorPalette);
    return (
      <div
        style={{
          width: `${width}px`,
          height: `${height}px`,
          background: containerColors.background,
          border: `${styleCfg.containerBorderWidth ?? 2}px solid ${containerColors.border}`,
          borderRadius: `${styleCfg.containerBorderRadius ?? 8}px`,
          position: 'relative',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow:
            styleCfg.containerShadow === 'NONE'
              ? 'none'
              : styleCfg.containerShadow === 'LARGE'
                ? '0 10px 15px -3px rgba(0,0,0,0.2)'
                : styleCfg.containerShadow === 'MEDIUM'
                  ? '0 4px 6px -1px rgba(0,0,0,0.15)'
                  : '0 2px 8px rgba(0,0,0,0.15)',
          transition: 'all 0.2s ease'
        }}
      >
        <HandlesRenderer />
        <div
          style={{
            fontSize: '13px',
            fontWeight: '600',
            color: containerColors.text,
            textAlign: 'center',
            maxWidth: `${Number(width) - 16}px`,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: '4px',
            cursor: 'pointer'
          }}
        >
          {truncateLabel(containerLabel, { maxLength: Math.floor((Number(width) - 16) / 8), preferDelimiters: true, leftTruncate: true })}
        </div>
        <div style={{ fontSize: '11px', color: containerColors.text, opacity: 0.8, textAlign: 'center' }}>
          {nodeCount} node{nodeCount !== 1 ? 's' : ''}
        </div>
      </div>
    );
  }

  // Determine which label to display for regular nodes
  // Priority: data.label (if set by toggle) > data.shortLabel > id
  const displayLabel = data.label || data.shortLabel || id;

  // Regular node styling
  return (
    <div
      style={{
        padding: `${styleCfg.nodePadding ?? 12}px 16px`,
        backgroundColor: colors.primary,
        border: `1px solid ${colors.border}`,
        borderRadius: `${styleCfg.nodeBorderRadius ?? 8}px`,
        fontSize: `${styleCfg.nodeFontSize ?? 12}px`,
        textAlign: 'center',
        minWidth: '120px',
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
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
