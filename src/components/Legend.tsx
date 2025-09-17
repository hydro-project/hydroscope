/**
 * @fileoverview Legend Component
 *
 * Displays a color-coded legend for different node types.
 */

import React, { useMemo, memo } from 'react';
import { LegendProps } from './types';
import { generateNodeColors } from '../shared/colorUtils';
import { COLOR_PALETTES, COMPONENT_COLORS } from '../shared/config';
import { TYPOGRAPHY } from '../shared/config';

function LegendInner({
  legendData,
  colorPalette = 'Set3',
  nodeTypeConfig,
  title,
  compact = false,
  className = '',
  style,
}: LegendProps) {
  // Safety check for legendData and items
  if (!legendData || !legendData.items || !Array.isArray(legendData.items)) {
    return (
      <div className={`legend-empty ${className}`} style={style}>
        <span
          style={{
            color: COMPONENT_COLORS.TEXT_DISABLED,
            fontSize: compact ? TYPOGRAPHY.UI_SMALL : TYPOGRAPHY.UI_MEDIUM,
            fontStyle: 'italic',
          }}
        >
          No legend data available
        </span>
      </div>
    );
  }

  const displayTitle = title || legendData.title || 'Legend';
  const paletteKey =
    colorPalette in COLOR_PALETTES ? (colorPalette as keyof typeof COLOR_PALETTES) : 'Set3';

  // Precompute colors for all legend items using a memoized map
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const colorsByType = useMemo(() => {
    const map = new Map<string, { primary: string; border: string }>();
    for (const item of legendData.items) {
      // generateNodeColors accepts an array of types; use single type per item
      const colors = generateNodeColors([item.type], paletteKey) as {
        primary: string;
        border: string;
      };
      map.set(item.type, colors);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nodeTypeConfig is part of the props interface and could affect color generation in future implementations
  }, [legendData.items, paletteKey, nodeTypeConfig]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const legendStyle: React.CSSProperties = useMemo(
    () => ({
      fontSize: compact ? '9px' : '10px',
      ...style,
    }),
    [compact, style]
  );

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const itemStyle: React.CSSProperties = useMemo(
    () => ({
      display: 'flex',
      alignItems: 'center',
      margin: compact ? '2px 0' : '3px 0',
      fontSize: compact ? TYPOGRAPHY.UI_SMALL : TYPOGRAPHY.UI_MEDIUM,
    }),
    [compact]
  );

  const colorBoxStyle = (colors: any): React.CSSProperties => ({
    width: compact ? '10px' : '12px',
    height: compact ? '10px' : '12px',
    borderRadius: '2px',
    marginRight: compact ? '4px' : '6px',
    border: `1px solid ${COMPONENT_COLORS.BORDER_MEDIUM}`,
    flexShrink: 0,
    backgroundColor: colors.primary,
    borderColor: colors.border,
  });

  return (
    <div className={`legend ${className}`} style={legendStyle}>
      {!compact && displayTitle && (
        <div
          style={{
            fontWeight: 'bold',
            marginBottom: '6px',
            color: COMPONENT_COLORS.TEXT_PRIMARY,
            fontSize: TYPOGRAPHY.UI_SMALL,
          }}
        >
          {displayTitle}
        </div>
      )}

      {legendData.items.map(item => (
        <div key={item.type} style={itemStyle} title={item.description || `${item.label} nodes`}>
          <div style={colorBoxStyle(colorsByType.get(item.type)!)} />
          <span style={{ color: COMPONENT_COLORS.TEXT_PRIMARY }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export const Legend = memo(LegendInner);
