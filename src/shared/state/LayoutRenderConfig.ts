/**
 * LayoutRenderConfig - Layout state and render configuration management
 */
import type { LayoutState } from "../../types/core.js";
import type { RenderConfig } from "../../components/Hydroscope.js";
import { DEFAULT_COLOR_PALETTE, DEFAULT_ELK_ALGORITHM } from "../config.js";

export class LayoutRenderConfig {
  private _layoutState: LayoutState = {
    phase: "initial",
    layoutCount: 0,
    lastUpdate: Date.now(),
  };

  private _renderConfig: Required<RenderConfig> & {
    layoutAlgorithm: string;
  } = {
    edgeStyle: "bezier",
    edgeWidth: 2,
    edgeDashed: false,
    nodePadding: 8,
    nodeFontSize: 12,
    containerBorderWidth: 2,
    colorPalette: DEFAULT_COLOR_PALETTE,
    layoutAlgorithm: DEFAULT_ELK_ALGORITHM,
    fitView: true,
    showFullNodeLabels: false,
  };

  // Smart collapse state
  private _smartCollapseEnabled = true;
  private _smartCollapseOverride = false;

  // Layout state methods
  getLayoutState(): LayoutState {
    return this._layoutState;
  }

  setLayoutPhase(phase: LayoutState["phase"]): void {
    this._layoutState.phase = phase;
    this._layoutState.lastUpdate = Date.now();
  }

  incrementLayoutCount(): void {
    this._layoutState.layoutCount++;
  }

  isFirstLayout(): boolean {
    return this._layoutState.layoutCount === 0;
  }

  setLayoutError(error: string): void {
    this._layoutState.error = error;
    this._layoutState.phase = "error";
  }

  clearLayoutError(): void {
    delete this._layoutState.error;
  }

  recoverFromLayoutError(): void {
    this.clearLayoutError();
    this._layoutState.phase = "initial";
  }

  resetLayoutState(): void {
    this._layoutState = {
      phase: "initial",
      layoutCount: 0,
      lastUpdate: Date.now(),
    };
  }

  // Render config methods
  getRenderConfig(): Required<RenderConfig> & { layoutAlgorithm: string } {
    return { ...this._renderConfig };
  }

  updateRenderConfig(
    config: Partial<RenderConfig & { layoutAlgorithm: string }>,
  ): void {
    this._renderConfig = { ...this._renderConfig, ...config };
  }

  getColorPalette(): string[] {
    return this._renderConfig.colorPalette;
  }

  getEdgeStyle(): "bezier" | "straight" | "step" | "smoothstep" {
    return this._renderConfig.edgeStyle;
  }

  getLayoutAlgorithm(): string {
    return this._renderConfig.layoutAlgorithm;
  }

  // Smart collapse methods
  shouldRunSmartCollapse(): boolean {
    return this._smartCollapseEnabled;
  }

  enableSmartCollapseForNextLayout(): void {
    this._smartCollapseEnabled = true;
    this._smartCollapseOverride = false;
  }

  disableSmartCollapseForUserOperations(): void {
    this._smartCollapseOverride = true;
  }

  resetSmartCollapseState(): void {
    this._smartCollapseEnabled = true;
    this._smartCollapseOverride = false;
  }

  getSmartCollapseStatus(): {
    enabled: boolean;
    override: boolean;
  } {
    return {
      enabled: this._smartCollapseEnabled,
      override: this._smartCollapseOverride,
    };
  }

  clear(): void {
    this.resetLayoutState();
    this.resetSmartCollapseState();
  }
}
