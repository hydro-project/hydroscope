import React, { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react';
import { FlowGraph } from '../render/FlowGraph';
import { parseGraphJSON } from '../core/JSONParser';
import type { RenderConfig, FlowGraphEventHandlers, LayoutConfig } from '../core/types';
import type { VisualizationState } from '../core/VisualizationState';
import { getProfiler } from '../dev';

export interface HydroscopeCoreProps {
  data: object | string; // Graph JSON object or string
  grouping?: string; // Optional grouping id to apply
  config?: RenderConfig; // Rendering config overrides
  layoutConfig?: LayoutConfig; // Layout config overrides
  eventHandlers?: FlowGraphEventHandlers; // Optional event handlers
  className?: string;
  style?: React.CSSProperties;
  fillViewport?: boolean; // Fill the entire viewport
  onParsed?: (metadata: any, visualizationState: VisualizationState) => void; // Callback with parse metadata and state
  onError?: (error: string) => void; // Callback on parse error
  onCollapseAll?: () => void; // Pack/unpack callbacks
  onExpandAll?: () => void;
  onFitView?: () => void; // Fit view callback
  autoFit?: boolean; // Auto-fit state
  onAutoFitToggle?: (enabled: boolean) => void; // Auto-fit toggle callback
  onLoadFile?: () => void; // Load file callback
  showLoadFile?: boolean; // Show load file button
  reactFlowControlsScale?: number; // Controls scale factor
  // Search highlight integration (optional)
  searchQuery?: string;
  searchMatches?: Array<{ id: string; label: string; type: 'container' | 'node' }>;
  currentSearchMatchId?: string;
}

export interface HydroscopeCoreRef {
  getVisualizationState: () => VisualizationState | null;
  refreshLayout: (force?: boolean) => Promise<void>;
  fitView: () => void;
}

/**
 * Hydroscope: Minimal, high-level component.
 * Pass graph JSON in, get a rendered interactive visualization out.
 */
export const HydroscopeCore = forwardRef<HydroscopeCoreRef, HydroscopeCoreProps>(
  (
    {
      data,
      grouping,
      config,
      layoutConfig,
      eventHandlers,
      className,
      style,
      fillViewport,
      onParsed,
      onError,
      onCollapseAll,
      onExpandAll,
      onFitView,
      autoFit,
      onAutoFitToggle,
      onLoadFile,
      showLoadFile,
      reactFlowControlsScale,
      // search highlight
      searchQuery,
      searchMatches,
      currentSearchMatchId,
    },
    ref
  ) => {
    const flowGraphRef = React.useRef<any>(null);

    // Compute parsed state and merged config without causing state updates during render
    const parseOutcome = useMemo(() => {
      const profiler = getProfiler();

      try {
        profiler?.start('Graph Parsing');
        const { state, metadata } = parseGraphJSON(data as any, grouping);

  // Set a reasonable initial viewport size. On the server (SSR) window is undefined,
  // so fall back to conservative defaults. The actual size will be updated on the
  // client once mounted.
  const hasWindow = typeof window !== 'undefined';
  const vw = hasWindow ? window.innerWidth : 1200; // SSR fallback width
  const vh = hasWindow ? window.innerHeight : 800; // SSR fallback height
  const initialViewportWidth = Math.min(vw * 0.8, 1400);
  const initialViewportHeight = Math.min(vh * 0.8, 800);
  state.setViewport(initialViewportWidth, initialViewportHeight);

        const merged: RenderConfig | undefined = metadata?.edgeStyleConfig
          ? { ...config, edgeStyleConfig: metadata.edgeStyleConfig }
          : config;

        profiler?.end('Graph Parsing', {
          nodeCount: metadata.nodeCount,
          edgeCount: metadata.edgeCount,
          hasGrouping: !!grouping,
        });

        return { state, metadata, mergedConfig: merged, error: null as string | null };
      } catch (e) {
        profiler?.end('Graph Parsing');
        const msg = e instanceof Error ? e.message : String(e);
        return {
          state: null as VisualizationState | null,
          metadata: null as any,
          mergedConfig: config,
          error: msg,
        };
      }
    }, [data, grouping, config]);

    // Notify parent about parse result outside of render
    useEffect(() => {
      if (parseOutcome.error) {
        onError?.(parseOutcome.error);
      } else if (parseOutcome.state && parseOutcome.metadata) {
        onParsed?.(parseOutcome.metadata, parseOutcome.state);
      }
    }, [parseOutcome.error, parseOutcome.state, parseOutcome.metadata, onParsed, onError]);

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        getVisualizationState: () => parseOutcome.state,
        refreshLayout: async (force?: boolean) => {
          if (flowGraphRef.current?.refreshLayout) {
            await flowGraphRef.current.refreshLayout(force);
          }
        },
        fitView: () => {
          if (flowGraphRef.current?.fitView) {
            flowGraphRef.current.fitView();
          }
        },
      }),
      [parseOutcome.state]
    );

    if (parseOutcome.error) {
      return (
        <div className={className} style={{ color: '#b00', padding: 12, ...style }}>
          Failed to parse graph JSON: {parseOutcome.error}
        </div>
      );
    }

    if (!parseOutcome.state) {
      return (
        <div className={className} style={{ padding: 12, ...style }}>
          No data
        </div>
      );
    }

    return (
      <FlowGraph
        ref={flowGraphRef}
        visualizationState={parseOutcome.state}
        config={parseOutcome.mergedConfig}
        layoutConfig={layoutConfig}
        eventHandlers={eventHandlers}
        className={className}
        style={style}
        fillViewport={fillViewport}
        onCollapseAll={onCollapseAll}
        onExpandAll={onExpandAll}
        onFitView={onFitView}
        autoFit={autoFit}
        onAutoFitToggle={onAutoFitToggle}
        onLoadFile={onLoadFile}
        showLoadFile={showLoadFile}
        reactFlowControlsScale={reactFlowControlsScale}
        // pass through search highlight props
        searchQuery={searchQuery}
        searchMatches={searchMatches}
        currentSearchMatchId={currentSearchMatchId}
      />
    );
  }
);

HydroscopeCore.displayName = 'HydroscopeCore';

export default HydroscopeCore;
