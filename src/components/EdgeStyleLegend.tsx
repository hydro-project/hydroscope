/**
 * @fileoverview EdgeStyleLegend Component
 *
 * Displays a legend showing what different edge visual styles represent
 * based on semantic tags from the JSON data's edgeStyleConfig.
 */
import React, { useMemo } from "react";
import {
  COMPONENT_COLORS,
  TYPOGRAPHY,
  WAVY_EDGE_CONFIG,
} from "../shared/config";

interface EdgeStyleLegendProps {
  edgeStyleConfig?: {
    semanticMappings?: Record<
      string,
      Record<string, Record<string, string | number>>
    >;
  };
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
// No hardcoded edge style samples - all generated dynamically from semantic mappings
function EdgeStyleLegendInner({
  edgeStyleConfig,
  compact = false,
  className = "",
  style,
}: EdgeStyleLegendProps) {
  // Safety check for edgeStyleConfig
  if (!edgeStyleConfig?.semanticMappings) {
    return (
      <div className={`edge-style-legend-empty ${className}`} style={style}>
        <span
          style={{
            color: COMPONENT_COLORS.TEXT_DISABLED,
            fontSize: compact ? TYPOGRAPHY.UI_SMALL : TYPOGRAPHY.UI_MEDIUM,
            fontStyle: "italic",
          }}
        >
          No edge style data available
        </span>
      </div>
    );
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const legendStyle: React.CSSProperties = useMemo(
    () => ({
      fontSize: compact ? "9px" : "10px",
      ...style,
    }),
    [compact, style],
  );
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const styles = useMemo(() => {
    const pairBoxStyle: React.CSSProperties = {
      display: "flex",
      alignItems: "center",
      border: "1px solid #ddd",
      borderRadius: "4px",
      padding: "6px 8px",
      margin: "2px 0",
      backgroundColor: "#fafafa",
    };
    const contentStyle: React.CSSProperties = { flex: 1 };
    const edgeRowStyle: React.CSSProperties = {
      display: "flex",
      alignItems: "center",
      fontSize: compact ? TYPOGRAPHY.UI_SMALL : TYPOGRAPHY.UI_MEDIUM,
    };
    const sampleStyle: React.CSSProperties = {
      marginRight: "10px",
      minWidth: "48px",
      display: "flex",
      alignItems: "center",
    };
    const labelStyle: React.CSSProperties = {
      fontSize: compact ? "9px" : "11px",
      color: COMPONENT_COLORS.TEXT_PRIMARY,
    };
    return {
      pairBoxStyle,
      contentStyle,
      edgeRowStyle,
      sampleStyle,
      labelStyle,
    };
  }, [compact]);
  // Helper function to render semantic mapping boxes grouped by category
  const renderSemanticMappingBoxes = () => {
    if (!edgeStyleConfig.semanticMappings) return null;

    const allBoxes: JSX.Element[] = [];

    // Process each group
    Object.entries(edgeStyleConfig.semanticMappings).forEach(
      ([groupName, group], groupIndex) => {
        // Add group header with visual separator
        const displayGroupName = groupName.replace(/Group$/, "");

        if (groupIndex > 0) {
          // Add separator between groups
          allBoxes.push(
            <div
              key={`separator-${groupName}`}
              style={{
                height: "1px",
                backgroundColor: COMPONENT_COLORS.BORDER_LIGHT,
                margin: "8px 0",
              }}
            />,
          );
        }

        // Add group header
        allBoxes.push(
          <div
            key={`header-${groupName}`}
            style={{
              fontSize: compact ? "10px" : "12px",
              fontWeight: "600",
              color: COMPONENT_COLORS.TEXT_SECONDARY,
              marginBottom: "4px",
              marginTop: groupIndex > 0 ? "4px" : "0px",
            }}
          >
            {displayGroupName}
          </div>,
        );

        // Process each option within the group
        Object.entries(group).forEach(([optionName, styleSettings]) => {
          // Generate a visual sample based on the style settings
          const sample = generateVisualSample(styleSettings);

          const box = (
            <div
              key={`${groupName}-${optionName}`}
              style={{
                ...styles.pairBoxStyle,
                marginBottom: "3px",
              }}
            >
              <div style={styles.contentStyle}>
                <div style={styles.edgeRowStyle}>
                  <div style={styles.sampleStyle}>{sample}</div>
                  <span style={styles.labelStyle}>{optionName}</span>
                </div>
              </div>
            </div>
          );
          allBoxes.push(box);
        });
      },
    );

    return allBoxes;
  };
  // Helper function to generate visual sample from style settings
  const generateVisualSample = (
    styleSettings: Record<string, string | number>,
  ) => {
    const linePattern = (styleSettings["line-pattern"] as string) || "solid";
    // Default to thin to match graph default stroke width
    const lineWidth = (styleSettings["line-width"] as number) ?? 1;
    const animation = styleSettings["animation"] as string;
    const lineStyle = (styleSettings["line-style"] as string) || "single";
    const halo = styleSettings["halo"] as string;
    const arrowhead = styleSettings["arrowhead"] as string;
    const waviness = styleSettings["waviness"] as string;
    let strokeDasharray = undefined;
    switch (linePattern) {
      case "dashed":
        strokeDasharray = "8,4";
        break;
      case "dotted":
        strokeDasharray = "2,2";
        break;
      case "dash-dot":
        strokeDasharray = "8,2,2,2";
        break;
    }
    const haloColors = {
      "light-blue": "#e6f3ff",
      // Slightly stronger so it peeks beyond the stroke clearly
      "light-red": "#ffb3b3",
      "light-green": "#e6ffe6",
    };
    const haloColor =
      halo && halo !== "none"
        ? haloColors[halo as keyof typeof haloColors]
        : undefined;
    // Helper to render a head marker according to arrowhead
    const renderHeadMarker = (x: number, y: number, color: string) => {
      switch (arrowhead) {
        case "triangle-open":
          return (
            <polygon
              points={`${x},${y} ${x - 6},${y - 4} ${x - 6},${y + 4}`}
              fill="none"
              stroke={color}
              strokeWidth={1}
            />
          );
        case "triangle-filled":
          return (
            <polygon
              points={`${x},${y} ${x - 6},${y - 4} ${x - 6},${y + 4}`}
              fill={color}
            />
          );
        case "circle-filled":
          return <circle cx={x - 4} cy={y} r={3} fill={color} />;
        case "diamond-open":
          return (
            <polygon
              points={`${x - 2},${y} ${x - 6},${y - 3} ${x - 10},${y} ${x - 6},${y + 3}`}
              fill="none"
              stroke={color}
              strokeWidth={1}
            />
          );
        default:
          return null;
      }
    };
    // Helper to build a wavy path using config parameters
    const wavePathD = (y: number) => {
      const edgeLength = 40; // SVG width
      const { amplitude, frequency, baseWaveLength, pointsPerWave } =
        WAVY_EDGE_CONFIG;

      // Calculate total waves and sample points for smooth rendering
      const totalWaves = (edgeLength / baseWaveLength) * frequency;
      const totalPoints = Math.max(
        pointsPerWave,
        Math.ceil(totalWaves * pointsPerWave),
      );

      // Build path with many small line segments for smooth curves
      let path = `M0,${y}`;
      for (let i = 1; i <= totalPoints; i++) {
        const t = i / totalPoints;
        const x = edgeLength * t;
        const wavePhase = t * totalWaves * 2 * Math.PI;
        const offset = Math.sin(wavePhase) * amplitude;
        const finalY = y + offset;
        path += ` L${x.toFixed(2)},${finalY.toFixed(2)}`;
      }
      return path;
    };
    const isWavy = waviness === "wavy";
    if (lineStyle === "hash-marks") {
      // Render line with circles (matching CustomEdge implementation)
      const height = Math.max(10, lineWidth + 8);
      const mid = Math.round(height / 2);
      const circleRadius = 3;

      // Generate circles for legend (every 8px, matching CustomEdge spacing)
      const circles = [];
      for (let x = 8; x < 40; x += 8) {
        circles.push(
          <circle
            key={x}
            cx={x}
            cy={mid}
            r={circleRadius}
            fill="#4a5568"
            stroke="none"
          />,
        );
      }

      return (
        <svg
          width="40"
          height={height}
          viewBox={`0 0 40 ${height}`}
          style={{ overflow: "visible" }}
        >
          {/* approximate head marker in legend */}
          {renderHeadMarker(34, mid, "#4a5568")}
          {/* Halo if present */}
          {haloColor && (
            <line
              x1="0"
              y1={mid}
              x2="40"
              y2={mid}
              stroke={haloColor}
              strokeWidth={lineWidth + 4}
              strokeDasharray={strokeDasharray}
              strokeLinecap="round"
            />
          )}
          {/* Main line */}
          <line
            x1="0"
            y1={mid}
            x2="40"
            y2={mid}
            stroke="#4a5568"
            strokeWidth={lineWidth}
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
          >
            {animation === "animated" && (
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0,0;5,0;0,0"
                dur="1s"
                repeatCount="indefinite"
              />
            )}
          </line>
          {/* Filled circles instead of hash marks */}
          {circles}
        </svg>
      );
    } else {
      // Render single line with extra height to avoid stroke clipping
      const height = Math.max(8, lineWidth + 4);
      const y = Math.round(height / 2);
      return (
        <svg
          width="40"
          height={height}
          viewBox={`0 0 40 ${height}`}
          style={{ overflow: "visible" }}
        >
          {/* approximate head marker in legend */}
          {renderHeadMarker(34, y, "#4a5568")}
          {haloColor &&
            (isWavy ? (
              <path
                d={wavePathD(y)}
                stroke={haloColor}
                strokeWidth={lineWidth + 4}
                fill="none"
                strokeDasharray={strokeDasharray}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <line
                x1="0"
                y1={y}
                x2="40"
                y2={y}
                stroke={haloColor}
                strokeWidth={lineWidth + 4}
                strokeDasharray={strokeDasharray}
                strokeLinecap="round"
              />
            ))}
          {isWavy ? (
            <path
              d={wavePathD(y)}
              stroke="#4a5568"
              strokeWidth={lineWidth}
              fill="none"
              strokeDasharray={strokeDasharray}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <line
              x1="0"
              y1={y}
              x2="40"
              y2={y}
              stroke="#4a5568"
              strokeWidth={lineWidth}
              strokeDasharray={strokeDasharray}
              strokeLinecap="round"
            >
              {animation === "animated" && (
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0,0;5,0;0,0"
                  dur="1s"
                  repeatCount="indefinite"
                />
              )}
            </line>
          )}
        </svg>
      );
    }
  };

  // Memoize sections to avoid re-computation on unrelated re-renders
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const semanticBoxes = useMemo(
    () => renderSemanticMappingBoxes(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- renderSemanticMappingBoxes is stable
    [edgeStyleConfig?.semanticMappings, styles],
  );

  return (
    <div className={`edge-style-legend ${className}`} style={legendStyle}>
      <div
        style={{
          fontWeight: "bold",
          marginBottom: compact ? "6px" : "8px",
          fontSize: compact ? TYPOGRAPHY.UI_SMALL : TYPOGRAPHY.UI_MEDIUM,
          color: COMPONENT_COLORS.TEXT_PRIMARY,
        }}
      >
        Edge Styles
      </div>

      {semanticBoxes}
    </div>
  );
}
export const EdgeStyleLegend = React.memo(EdgeStyleLegendInner);
