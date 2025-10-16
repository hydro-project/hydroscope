/**
 * @fileoverview Container graph node component
 */
import React from "react";
import { type NodeProps } from "@xyflow/react";
import { truncateLabel } from "../shared/textUtils";
import { DEFAULT_COLOR_PALETTE } from "../shared/config";
import { useStyleConfig } from "./StyleConfigContext";
import { HandlesRenderer } from "./handles";
import {
  getSearchHighlightColors,
  getContrastColor,
} from "../shared/colorUtils";
import { SIZES } from "../shared/config";
export function ContainerNode({
  id,
  data,
  style,
}: NodeProps & {
  style?: React.CSSProperties;
}) {
  // Debug logging for search highlights (only for containers, nodes 2 and 7 are handled in StandardNode)
  if (id === "loc_1" || id === "loc_0") {
  }
  const styleCfg = useStyleConfig();
  // Use dimensions from ReactFlow data (calculated by ELK) with proper fallbacks from config
  const width = Number(data.width) || SIZES.COLLAPSED_CONTAINER_WIDTH;
  const isCollapsed = !data.isExpanded; // ReactFlowBridge sets isExpanded, not collapsed
  const height =
    Number(data.height) ||
    (isCollapsed ? SIZES.COLLAPSED_CONTAINER_HEIGHT : 180);

  const searchHighlight = (data as any).searchHighlight;
  const searchHighlightStrong = (data as any).searchHighlightStrong;
  const colorPalette = String(data.colorPalette || DEFAULT_COLOR_PALETTE);
  const nodeCount = Number(data.nodeCount || 0);
  const containerLabel = String(data.label || id);
  const containerLongLabel = String(data.longLabel || data.label || id);

  const generateContainerColors = (containerId: string, palette: string) => {
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
    // Convert hex to rgba for transparency
    const hexToRgba = (hex: string, alpha: number) => {
      const r = parseInt(hex.substring(1, 3), 16);
      const g = parseInt(hex.substring(3, 5), 16);
      const b = parseInt(hex.substring(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
    return {
      background: hexToRgba(lighten(baseColor, 0.8), 0.3), // Much more transparent
      border: darken(baseColor, 0.2),
      text: darken(baseColor, 0.4),
    };
  };
  if (isCollapsed) {
    const baseContainerColors = generateContainerColors(id, colorPalette);
    const searchColors = getSearchHighlightColors();
    // Apply search highlight colors if needed
    const containerColors = searchHighlight
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
      : {
          ...baseContainerColors,
          // Ensure good contrast for non-highlighted containers too
          text: getContrastColor(baseContainerColors.background),
        };
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
          onClick={() => {
            if (data.onClick && typeof data.onClick === "function") {
              data.onClick(id, "container");
            }
          }}
          style={{
            // Default component styles
            width: `${width}px`,
            height: `${height}px`,
            // COLLAPSED CONTAINERS: More opaque background to distinguish from expanded
            background: containerColors.background.includes("rgba")
              ? containerColors.background.replace(/0\.\d+\)$/, "0.9)")
              : containerColors.background,
            // COLLAPSED CONTAINERS: Thicker border to distinguish from expanded
            border: (() => {
              if (searchHighlightStrong) {
                return `3px solid rgba(249, 115, 22, 0.9)`;
              } else if (searchHighlight) {
                return `3px solid rgba(251, 191, 36, 0.9)`;
              } else {
                return `${(styleCfg.containerBorderWidth ?? 2) + 1}px solid ${containerColors.border}`;
              }
            })(),
            borderRadius: `${styleCfg.containerBorderRadius ?? 8}px`,
            position: "relative", // CRITICAL: Required for absolute positioning of info button
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            // COLLAPSED CONTAINERS: Stronger shadow to distinguish from expanded
            boxShadow: (() => {
              if (searchHighlightStrong) {
                return "0 0 0 6px rgba(249, 115, 22, 0.4), 0 0 20px rgba(249, 115, 22, 0.5), 0 10px 15px -3px rgba(0,0,0,0.3)";
              } else if (searchHighlight) {
                return "0 0 0 5px rgba(251, 191, 36, 0.4), 0 0 15px rgba(251, 191, 36, 0.5), 0 4px 6px -1px rgba(0,0,0,0.2)";
              } else {
                return styleCfg.containerShadow === "NONE"
                  ? "0 2px 8px rgba(0,0,0,0.2)"
                  : styleCfg.containerShadow === "LARGE"
                    ? "0 12px 20px -3px rgba(0,0,0,0.3)"
                    : styleCfg.containerShadow === "MEDIUM"
                      ? "0 6px 10px -1px rgba(0,0,0,0.2)"
                      : "0 4px 12px rgba(0,0,0,0.2)";
              }
            })(),
            transition: "all 0.2s ease",
            // Z-index for search highlighting
            zIndex: searchHighlightStrong ? 100 : searchHighlight ? 50 : 1,
            // Add prominent animation for search highlights
            animation: searchHighlight
              ? searchHighlightStrong
                ? "searchPulseStrong 1.5s ease-in-out infinite"
                : "searchPulse 2s ease-in-out infinite"
              : undefined,
            // Merge ReactFlow styles (for search highlights) - these take precedence
            ...style,
          }}
        >
          <HandlesRenderer />
          <div
            style={{
              fontSize: "13px",
              fontWeight: "600",
              color: containerColors.text,
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
              fontSize: "11px",
              color: containerColors.text,
              opacity: 0.8,
              textAlign: "center",
            }}
          >
            {nodeCount} node{nodeCount !== 1 ? "s" : ""}
          </div>

          {/* Info button for collapsed containers */}
          <div
            style={{
              position: "absolute",
              top: "4px",
              right: "4px",
              width: "18px",
              height: "18px",
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              color: "rgba(59, 130, 246, 0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: "700",
              cursor: "pointer",
              zIndex: 100,
              border: "1px solid rgba(100, 116, 139, 0.3)",
              borderRadius: "50%",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)",
              transition: "all 0.2s ease",
              opacity: 0.7,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
              e.currentTarget.style.backgroundColor =
                "rgba(59, 130, 246, 0.95)";
              e.currentTarget.style.color = "white";
              e.currentTarget.style.transform = "scale(1.1)";
              e.currentTarget.style.boxShadow =
                "0 2px 8px rgba(59, 130, 246, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.7";
              e.currentTarget.style.backgroundColor =
                "rgba(255, 255, 255, 0.9)";
              e.currentTarget.style.color = "rgba(59, 130, 246, 0.85)";
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.12)";
            }}
            onClick={(e) => {
              e.stopPropagation();
              const customEvent = new CustomEvent("hydroscope:showPopup", {
                detail: { nodeId: id },
                bubbles: true,
              });
              window.dispatchEvent(customEvent);
            }}
            title={`Show details for ${containerLabel}`}
          >
            ℹ
          </div>
        </div>
      </>
    );
  }
  // Apply search highlight colors for non-collapsed containers too
  const searchColors = getSearchHighlightColors();
  const nonCollapsedColors = searchHighlight
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
    : {
        background: "rgba(25, 118, 210, 0.1)",
        border: "#1976d2",
        text: "#1976d2", // Blue text on light blue background provides good contrast
      };
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
        onClick={() => {
          if (data.onClick && typeof data.onClick === "function") {
            data.onClick(id, "container");
          }
        }}
        style={{
          padding: `${Math.max((styleCfg.nodePadding ?? 12) + 4, 8)}px`,
          background: nonCollapsedColors.background,
          border: `${styleCfg.containerBorderWidth ?? 2}px solid ${nonCollapsedColors.border}`,
          borderRadius: `${styleCfg.containerBorderRadius ?? 8}px`,
          width: `${width}px`,
          height: `${height}px`,
          position: "relative",
          boxSizing: "border-box",
          cursor: "pointer",
          // Ensure large containers can contain their children properly
          overflow: "visible", // Allow child nodes to be visible
          zIndex: 0, // Ensure container is behind child nodes
          boxShadow: (() => {
            if (searchHighlightStrong) {
              return "0 0 0 5px rgba(249, 115, 22, 0.5), 0 10px 15px -3px rgba(0,0,0,0.2)";
            } else if (searchHighlight) {
              return "0 0 0 4px rgba(251, 191, 36, 0.4), 0 4px 6px -1px rgba(0,0,0,0.15)";
            } else {
              return "none";
            }
          })(),
          transition: "all 0.2s ease",
          // Add prominent animation for search highlights
          animation: searchHighlight
            ? searchHighlightStrong
              ? "searchPulseStrong 1.5s ease-in-out infinite"
              : "searchPulse 2s ease-in-out infinite"
            : undefined,
          // Merge ReactFlow styles (for search highlights) - these take precedence
          ...style,
        }}
      >
        <HandlesRenderer />
        {/* EXPANDED CONTAINERS: Only lower-right label, positioned to avoid occlusion */}
        <div
          style={{
            position: "absolute",
            bottom: "8px", // Slightly inset from edge to avoid occlusion
            right: "12px",
            fontSize: "12px",
            fontWeight: "bold",
            color: nonCollapsedColors.text,
            maxWidth: `${Number(width) - 36}px`,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            cursor: "pointer",
            // Enhanced label visibility with background
            background: "rgba(255, 255, 255, 0.9)",
            border: "1px solid rgba(0, 0, 0, 0.1)",
            borderRadius: "4px",
            padding: "2px 6px",
            zIndex: 10, // Ensure label appears above child containers
            textShadow: "none", // Remove text shadow since we have background
            filter: "drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.1))",
          }}
        >
          {truncateLabel(containerLongLabel, {
            maxLength: Math.floor((Number(width) - 36) / 8),
            preferDelimiters: true,
            leftTruncate: false,
          })}
        </div>
      </div>
    </>
  );
}
// Memoized variant to avoid unnecessary re-renders when props are unchanged
export const MemoContainerNode = React.memo(ContainerNode);
export default ContainerNode;
