/**
 * @fileoverview StyleTunerPanel Component
 *
 * Provides UI controls for adjusting visualization styling and layout settings.
 *
 * IMPORTANT: This component uses AsyncCoordinator queue operations to prevent race conditions:
 * 1. Layout algorithm changes use asyncCoordinator.updateLayoutAlgorithm()
 * 2. Color palette changes use asyncCoordinator.updateColorPalette()
 * 3. Edge style changes use asyncCoordinator.updateEdgeStyle()
 * 4. Label visibility changes use asyncCoordinator.toggleFullNodeLabels()
 * 5. All operations are queued sequentially to prevent ResizeObserver errors
 * 6. Error handling is provided through onError callback
 *
 * This follows the queue-based architecture pattern for all DOM-mutating operations.
 */
import React, { useState, memo } from "react";
import { Button, Divider } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import {
  PANEL_CONSTANTS,
  DEFAULT_COLOR_PALETTE,
  DEFAULT_ELK_ALGORITHM,
} from "../../shared/config";
import { AsyncCoordinator } from "../../core/AsyncCoordinator";
import { VisualizationState } from "../../core/VisualizationState";

// Edge style type definition
type EdgeStyleKind = "bezier" | "straight" | "smoothstep";
export interface StyleConfig {
  edgeStyle?: EdgeStyleKind;
  edgeWidth?: number;
  edgeDashed?: boolean;
  nodePadding?: number;
  nodeFontSize?: number;
  containerBorderWidth?: number;
  containerShadow?: "none" | "light" | "medium" | "heavy";
  showFullNodeLabels?: boolean;
}
// Layout algorithm options (matching ELK's available algorithms)
const layoutOptions = {
  mrtree: "MR Tree",
  layered: "Layered",
  force: "Force-Directed",
  stress: "Stress Minimization",
};
// Color palette options
const paletteOptions = {
  Set3: "Set3",
  Set2: "Set2",
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
  onEdgeStyleChange?: (edgeStyle: "bezier" | "straight" | "smoothstep") => void;
  onResetToDefaults?: () => void;
  defaultCollapsed?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // v1.0.0 Architecture Integration (reserved for future use)
  visualizationState?: VisualizationState | null;
  asyncCoordinator?: AsyncCoordinator | null;
  onError?: (error: Error) => void;
  onFullNodeLabelsChange?: (enabled: boolean) => void;
  onReallocateBridges?: () => {
    asyncCoordinator: any;
    visualizationState: any;
    forceRemount: () => void;
  } | null;
}
const StyleTunerPanelInternal: React.FC<StyleTunerPanelProps> = ({
  value,
  onChange,
  colorPalette = DEFAULT_COLOR_PALETTE,
  onPaletteChange,
  currentLayout = DEFAULT_ELK_ALGORITHM,
  onLayoutChange,
  onEdgeStyleChange,
  onResetToDefaults,
  defaultCollapsed: _defaultCollapsed = false,
  open = true,
  onOpenChange,
  visualizationState: _visualizationState,
  asyncCoordinator: _asyncCoordinator,
  onError: _onError,
  onFullNodeLabelsChange,
  onReallocateBridges: _onReallocateBridges,
}: StyleTunerPanelProps) => {
  // Use getDerivedStateFromProps pattern - store prev value in state
  const [local, setLocal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);

  // Sync when external value changes (React 18+ pattern)
  if (value !== prevValue) {
    setPrevValue(value);
    setLocal(value);
  }
  // Removed unused _update function - using direct state updates instead
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
            onChange={async (e) => {
              const newLayout = e.target.value;

              // Call legacy callback if provided (with error handling)
              if (onLayoutChange) {
                try {
                  onLayoutChange(newLayout);
                } catch (error) {
                  console.error(
                    "[StyleTuner] Layout change callback failed:",
                    error,
                  );
                  if (_onError) {
                    _onError(error as Error);
                  }
                }
              }

              // Use AsyncCoordinator queue operation if available
              if (_asyncCoordinator && _visualizationState) {
                try {
                  await _asyncCoordinator.updateLayoutAlgorithm(
                    newLayout,
                    _visualizationState,
                    {
                      fitView: true,
                    },
                  );
                } catch (error) {
                  console.error(
                    "[StyleTuner] Layout algorithm update failed:",
                    error,
                  );
                  if (_onError) {
                    _onError(error as Error);
                  }
                }
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
            onChange={async (e) => {
              // Update local state immediately for responsive UI
              const newEdgeStyle = e.target.value as EdgeStyleKind;
              const next = { ...local, edgeStyle: newEdgeStyle };
              setLocal(next);

              // Call legacy callback (with error handling)
              try {
                onChange(next);
              } catch (error) {
                console.error("[StyleTuner] onChange callback failed:", error);
                if (_onError) {
                  _onError(error as Error);
                }
              }

              // Call legacy edge style callback if provided (with error handling)
              if (onEdgeStyleChange) {
                try {
                  onEdgeStyleChange(newEdgeStyle);
                } catch (error) {
                  console.error(
                    "[StyleTuner] Edge style change callback failed:",
                    error,
                  );
                  if (_onError) {
                    _onError(error as Error);
                  }
                }
              }

              // Use AsyncCoordinator queue operation if available
              if (_asyncCoordinator && _visualizationState) {
                try {
                  await _asyncCoordinator.updateEdgeStyle(
                    newEdgeStyle,
                    _visualizationState,
                    {
                      fitView: false,
                    },
                  );
                } catch (error) {
                  console.error(
                    "[StyleTuner] Edge style update failed:",
                    error,
                  );
                  if (_onError) {
                    _onError(error as Error);
                  }
                }
              }
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
            onChange={async (e) => {
              const newPalette = e.target.value;

              // Call legacy callback if provided (with error handling)
              if (onPaletteChange) {
                try {
                  onPaletteChange(newPalette);
                } catch (error) {
                  console.error(
                    "[StyleTuner] Palette change callback failed:",
                    error,
                  );
                  if (_onError) {
                    _onError(error as Error);
                  }
                }
              }

              // Use AsyncCoordinator queue operation if available
              if (_asyncCoordinator && _visualizationState) {
                try {
                  await _asyncCoordinator.updateColorPalette(
                    newPalette,
                    _visualizationState,
                    {
                      fitView: false,
                    },
                  );
                } catch (error) {
                  console.error(
                    "[StyleTuner] Color palette update failed:",
                    error,
                  );
                  if (_onError) {
                    _onError(error as Error);
                  }
                }
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
          <label>Show full node labels</label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              fontSize: PANEL_CONSTANTS.FONT_SIZE_SMALL,
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(local.showFullNodeLabels)}
              onChange={async (e) => {
                const enabled = e.target.checked;
                const next = { ...local, showFullNodeLabels: enabled };
                setLocal(next);

                // Call legacy callback
                onChange(next);

                // Handle full node labels mode change
                if (onFullNodeLabelsChange) {
                  onFullNodeLabelsChange(enabled);
                }

                // Use AsyncCoordinator queue operation if available
                if (_asyncCoordinator && _visualizationState) {
                  try {
                    await _asyncCoordinator.toggleFullNodeLabels(
                      enabled,
                      _visualizationState,
                      {
                        fitView: true,
                      },
                    );
                  } catch (error) {
                    console.error(
                      "[StyleTuner] Full node labels toggle failed:",
                      error,
                    );
                    if (_onError) {
                      _onError(error as Error);
                    }
                  }
                }
              }}
              style={{
                marginRight: "8px",
                transform: "scale(1.2)",
              }}
            />
          </label>
        </div>

        <Divider style={{ margin: "16px 0 12px 0" }} />
        <Button
          type="default"
          icon={<ReloadOutlined />}
          onClick={async () => {
            // Call legacy callback if provided
            if (onResetToDefaults) {
              onResetToDefaults();
            }

            // Reset to default values using AsyncCoordinator queue operations
            if (_asyncCoordinator && _visualizationState) {
              try {
                // Reset color palette
                await _asyncCoordinator.updateColorPalette(
                  DEFAULT_COLOR_PALETTE,
                  _visualizationState,
                  { fitView: false },
                );

                // Reset layout algorithm
                await _asyncCoordinator.updateLayoutAlgorithm(
                  DEFAULT_ELK_ALGORITHM,
                  _visualizationState,
                  { fitView: false },
                );

                // Reset edge style to bezier
                await _asyncCoordinator.updateEdgeStyle(
                  "bezier",
                  _visualizationState,
                  { fitView: false },
                );

                // Reset full node labels to false
                await _asyncCoordinator.toggleFullNodeLabels(
                  false,
                  _visualizationState,
                  { fitView: true },
                );
              } catch (error) {
                console.error("[StyleTuner] Reset to defaults failed:", error);
                if (_onError) {
                  _onError(error as Error);
                }
              }
            }
          }}
          block
          size="small"
          style={{ fontSize: "12px" }}
        >
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
};
// Memoized component for performance optimization
export const StyleTunerPanel = memo(StyleTunerPanelInternal);
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
  colors: Array<{
    primary: string;
    secondary?: string;
    name?: string;
  }>;
};
