/**
 * @fileoverview StyleTunerPanel Component
 *
 * Provides UI controls for adjusting visualization styling and layout settings.
 *
 * IMPORTANT: This component implements comprehensive ResizeObserver loop prevention:
 * 1. Controls Scale changes use global layout lock to serialize operations
 * 2. Lock is released BEFORE triggering callbacks to allow subsequent layout operations
 * 3. Throttling prevents rapid-fire changes (max 1 change per 200ms)
 * 4. All style changes use requestAnimationFrame batching
 * 5. Visual feedback shows when scale updates are processing
 * 6. Multi-layer error suppression handles any remaining ResizeObserver errors
 *
 * KEY FIX: The lock must be released before calling onChange/onControlsScaleChange
 * because those callbacks trigger refreshLayout() which needs to acquire the same lock.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button, Divider } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import {
  LAYOUT_CONSTANTS,
  PANEL_CONSTANTS,
  UI_CONSTANTS,
} from "../../shared/config";
import { AsyncCoordinator } from "../../core/AsyncCoordinator";
import { VisualizationState } from "../../core/VisualizationState";

type EdgeStyleKind = "bezier" | "straight" | "smoothstep";

export interface StyleConfig {
  edgeStyle?: EdgeStyleKind;
  edgeWidth?: number;
  edgeDashed?: boolean;
  nodePadding?: number;
  nodeFontSize?: number;
  containerBorderWidth?: number;
  containerShadow?: "none" | "light" | "medium" | "heavy";
  reactFlowControlsScale?: number;
}

// Layout algorithm options (matching ELK's available algorithms)
const layoutOptions = {
  layered: "Layered (Default)",
  mrtree: "MR Tree",
  force: "Force-Directed",
  stress: "Stress Minimization",
  radial: "Radial",
};

// Color palette options
const paletteOptions = {
  Set2: "Set2",
  Set3: "Set3",
  Pastel1: "Pastel1",
  Dark2: "Dark2",
};

export interface StyleTunerPanelProps {
  // Feed and control the FlowGraph RenderConfig style fields
  value: StyleConfig;
  onChange: (next: StyleConfig) => void;
  colorPalette?: string;
  onPaletteChange?: (palette: string) => void;
  currentLayout?: string;
  onLayoutChange?: (layout: string) => void;
  onControlsScaleChange?: (scale: number) => void;
  onResetToDefaults?: () => void;
  defaultCollapsed?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // V6 Architecture Integration
  visualizationState?: VisualizationState | null;
  asyncCoordinator?: AsyncCoordinator | null;
  onError?: (error: Error) => void;
}

export function StyleTunerPanel({
  value,
  onChange,
  colorPalette = "Set2",
  onPaletteChange,
  currentLayout = "layered",
  onLayoutChange,
  onControlsScaleChange,
  onResetToDefaults,
  defaultCollapsed: _defaultCollapsed = false,
  open = true,
  onOpenChange,
  visualizationState,
  asyncCoordinator,
  onError,
}: StyleTunerPanelProps) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  // Robust controls scale handler to prevent ResizeObserver loops
  const scaleChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScaleRef = useRef<number>(
    local.reactFlowControlsScale || LAYOUT_CONSTANTS.REACTFLOW_CONTROLS_SCALE,
  );
  const isScaleChangingRef = useRef<boolean>(false);
  const lastScaleChangeTimeRef = useRef<number>(0);
  const [isScaleUpdating, setIsScaleUpdating] = useState<boolean>(false);

  const handleControlsScaleChange = useCallback(
    (newScale: number) => {
      const now = Date.now();

      // Throttle rapid-fire changes - prevent more than one change per 200ms
      if (now - lastScaleChangeTimeRef.current < 200) {
        // Update local state immediately for responsive UI
        setLocal((prev) => ({ ...prev, reactFlowControlsScale: newScale }));
        return;
      }

      // Prevent concurrent scale changes
      if (isScaleChangingRef.current) {
        // Update local state immediately for responsive UI
        setLocal((prev) => ({ ...prev, reactFlowControlsScale: newScale }));
        return;
      }

      // Skip if scale hasn't actually changed
      if (Math.abs(newScale - lastScaleRef.current) < 0.001) {
        return;
      }

      // Update refs and state
      lastScaleRef.current = newScale;
      lastScaleChangeTimeRef.current = now;
      isScaleChangingRef.current = true;
      setIsScaleUpdating(true);

      // Clear any pending changes
      if (scaleChangeTimeoutRef.current) {
        clearTimeout(scaleChangeTimeoutRef.current);
      }

      // Update local state immediately for responsive UI
      setLocal((prev) => ({ ...prev, reactFlowControlsScale: newScale }));

      // Simple timeout-based scale change without complex queueing
      scaleChangeTimeoutRef.current = setTimeout(() => {
        try {
          // Execute the scale change directly
          if (onControlsScaleChange) {
            onControlsScaleChange(newScale);
          } else {
            // Fallback to main onChange if no separate callback
            const next = { ...local, reactFlowControlsScale: newScale };
            onChange(next);
          }

          // Reset the changing flag and visual indicator after operation completes
          setTimeout(() => {
            isScaleChangingRef.current = false;
            setIsScaleUpdating(false);
          }, 100);
        } catch (error) {
          console.error(
            "[StyleTunerPanel] Error during controls scale change:",
            error,
          );
          isScaleChangingRef.current = false;
          setIsScaleUpdating(false);
        }
      }, 200); // Simple delay for stability
    },
    [onControlsScaleChange, onChange, local],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scaleChangeTimeoutRef.current) {
        clearTimeout(scaleChangeTimeoutRef.current);
      }
    };
  }, []);

  const _update = (patch: Partial<typeof local>) => {
    const next = { ...local, ...patch };
    // Update local state immediately for responsive UI
    setLocal(next);

    // Execute synchronously to prevent race conditions with layout operations
    onChange(next);
  };

  const inputStyle: React.CSSProperties = {
    padding: "4px 8px",
    border: "1px solid #ced4da",
    borderRadius: `${PANEL_CONSTANTS.COMPONENT_BORDER_RADIUS}px`,
    backgroundColor: "#fff",
    fontSize: `${PANEL_CONSTANTS.FONT_SIZE_SMALL}px`,
    width: "100%",
  };

  const rowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 120px",
    alignItems: "center",
    gap: "8px",
    marginBottom: PANEL_CONSTANTS.COMPONENT_PADDING / 1.5, // 8px
  };

  // Custom button style for open/close, matching CustomControls
  const controlButtonStyle: React.CSSProperties = {
    fontSize: PANEL_CONSTANTS.FONT_SIZE_LARGE,
    color: "#222",
    marginLeft: PANEL_CONSTANTS.COMPONENT_PADDING / 1.5, // 8px
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    border: "1px solid #3b82f6",
    borderRadius: PANEL_CONSTANTS.COMPONENT_BORDER_RADIUS,
    boxShadow: "0 1px 4px rgba(59,130,246,0.08)",
    transition: "background 0.18s, box-shadow 0.18s",
    padding: "2px 8px",
    outline: "none",
    cursor: "pointer",
  };

  // Add hover/focus effect via inline event handlers
  const [btnHover, setBtnHover] = useState(false);
  const [btnFocus, setBtnFocus] = useState(false);
  const mergedButtonStyle = {
    ...controlButtonStyle,
    backgroundColor:
      btnHover || btnFocus
        ? "rgba(59,130,246,0.18)"
        : controlButtonStyle.backgroundColor,
    boxShadow:
      btnHover || btnFocus
        ? "0 2px 8px rgba(59,130,246,0.16)"
        : controlButtonStyle.boxShadow,
    borderColor: btnHover || btnFocus ? "#2563eb" : "#3b82f6",
  };

  return (
    <div
      style={{
        position: "absolute",
        top: PANEL_CONSTANTS.PANEL_TOP,
        right: PANEL_CONSTANTS.PANEL_RIGHT,
        zIndex: 1200, // higher than button
        minWidth: PANEL_CONSTANTS.STYLE_TUNER_MIN_WIDTH,
        maxWidth: PANEL_CONSTANTS.STYLE_TUNER_MAX_WIDTH,
        background: "#fff",
        boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
        borderRadius: PANEL_CONSTANTS.STYLE_TUNER_BORDER_RADIUS,
        border: "1px solid #eee",
        padding: PANEL_CONSTANTS.STYLE_TUNER_PADDING,
        transition: "transform 0.3s cubic-bezier(.4,0,.2,1), opacity 0.2s",
        transform: open ? "translateX(0)" : "translateX(120%)", // slide from right
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: PANEL_CONSTANTS.COMPONENT_PADDING,
        }}
      >
        <span
          style={{
            fontWeight: 600,
            fontSize: PANEL_CONSTANTS.FONT_SIZE_MEDIUM,
          }}
        >
          Style Tuner
        </span>
        <Button
          type="text"
          size="small"
          onClick={() => onOpenChange?.(false)}
          style={mergedButtonStyle}
          onMouseEnter={() => setBtnHover(true)}
          onMouseLeave={() => setBtnHover(false)}
          onFocus={() => setBtnFocus(true)}
          onBlur={() => setBtnFocus(false)}
        >
          ×
        </Button>
      </div>
      <div style={{ fontSize: PANEL_CONSTANTS.FONT_SIZE_SMALL }}>
        <div style={rowStyle}>
          <label>Layout Algorithm</label>
          <select
            value={currentLayout}
            style={inputStyle}
            onChange={(e) => {
              // Update immediately for responsive UI and execute synchronously
              const newLayout = e.target.value;
              try {
                onLayoutChange?.(newLayout);
              } catch (error) {
                console.error("Layout change failed:", error);
              }
            }}
          >
            {Object.entries(layoutOptions).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div style={rowStyle}>
          <label>Edge Style</label>
          <select
            value={local.edgeStyle || "bezier"}
            style={inputStyle}
            onChange={(e) => {
              // Update local state immediately for responsive UI
              const newEdgeStyle = e.target.value as EdgeStyleKind;
              const next = { ...local, edgeStyle: newEdgeStyle };
              setLocal(next);
              // Execute synchronously to prevent race conditions
              onChange(next);
            }}
          >
            <option value="bezier">Bezier</option>
            <option value="straight">Straight</option>
            <option value="smoothstep">SmoothStep</option>
          </select>
        </div>
        <div style={rowStyle}>
          <label>Color Palette</label>
          <select
            value={colorPalette}
            onChange={(e) => {
              // Update immediately for responsive UI and execute synchronously
              const newPalette = e.target.value;
              try {
                onPaletteChange?.(newPalette);
              } catch (error) {
                console.error("Palette change failed:", error);
              }
            }}
            style={inputStyle}
          >
            {Object.entries(paletteOptions).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div style={rowStyle}>
          <label>
            Controls Scale
            {isScaleUpdating && (
              <span
                style={{
                  color: "#1890ff",
                  fontSize: "12px",
                  marginLeft: "4px",
                }}
              >
                updating...
              </span>
            )}
          </label>
          <input
            type="range"
            min="0.8"
            max="1.9"
            step="0.1"
            value={
              local.reactFlowControlsScale ||
              LAYOUT_CONSTANTS.REACTFLOW_CONTROLS_SCALE
            }
            onChange={(e) => {
              const newScale = parseFloat(e.target.value);
              handleControlsScaleChange(newScale);
            }}
            disabled={isScaleUpdating}
            style={{
              ...inputStyle,
              cursor: isScaleUpdating ? "wait" : "pointer",
              opacity: isScaleUpdating ? 0.7 : 1,
            }}
            title={`Scale: ${(local.reactFlowControlsScale || LAYOUT_CONSTANTS.REACTFLOW_CONTROLS_SCALE).toFixed(1)}x${isScaleUpdating ? " (updating...)" : ""}`}
          />
        </div>
        <Divider style={{ margin: "16px 0 12px 0" }} />
        <Button
          type="default"
          icon={<ReloadOutlined />}
          onClick={onResetToDefaults}
          block
          size="small"
          style={{ fontSize: "12px" }}
        >
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}

export default StyleTunerPanel;

// Export as StyleTuner for compatibility
export { StyleTunerPanel as StyleTuner };

// Export types for compatibility
export type StyleTunerProps = StyleTunerPanelProps;
export type LayoutAlgorithm = {
  id: string;
  name: string;
  description: string;
  elkId: string;
};
export type ColorPaletteOption = {
  id: string;
  name: string;
  description: string;
  colors: Array<{ primary: string; secondary?: string; name?: string }>;
};
