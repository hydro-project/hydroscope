/**
 * @fileoverview Legend Component
 *
 * Displays a color-coded legend for different node types.
 * Data-driven from JSON's nodeTypeConfig, with palette from StyleTuner.
 */
import React, { useMemo, memo } from "react";
import { LegendProps } from "./types";
import { generateNodeColors } from "../shared/colorUtils";
import { COLOR_PALETTES } from "../shared/config/styling.js";
import { COMPONENT_COLORS, TYPOGRAPHY } from "../shared/config/ui.js";

interface LegendItemWithColor {
  type: string;
  label: string;
  description?: string;
  colorIndex?: number;
}

function LegendInner({
  legendData,
  colorPalette = "Set3",
  nodeTypeConfig,
  title,
  compact = false,
  className = "",
  style,
}: LegendProps) {
  // Build legend items from nodeTypeConfig if available, otherwise fall back to legendData
  const legendItems = useMemo((): LegendItemWithColor[] => {
    // Priority 1: Use nodeTypeConfig from JSON if available
    if (nodeTypeConfig?.types && Array.isArray(nodeTypeConfig.types)) {
      return nodeTypeConfig.types.map((type) => ({
        type: type.id,
        label: type.label || type.id,
        description: type.description,
        colorIndex: type.colorIndex,
      }));
    }

    // Priority 2: Fall back to legendData
    if (legendData?.items && Array.isArray(legendData.items)) {
      return legendData.items.map((item) => ({
        type: item.type,
        label: item.label,
        description: item.description,
        colorIndex: undefined, // No colorIndex in legacy format
      }));
    }

    return [];
  }, [nodeTypeConfig, legendData]);

  const displayTitle = title || legendData?.title || "Node Types";
  const paletteKey =
    colorPalette in COLOR_PALETTES
      ? (colorPalette as keyof typeof COLOR_PALETTES)
      : "Set3";

  // Precompute colors for all legend items using a memoized map
  const colorsByType = useMemo(() => {
    const map = new Map<
      string,
      {
        primary: string;
        border: string;
      }
    >();

    for (const item of legendItems) {
      // If colorIndex is specified in nodeTypeConfig, use it directly
      if (typeof item.colorIndex === "number") {
        const palette = COLOR_PALETTES[paletteKey];
        const colorEntry = palette[item.colorIndex % palette.length] as {
          primary: string;
          secondary: string;
          name: string;
        };
        map.set(item.type, {
          primary: colorEntry.primary,
          border: colorEntry.secondary || colorEntry.primary,
        });
      } else {
        // Fall back to generateNodeColors for dynamic color assignment
        const colors = generateNodeColors([item.type], paletteKey) as {
          primary: string;
          border: string;
        };
        map.set(item.type, colors);
      }
    }
    return map;
  }, [legendItems, paletteKey]);

  const legendStyle: React.CSSProperties = useMemo(
    () => ({
      fontSize: compact ? "9px" : "10px",
      ...style,
    }),
    [compact, style],
  );

  const itemStyle: React.CSSProperties = useMemo(
    () => ({
      display: "flex",
      alignItems: "center",
      margin: compact ? "2px 0" : "3px 0",
      fontSize: compact ? TYPOGRAPHY.UI_SMALL : TYPOGRAPHY.UI_MEDIUM,
    }),
    [compact],
  );

  // Safety check for legend items - AFTER all hooks
  if (legendItems.length === 0) {
    return (
      <div className={`legend-empty ${className}`} style={style}>
        <span
          style={{
            color: COMPONENT_COLORS.TEXT_DISABLED,
            fontSize: compact ? TYPOGRAPHY.UI_SMALL : TYPOGRAPHY.UI_MEDIUM,
            fontStyle: "italic",
          }}
        >
          No legend data available
        </span>
      </div>
    );
  }

  const colorBoxStyle = (colors: any): React.CSSProperties => ({
    width: compact ? "10px" : "12px",
    height: compact ? "10px" : "12px",
    borderRadius: "2px",
    marginRight: compact ? "4px" : "6px",
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
            fontWeight: "bold",
            marginBottom: "6px",
            color: COMPONENT_COLORS.TEXT_PRIMARY,
            fontSize: TYPOGRAPHY.UI_SMALL,
          }}
        >
          {displayTitle}
        </div>
      )}

      {legendItems.map((item) => (
        <div
          key={item.type}
          style={itemStyle}
          title={item.description || `${item.label} nodes`}
        >
          <div style={colorBoxStyle(colorsByType.get(item.type)!)} />
          <span style={{ color: COMPONENT_COLORS.TEXT_PRIMARY }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
export const Legend = memo(LegendInner);
