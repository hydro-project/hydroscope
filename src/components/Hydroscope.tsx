import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { FlowGraph } from '../render/FlowGraph';
import { parseGraphJSON } from '../core/JSONParser';
import type { RenderConfig, FlowGraphEventHandlers, LayoutConfig } from '../core/types';
import type { VisualizationState } from '../core/VisualizationState';

export interface HydroscopeProps {
  data: object | string;                 // Graph JSON object or string
  grouping?: string;                     // Optional grouping id to apply
  config?: RenderConfig;                 // Rendering config overrides
  layoutConfig?: LayoutConfig;           // Layout config overrides
  eventHandlers?: FlowGraphEventHandlers;// Optional event handlers
  className?: string;
  style?: React.CSSProperties;
  fillViewport?: boolean;                // Fill the entire viewport
  onParsed?: (metadata: any, visualizationState: VisualizationState) => void;    // Callback with parse metadata and state
  onError?: (error: string) => void;     // Callback on parse error
}

export interface HydroscopeRef {
  getVisualizationState: () => VisualizationState | null;
  refreshLayout: (force?: boolean) => Promise<void>;
  fitView: () => void;
}

/**
 * Hydroscope: Minimal, high-level component.
 * Pass graph JSON in, get a rendered interactive visualization out.
 */
export const Hydroscope = forwardRef<HydroscopeRef, HydroscopeProps>(({
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
}, ref) => {
  const [error, setError] = useState<string | null>(null);
  const flowGraphRef = React.useRef<any>(null);

  const { visState, mergedConfig } = useMemo(() => {
    try {
      // Reset previous error
      setError(null);

      const { state, metadata } = parseGraphJSON(data as any, grouping);
      
      // Call onParsed with both metadata and visualization state
      onParsed?.(metadata, state);

      // Merge any edge style configuration coming from JSON into render config
      const merged: RenderConfig | undefined = metadata?.edgeStyleConfig
        ? { ...config, edgeStyleConfig: metadata.edgeStyleConfig }
        : config;

      return { visState: state, mergedConfig: merged };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onError?.(msg);
      return { visState: null, mergedConfig: config } as any;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, grouping, config]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getVisualizationState: () => visState,
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
  }), [visState]);

  if (error) {
    return (
      <div className={className} style={{ color: '#b00', padding: 12, ...style }}>
        Failed to parse graph JSON: {error}
      </div>
    );
  }

  if (!visState) {
    return (
      <div className={className} style={{ padding: 12, ...style }}>
        No data
      </div>
    );
  }

  return (
    <FlowGraph
      ref={flowGraphRef}
      visualizationState={visState}
      config={mergedConfig}
      layoutConfig={layoutConfig}
      eventHandlers={eventHandlers}
      className={className}
      style={style}
      fillViewport={fillViewport}
    />
  );
});

Hydroscope.displayName = 'Hydroscope';

export default Hydroscope;
