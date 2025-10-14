/**
 * @fileoverview Popup node component for displaying long labels
 *
 * This is a ReactFlow node that appears on top of the original node
 * to show the full long label. It follows container movement and
 * occludes the original node.
 */
import React from "react";
import { type NodeProps } from "@xyflow/react";
import { generateNodeColors, getContrastColor } from "../shared/colorUtils";
import { DEFAULT_COLOR_PALETTE, PANEL_CONSTANTS } from "../shared/config";
import { useStyleConfig } from "./StyleConfigContext";

/**
 * Convert hex color to rgba with specified opacity
 */
function hexToRgba(hex: string, opacity: number): string {
  // Remove # if present
  const cleanHex = hex.replace("#", "");

  // Parse hex values
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Darken a hex color and return as rgba with opacity
 */
function darkenColor(hex: string, opacity: number): string {
  // Remove # if present
  const cleanHex = hex.replace("#", "");

  // Parse hex values
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  // Darken by reducing each channel by 50%
  const darkenFactor = 0.5;
  const darkR = Math.floor(r * darkenFactor);
  const darkG = Math.floor(g * darkenFactor);
  const darkB = Math.floor(b * darkenFactor);

  return `rgba(${darkR}, ${darkG}, ${darkB}, ${opacity})`;
}

export function PopupNode({
  id,
  data,
  style,
}: NodeProps & {
  style?: React.CSSProperties;
}) {
  const styleCfg = useStyleConfig();

  // Get the long label to display
  const longLabel = String(data.longLabel || data.label || id);
  const originalNodeType = String(data.originalNodeType || "default");

  // Calculate colors similar to the original node
  const colorPalette = String(data.colorPalette || DEFAULT_COLOR_PALETTE);
  const colors = generateNodeColors([originalNodeType], colorPalette);

  // Use CSS constraints and let the browser handle sizing
  const maxWidth = 400; // Maximum popup width
  const minWidth = 120; // Minimum popup width
  const padding = 16; // Consistent padding

  const popupStyle: React.CSSProperties = {
    minWidth: `${minWidth}px`,
    maxWidth: `${maxWidth}px`,
    width: "max-content", // Let content determine width within constraints
    // Clean dark background with transparency
    backgroundColor: darkenColor(colors.primary, 0.9), // Much darker version of node color
    border: `1px solid rgba(0, 0, 0, 0.8)`, // Thin black border
    borderRadius: `${styleCfg.nodeBorderRadius ?? 8}px`,
    padding: `${padding}px`,
    // Simple shadow for depth
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "white", // White text for good contrast on dark background
    fontSize: `${PANEL_CONSTANTS.FONT_SIZE_POPUP}px`,
    fontWeight: "500",
    textAlign: "center",
    wordWrap: "break-word",
    cursor: "default",
    position: "relative",
    // Floating effect
    transform: "translateZ(0)",
    // Animation
    animation: "popupFadeIn 0.4s ease-out",
    // High z-index to appear above other nodes
    zIndex: 1000,
    // Merge any additional styles
    ...style,
  };

  const closeButtonStyle: React.CSSProperties = {
    position: "absolute",
    top: "8px",
    right: "8px",
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    color: getContrastColor(colors.primary),
    transition: "background-color 0.2s ease",
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Call the close handler passed in data
    if (data.onClose && typeof data.onClose === "function") {
      data.onClose(id);
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes popupFadeIn {
            from {
              opacity: 0;
              transform: scale(0.9) translateZ(0);
            }
            to {
              opacity: 1;
              transform: scale(1) translateZ(0);
            }
          }
        `}
      </style>
      <div style={popupStyle}>
        <button
          style={closeButtonStyle}
          onClick={handleCloseClick}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.backgroundColor =
              "rgba(0, 0, 0, 0.2)";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.backgroundColor =
              "rgba(0, 0, 0, 0.1)";
          }}
          aria-label="Close popup"
        >
          ×
        </button>
        <div
          style={{
            paddingRight: "32px",
            lineHeight: "1.4",
            wordWrap: "break-word",
            overflowWrap: "break-word",
            hyphens: "auto",
          }}
        >
          {longLabel}
        </div>
      </div>
    </>
  );
}

export const MemoPopupNode = React.memo(PopupNode);
export default PopupNode;
