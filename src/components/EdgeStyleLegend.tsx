/**
 * @fileoverview EdgeStyleLegend Component
 *
 * Displays a legend showing what different edge visual styles represent
 * based on semantic tags from the JSON data's edgeStyleConfig.
 *
 * Uses the same CustomEdge component as the main graph to ensure consistency.
 */
import React, { useMemo } from "react";
import { COMPONENT_COLORS, TYPOGRAPHY, WAVY_EDGE_CONFIG } from "../shared/config";
import { processSemanticTags } from "../utils/StyleProcessor";

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
        Object.entries(group).forEach(([optionName, _styleSettings]) => {
          // Generate a visual sample using the semantic tag (optionName)
          const sample = generateVisualSample(optionName);

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
  // Helper function to generate visual sample from semantic tags using StyleProcessor
  const generateVisualSample = (semanticTag: string) => {
    // Use StyleProcessor to process the semantic tag, just like the graph does
    const processedStyle = processSemanticTags(
      [semanticTag],
      { semanticMappings: edgeStyleConfig?.semanticMappings } as any,
      undefined,
      "edge",
    );

    const height = 20;
    const mid = Math.round(height / 2);

    // Extract styling from processed style
    const stroke = (processedStyle.style.stroke as string) || "#666";
    // Use thin default (1.5) for legend unless explicitly set
    const strokeWidth =
      (processedStyle.style.strokeWidth as number) === 3
        ? 1.5 // Override the default thick width with thin
        : (processedStyle.style.strokeWidth as number) || 1.5;
    const strokeDasharray = processedStyle.style.strokeDasharray as
      | string
      | undefined;
    const haloColor = (processedStyle.style as any).haloColor;
    const isWavy = processedStyle.waviness === true;
    const isHashMarks = processedStyle.lineStyle === "hash-marks";

    // Generate wavy path if needed (using config values scaled for legend size)
    const generateWavyPath = () => {
      // Scale amplitude for legend (legend is ~40px, config is for longer edges)
      const amplitude = WAVY_EDGE_CONFIG.amplitude * 3; // Scale up for visibility in small legend
      const frequency = WAVY_EDGE_CONFIG.frequency / 4; // Scale down frequency for short legend
      let path = `M 0,${mid}`;
      const segments = 20;
      // Stop the wave before the end to leave room for a straight segment
      const waveEndX = 34; // Stop wave 6px before the end
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const x = waveEndX * t;
        const offset = Math.sin(t * frequency * 2 * Math.PI) * amplitude;
        path += ` L ${x},${mid + offset}`;
      }
      // Add a straight segment at the end so the arrowhead points right
      path += ` L 40,${mid}`;
      return path;
    };

    const pathD = isWavy ? generateWavyPath() : `M 0,${mid} L 40,${mid}`;

    return (
      <svg
        width="40"
        height={height}
        viewBox={`0 0 40 ${height}`}
        style={{ overflow: "visible" }}
      >
        {/* Halo layer */}
        {haloColor && (
          <path
            d={pathD}
            stroke={haloColor}
            strokeWidth={strokeWidth + 4}
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* Main edge path */}
        <path
          d={pathD}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          fill="none"
          strokeLinecap="round"
        >
          {processedStyle.animated && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0;5,0;0,0"
              dur="1s"
              repeatCount="indefinite"
            />
          )}
        </path>

        {/* Hash marks (circles) for keyed streams */}
        {isHashMarks && (
          <>
            {[8, 16, 24, 32].map((x) => (
              <circle key={x} cx={x} cy={mid} r={2} fill={stroke} />
            ))}
          </>
        )}

        {/* Arrowhead - always point right regardless of wavy path */}
        {processedStyle.markerEnd && (
          <polygon
            points={`40,${mid} 34,${mid - 3} 34,${mid + 3}`}
            fill={stroke}
          />
        )}
      </svg>
    );
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
