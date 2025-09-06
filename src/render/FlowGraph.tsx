/**
 * @fileoverview Bridge-Based FlowGraph Component
 *
 */

import React, { useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { ReactFlow, Background, MiniMap, ReactFlowProvider } from '@xyflow/react';
import { CustomControls } from '../components/CustomControls';

import { DEFAULT_RENDER_CONFIG, UI_CONSTANTS } from '../shared/config';
import { nodeTypes } from './nodes';
import { edgeTypes } from './edges';
import { StyleConfigProvider } from './StyleConfigContext';
import { GraphDefs } from './GraphDefs';
import { LoadingView, ErrorView, EmptyView, UpdatingOverlay } from './FallbackViews';
import { useFlowGraphController } from '../hooks/useFlowGraphController';
import type { VisualizationState } from '../core/VisualizationState';
import type { RenderConfig, FlowGraphEventHandlers, LayoutConfig } from '../core/types';

export interface FlowGraphProps {
  visualizationState: VisualizationState;
  config?: RenderConfig;
  layoutConfig?: LayoutConfig;
  eventHandlers?: FlowGraphEventHandlers;
  className?: string;
  style?: React.CSSProperties;
  fillViewport?: boolean; // New prop to control viewport sizing
  onCollapseAll?: () => void; // Pack/unpack callbacks
  onExpandAll?: () => void;
  onFitView?: () => void; // Fit view callback
  autoFit?: boolean; // Auto-fit state
  onAutoFitToggle?: (enabled: boolean) => void; // Auto-fit toggle callback
  onLoadFile?: () => void; // Load file callback
  showLoadFile?: boolean; // Show load file button
  reactFlowControlsScale?: number; // Controls scale factor
  // Search highlight integration
  searchQuery?: string;
  searchMatches?: Array<{ id: string; label: string; type: 'container' | 'node' }>;
  currentSearchMatchId?: string;
}

export interface FlowGraphRef {
  fitView: () => void;
  refreshLayout: (force?: boolean) => Promise<void>;
}

// Internal component that uses ReactFlow hooks
const FlowGraphInternal = forwardRef<FlowGraphRef, FlowGraphProps>(
  (
    {
      visualizationState,
      config = DEFAULT_RENDER_CONFIG,
      layoutConfig,
      eventHandlers,
      className,
      style,
      fillViewport = false,
      onCollapseAll,
      onExpandAll,
      onFitView,
      autoFit = false,
      onAutoFitToggle,
      onLoadFile,
      showLoadFile = false,
      reactFlowControlsScale,
      // search
      searchMatches,
      currentSearchMatchId,
    },
    ref
  ) => {
    const {
      reactFlowData,
      loading,
      error,
      refreshLayout,
      fitOnce,
      onNodeClick,
      onEdgeClick,
      onNodeDrag,
      onNodeDragStop,
      onNodesChange,
    } = useFlowGraphController({ visualizationState, config, layoutConfig, eventHandlers });

    const containerRef = useRef<HTMLDivElement>(null);
    const loggedOnceRef = useRef(false);
    const resizeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Track viewport dimensions and update VisualizationState
    useEffect(() => {
      // Skip effect entirely during SSR where DOM APIs are unavailable
      if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') {
        return;
      }
      const container = containerRef.current;
      if (!container) return;

      const updateViewport = () => {
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          visualizationState.setViewport(rect.width, rect.height);
          if (!loggedOnceRef.current) {
            loggedOnceRef.current = true;
          }
          // If AutoFit is enabled, schedule a layout refresh on size changes
          if (config.fitView !== false) {
            if (resizeDebounceRef.current) clearTimeout(resizeDebounceRef.current);
            resizeDebounceRef.current = setTimeout(() => {
              try {
                // Force to ensure ELK considers the new viewport
                refreshLayout(true);
              } catch {}
            }, 200);
          }
        }
      };

      // Set initial viewport size immediately and again on next frame to avoid zero heights
      updateViewport();
      const raf = requestAnimationFrame(updateViewport);

      // Create ResizeObserver to track size changes
      const resizeObserver = new ResizeObserver(() => {
        updateViewport();
      });

      resizeObserver.observe(container);

      // Fallback: also listen to window resize (some browsers/layouts don't fire RO when % heights change)
      const onWindowResize = () => {
        updateViewport();
        if (config.fitView !== false) {
          if (resizeDebounceRef.current) clearTimeout(resizeDebounceRef.current);
          resizeDebounceRef.current = setTimeout(() => {
            refreshLayout(true);
          }, 200);
        }
      };
  window.addEventListener('resize', onWindowResize);

      return () => {
        resizeObserver.disconnect();
        cancelAnimationFrame(raf);
        if (resizeDebounceRef.current) clearTimeout(resizeDebounceRef.current);
        if (typeof window !== 'undefined') {
          window.removeEventListener('resize', onWindowResize);
        }
      };
    }, [visualizationState, refreshLayout, config.fitView]);

    // When ReactFlow data is ready, log the container size again (helps confirm logging is visible)
    useEffect(() => {
      if (!reactFlowData) return;
      const el = containerRef.current;
      if (!el) return;
    }, [reactFlowData]);

    useImperativeHandle(ref, () => ({
      fitView: () => {
        fitOnce();
      },
      refreshLayout: async (force?: boolean) => {
        await refreshLayout(force);
      },
    }));

    // Calculate container styles based on fillViewport prop
    const getContainerStyle = (): React.CSSProperties => {
      if (fillViewport) {
        // Fill the viewport explicitly
        return {
          width: '100vw',
          height: '100vh',
          maxWidth: '100vw',
          maxHeight: '100vh',
          overflow: 'hidden',
          ...style,
        };
      }

      // Non-viewport mode: avoid percentage-only heights which break React Flow
      const explicitWidth = (style && style.width) || '100%';
      const explicitHeight = (style && style.height) || '600px'; // safe default height

      return {
        width: explicitWidth as any,
        height: explicitHeight as any,
        // No minHeight fallback needed if we set an explicit height
        ...style,
      };
    };

    // Loading state
    if (loading && !reactFlowData) {
      return <LoadingView className={className} containerStyle={getContainerStyle()} />;
    }

    // Error state
    if (error) {
      return (
        <ErrorView className={className} containerStyle={getContainerStyle()} message={error} />
      );
    }

    // No data state
    if (!reactFlowData) {
      return <EmptyView className={className} containerStyle={getContainerStyle()} />;
    }

    // Main ReactFlow render
    return (
      <StyleConfigProvider
        value={{
          edgeStyle: config.edgeStyle,
          edgeColor: config.edgeColor,
          edgeWidth: config.edgeWidth,
          edgeDashed: config.edgeDashed,
          nodeBorderRadius: config.nodeBorderRadius,
          nodePadding: config.nodePadding,
          nodeFontSize: config.nodeFontSize,
          containerBorderRadius: config.containerBorderRadius,
          containerBorderWidth: config.containerBorderWidth,
          containerShadow: config.containerShadow,
        }}
      >
        <div ref={containerRef} className={className} style={getContainerStyle()}>
          {/* Invisible SVG defs for edge filters/markers */}
          <GraphDefs />
          <ReactFlow
            nodes={(() => {
              // Sort nodes so clicked nodes are rendered last (on top)
              const nodes = reactFlowData?.nodes || [];
              // Apply search highlighting by setting flags on matching nodes/containers
              const matchSet = new Set(
                (Array.isArray(searchMatches) ? searchMatches : [])
                  .filter(m => m && (m.type === 'node' || m.type === 'container'))
                  .map(m => m.id)
              );
              const currentId = currentSearchMatchId;

              const styled = nodes.map(n => {
                const isMatch = matchSet.has(n.id);
                const isCurrent = currentId && n.id === currentId;
                if (!isMatch && !isCurrent) return n;

                // Attach flags; node components will render glow
                return {
                  ...n,
                  data: {
                    ...n.data,
                    searchHighlight: isMatch,
                    searchHighlightStrong: isCurrent,
                  },
                };
              });
              return styled.slice().sort((a, b) => {
                const aClicked = a.data?.isClicked ? 1 : 0;
                const bClicked = b.data?.isClicked ? 1 : 0;
                return aClicked - bClicked;
              });
            })()}
            edges={(() => {
              const edges = reactFlowData?.edges || [];
              // DISABLED: Edge highlighting during search causes confusion
              // Only highlight the actual nodes and containers, not their edges
              return edges;
            })()}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onNodesChange={onNodesChange}
            fitView={false}
            fitViewOptions={{
              padding: UI_CONSTANTS.FIT_VIEW_PADDING,
              maxZoom: UI_CONSTANTS.FIT_VIEW_MAX_ZOOM,
            }}
            attributionPosition="bottom-left"
            nodesDraggable={config.nodesDraggable !== false}
            nodesConnectable={config.nodesConnectable !== false}
            elementsSelectable={config.elementsSelectable !== false}
            panOnDrag={config.enablePan !== false}
            zoomOnScroll={config.enableZoom !== false}
            minZoom={0.1}
            maxZoom={UI_CONSTANTS.MAX_ZOOM}
          >
            <Background color="#ccc" />
            {config.enableControls !== false && (
              <CustomControls
                visualizationState={visualizationState}
                onCollapseAll={onCollapseAll}
                onExpandAll={onExpandAll}
                showPackUnpack={true}
                onFitView={onFitView || fitOnce}
                autoFit={autoFit}
                onAutoFitToggle={onAutoFitToggle}
                onLoadFile={onLoadFile}
                showLoadFile={showLoadFile}
                position="bottom-left"
                reactFlowControlsScale={reactFlowControlsScale}
              />
            )}
            {config.enableMiniMap !== false && (
              <MiniMap
                nodeColor="#666"
                nodeStrokeWidth={UI_CONSTANTS.MINIMAP_STROKE_WIDTH}
                position="bottom-right"
              />
            )}
          </ReactFlow>

          {/* Loading overlay during updates */}
          {loading && <UpdatingOverlay />}
        </div>
      </StyleConfigProvider>
    );
  }
);

FlowGraphInternal.displayName = 'FlowGraphInternal';

// Main FlowGraph component that provides ReactFlow context
export const FlowGraph = forwardRef<FlowGraphRef, FlowGraphProps>((props, ref) => {
  const flowGraphRef = useRef<FlowGraphRef>(null);

  // Expose fitView and refreshLayout methods through ref
  useImperativeHandle(ref, () => ({
    fitView: () => {
      if (flowGraphRef.current) {
        flowGraphRef.current.fitView();
      }
    },
    refreshLayout: async () => {
      if (flowGraphRef.current) {
        await flowGraphRef.current.refreshLayout();
      }
    },
  }));

  return (
    <ReactFlowProvider>
      <FlowGraphInternal ref={flowGraphRef} {...props} />
    </ReactFlowProvider>
  );
});

FlowGraph.displayName = 'FlowGraph';
