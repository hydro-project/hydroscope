/**
 * @fileoverview Standard graph node component
 */
import React from "react";
import { type NodeProps } from "@xyflow/react";
import {
  generateNodeColors,
  type NodeColor,
  getSearchHighlightColors,
  getContrastColor,
} from "../shared/colorUtils";
import { truncateLabel } from "../shared/textUtils";
import { useStyleConfig } from "./StyleConfigContext";
import { HandlesRenderer } from "./handles";
import { PANEL_CONSTANTS } from "../shared/config";
import {
  UI_CONSTANTS,
  COLOR_CONSTANTS,
  DEFAULT_COLOR_PALETTE,
} from "../shared/config";
// Container color generation (copied from ContainerNode for consistency)
function generateContainerColors(containerId: string, palette: string) {
  const hash = containerId.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
  const colorPalettes: Record<string, string[]> = {
    Set3: [
      "#8dd3c7",
      "#ffffb3",
      "#bebada",
      "#fb8072",
      "#80b1d3",
      "#fdb462",
      "#b3de69",
    ],
    Pastel1: [
      "#fbb4ae",
      "#b3cde3",
      "#ccebc5",
      "#decbe4",
      "#fed9a6",
      "#ffffcc",
      "#e5d8bd",
    ],
    Dark2: [
      "#1b9e77",
      "#d95f02",
      "#7570b3",
      "#e7298a",
      "#66a61e",
      "#e6ab02",
      "#a6761d",
    ],
    Set1: [
      "#e41a1c",
      "#377eb8",
      "#4daf4a",
      "#984ea3",
      "#ff7f00",
      "#ffff33",
      "#a65628",
    ],
    Set2: [
      "#66c2a5",
      "#fc8d62",
      "#8da0cb",
      "#e78ac3",
      "#a6d854",
      "#ffd92f",
      "#e5c494",
    ],
  };
  const colors = colorPalettes[palette] || colorPalettes["Set3"];
  const baseColor = colors[hash % colors.length];
  const lighten = (color: string, factor: number) => {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const newR = Math.floor(r + (255 - r) * factor);
    const newG = Math.floor(g + (255 - g) * factor);
    const newB = Math.floor(b + (255 - b) * factor);
    return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
  };
  const darken = (color: string, factor: number) => {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const newR = Math.floor(r * (1 - factor));
    const newG = Math.floor(g * (1 - factor));
    const newB = Math.floor(b * (1 - factor));
    return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
  };
  return {
    background: lighten(baseColor, COLOR_CONSTANTS.LIGHTEN_FACTOR),
    border: darken(baseColor, COLOR_CONSTANTS.DARKEN_FACTOR),
    text: darken(baseColor, COLOR_CONSTANTS.CONTRAST_FACTOR),
  };
}
export function StandardNode({
  id,
  data,
  style,
}: NodeProps & {
  style?: React.CSSProperties;
}) {
  // Test if React is detecting changes by logging render count
  const renderCount = React.useRef(0);
  // Debug logging for search highlights - expanded to network nodes
  if (id === "0" || id === "8" || id === "2" || id === "7") {
    renderCount.current++;
  }
  const styleCfg = useStyleConfig();
  // Use isClicked from data prop (set by parent handler)
  const isClicked = data.isClicked || false;
  // Check if this is a collapsed container
  const isCollapsedContainer = data.collapsed === true;
  // Get dynamic colors based on node type (preferred) or style as fallback
  // Support nodeType possibly nested under a 'data' payload coming from JSON
  const nodeType = String(
    (data as any).nodeType ||
      (data as any)?.data?.nodeType ||
      data.style ||
      "default",
  );
  const colorPalette = String(data.colorPalette || DEFAULT_COLOR_PALETTE);
  // Use different color generation for collapsed containers
  const rawColors = isCollapsedContainer
    ? generateContainerColors(id, colorPalette)
    : (generateNodeColors([nodeType], colorPalette) as NodeColor);
  // Unified colors interface - normalize different color formats
  const baseColors =
    "primary" in rawColors
      ? { backgroundColor: rawColors.primary, borderColor: rawColors.border }
      : {
          backgroundColor: rawColors.background,
          borderColor: rawColors.border,
        };
  // Apply search highlight colors if needed
  const searchHighlight = (data as any).searchHighlight;
  const searchHighlightStrong = (data as any).searchHighlightStrong;
  const searchColors = getSearchHighlightColors();
  const colors = searchHighlight
    ? {
        backgroundColor: searchHighlightStrong
          ? searchColors.current.background
          : searchColors.match.background,
        borderColor: searchHighlightStrong
          ? searchColors.current.border
          : searchColors.match.border,
        textColor: searchHighlightStrong
          ? searchColors.current.text
          : searchColors.match.text,
      }
    : { ...baseColors, textColor: undefined };
  // For collapsed containers, get the same variables as ContainerNode
  // Calculate width based on label length when in full labels mode
  const showFullLabels = (data as any).showFullNodeLabels;
  const baseWidth = isCollapsedContainer
    ? UI_CONSTANTS.NODE_WIDTH_CONTAINER
    : UI_CONSTANTS.NODE_WIDTH_DEFAULT;

  // FIXED: Use pre-calculated dimensions from VisualizationState when available
  // This ensures nodes are properly sized when "Show full node labels" is enabled
  const width = data.width || baseWidth;
  const height =
    data.height ||
    (isCollapsedContainer
      ? UI_CONSTANTS.NODE_HEIGHT_CONTAINER
      : UI_CONSTANTS.NODE_HEIGHT_DEFAULT);

  if (data.width && showFullLabels) {
    console.log(
      `🎨 [StandardNode] Node ${id}: using width=${width} height=${height} from data (showFullLabels=${showFullLabels})`,
    );
  }
  const nodeCount = Number(data.nodeCount || 0);
  const containerLabel = String(data.label || id);
  // Dev-only: log computed color mapping to verify at runtime
  if (process.env.NODE_ENV !== "production") {
    // Only log a small sample to avoid noise
    if ((window as any).__hydroColorLogCount__ === undefined)
      (window as any).__hydroColorLogCount__ = 0;
    if ((window as any).__hydroColorLogCount__ < 8) {
      (window as any).__hydroColorLogCount__++;
    }
  }
  // Different styling for collapsed containers vs regular nodes
  if (isCollapsedContainer) {
    const containerColors = generateContainerColors(id, colorPalette);
    // Apply search highlight colors for containers too
    const finalContainerColors = searchHighlight
      ? {
          background: searchHighlightStrong
            ? searchColors.current.background
            : searchColors.match.background,
          border: searchHighlightStrong
            ? searchColors.current.border
            : searchColors.match.border,
          text: searchHighlightStrong
            ? searchColors.current.text
            : searchColors.match.text,
        }
      : containerColors;
    return (
      <>
        {/* Search highlight animations use box-shadow to prevent ResizeObserver loops */}
        <style>
          {`
            @keyframes searchPulse {
              0%, 100% { box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.4), 0 4px 6px -1px rgba(0,0,0,0.15); }
              50% { box-shadow: 0 0 0 8px rgba(251, 191, 36, 0.6), 0 6px 10px -1px rgba(0,0,0,0.2); }
            }
            @keyframes searchPulseStrong {
              0%, 100% { box-shadow: 0 0 0 5px rgba(249, 115, 22, 0.5), 0 10px 15px -3px rgba(0,0,0,0.2); }
              50% { box-shadow: 0 0 0 10px rgba(249, 115, 22, 0.7), 0 12px 20px -3px rgba(0,0,0,0.3); }
            }
          `}
        </style>
        <div
          style={{
            width: `${width}px`,
            height: `${height}px`,
            background: finalContainerColors.background,
            border: `${styleCfg.containerBorderWidth ?? 2}px solid ${finalContainerColors.border}`,
            borderRadius: `${styleCfg.containerBorderRadius ?? 8}px`,
            position: "relative",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: (() => {
              // For animated search highlights, use CSS animation instead of static shadow
              if (
                searchHighlight &&
                (searchHighlightStrong || !searchHighlightStrong)
              ) {
                // Base shadow for non-animated state - will be overridden by animation
                return styleCfg.containerShadow === "NONE"
                  ? "0 0 0 2px rgba(251, 191, 36, 0.3)"
                  : styleCfg.containerShadow === "LARGE"
                    ? "0 10px 15px -3px rgba(0,0,0,0.2)"
                    : styleCfg.containerShadow === "MEDIUM"
                      ? "0 4px 6px -1px rgba(0,0,0,0.15)"
                      : "0 2px 8px rgba(0,0,0,0.15)";
              } else {
                return styleCfg.containerShadow === "NONE"
                  ? "none"
                  : styleCfg.containerShadow === "LARGE"
                    ? "0 10px 15px -3px rgba(0,0,0,0.2)"
                    : styleCfg.containerShadow === "MEDIUM"
                      ? "0 4px 6px -1px rgba(0,0,0,0.15)"
                      : "0 2px 8px rgba(0,0,0,0.15)";
              }
            })(),
            transition: "all 0.2s ease",
            // Use box-shadow animations instead of transform to prevent ResizeObserver loops
            animation: searchHighlight
              ? searchHighlightStrong
                ? "searchPulseStrong 2s ease-in-out infinite"
                : "searchPulse 3s ease-in-out infinite"
              : undefined,
          }}
        >
          <HandlesRenderer />
          <div
            style={{
              fontSize: PANEL_CONSTANTS.FONT_SIZE_LABEL,
              fontWeight: "600",
              color: finalContainerColors.text,
              textAlign: "center",
              maxWidth: `${Number(width) - 16}px`,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginBottom: "4px",
              cursor: "pointer",
            }}
          >
            {truncateLabel(containerLabel, {
              maxLength: Math.floor((Number(width) - 16) / 8),
              preferDelimiters: true,
              leftTruncate: true,
            })}
          </div>
          <div
            style={{
              fontSize: PANEL_CONSTANTS.FONT_SIZE_TINY,
              color: finalContainerColors.text,
              opacity: 0.8,
              textAlign: "center",
            }}
          >
            {nodeCount} node{nodeCount !== 1 ? "s" : ""}
          </div>
        </div>
      </>
    );
  }
  // Determine which label to display for regular nodes
  // In full labels mode, always show long label if available
  // Reuse the showFullLabels variable already declared above
  const displayLabel =
    showFullLabels && data.longLabel
      ? data.longLabel
      : data.showingLongLabel && data.longLabel
        ? data.longLabel
        : data.label || data.shortLabel || id;
  // Regular node styling
  return (
    <>
      <style>
        {`
          @keyframes searchPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          @keyframes searchPulseStrong {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.08); }
          }
        `}
      </style>
      <div
        style={{
          // Default component styles
          width: `${width}px`,
          height: `${height}px`,
          padding: `${styleCfg.nodePadding ?? 8}px 16px`,
          backgroundColor: colors.backgroundColor,
          border: `2px solid ${colors.borderColor}`,
          borderRadius: `${styleCfg.nodeBorderRadius ?? 8}px`,
          fontSize: showFullLabels
            ? `${PANEL_CONSTANTS.FONT_SIZE_POPUP}px`
            : `${styleCfg.nodeFontSize ?? 11}px`,
          fontWeight: showFullLabels ? "500" : "normal",
          textAlign: "center",
          boxSizing: "border-box",
          position: "relative",
          overflow: "hidden",
          cursor: "pointer",
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color:
            colors.textColor ||
            getContrastColor(
              colors.backgroundColor || baseColors.backgroundColor,
            ), // Ensure good contrast
          // Click animation styles
          transform: isClicked
            ? "scale(1.05) translateY(-2px)"
            : "scale(1) translateY(0px)",
          // Apply search highlights based on data properties
          ...((data as any)?.isHighlighted &&
          (data as any)?.highlightType === "search"
            ? {
                backgroundColor: "#fbbf24", // Amber-400
                border: "2px solid #f59e0b", // Amber-500
                boxShadow: "0 0 8px #f59e0b40", // Add glow effect with 40% opacity
              }
            : {}),
          // Merge ReactFlow styles (for search highlights) - these take precedence
          ...style,
          boxShadow: (() => {
            const searchHighlight = (data as any).searchHighlight;
            const searchHighlightStrong = (data as any).searchHighlightStrong;
            if (searchHighlightStrong) {
              return "0 0 0 4px rgba(249, 115, 22, 0.5), 0 8px 20px rgba(0,0,0,0.15)";
            } else if (searchHighlight) {
              return "0 0 0 3px rgba(251, 191, 36, 0.4), 0 2px 6px rgba(0,0,0,0.1)";
            } else if (isClicked) {
              return "0 8px 20px rgba(0, 0, 0, 0.15), 0 4px 6px rgba(0, 0, 0, 0.1)";
            } else {
              return "0 2px 4px rgba(0, 0, 0, 0.05)";
            }
          })(),
          // Z-index priority: clicked animation (20) > default (1)
          zIndex: (data as any).searchHighlightStrong ? 30 : isClicked ? 20 : 1,
          // Add prominent animation for search highlights
          animation: (data as any).searchHighlight
            ? (data as any).searchHighlightStrong
              ? "searchPulseStrong 1.5s ease-in-out infinite"
              : "searchPulse 2s ease-in-out infinite"
            : undefined,
        }}
        title={
          data.longLabel && data.longLabel !== displayLabel
            ? `Click to show full label:\n"${data.longLabel}"`
            : undefined
        }
      >
        <HandlesRenderer />
        {String(displayLabel)}
        {data.longLabel ? (
          <div
            className="node-info-button"
            style={{
              position: "absolute",
              top: "3px",
              right: "3px",
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              backgroundColor: "rgba(255, 255, 255, 0.7)",
              border: "1px solid rgba(100, 116, 139, 0.3)",
              color: "rgba(100, 116, 139, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s ease",
              zIndex: 10,
              pointerEvents: "auto",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
              backdropFilter: "blur(4px)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "rgba(59, 130, 246, 0.95)";
              e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.8)";
              e.currentTarget.style.color = "white";
              e.currentTarget.style.transform = "scale(1.1)";
              e.currentTarget.style.boxShadow =
                "0 2px 8px rgba(59, 130, 246, 0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                "rgba(255, 255, 255, 0.7)";
              e.currentTarget.style.borderColor = "rgba(100, 116, 139, 0.3)";
              e.currentTarget.style.color = "rgba(100, 116, 139, 0.7)";
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.05)";
            }}
            onClick={(e) => {
              e.stopPropagation();
              console.log(
                `ℹ️ [StandardNode] Info button clicked for node ${id}`,
              );
              // Dispatch a custom event that Hydroscope can listen for
              const customEvent = new CustomEvent("hydroscope:showPopup", {
                detail: { nodeId: id },
                bubbles: true,
              });
              window.dispatchEvent(customEvent);
            }}
            data-info-button="true"
            title="Show popup with full details (click to open)"
          >
            ℹ
          </div>
        ) : null}

        <style>
          {`
            .node-info-button {
              opacity: 0;
            }
            .react-flow__node:hover .node-info-button {
              opacity: 1;
            }
          `}
        </style>
      </div>
    </>
  );
}
// Memoized variant to avoid unnecessary re-renders when props are unchanged
export const MemoStandardNode = React.memo(StandardNode);
export default StandardNode;
