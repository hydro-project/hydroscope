import React, { useCallback, useRef, useState } from 'react';
import { Button } from 'antd';
import { ExpandOutlined, CompressOutlined, ReloadOutlined } from '@ant-design/icons';
import { Hydroscope, type HydroscopeProps, type HydroscopeRef } from './Hydroscope';
import type { VisualizationState } from '../core/VisualizationState';

export interface HydroscopeMiniProps extends Omit<HydroscopeProps, 'eventHandlers' | 'onParsed'> {
  // Feature toggles
  showControls?: boolean; // Show pack/unpack/refresh buttons (default: true)
  enableCollapse?: boolean; // Enable click-to-collapse (default: true)
  autoFit?: boolean; // Auto-fit after operations (default: true)
  // Sizing (optional)
  height?: number | string; // Explicit graph height (e.g., 600 or '60vh')
  width?: number | string; // Explicit graph width (default: '100%')
  defaultHeight?: number | string; // Fallback height when parent isn't sized (default: 600)
  innerStyle?: React.CSSProperties; // Optional style override for inner Hydroscope container

  // Callbacks for extensibility
  onNodeClick?: (event: any, node: any, visualizationState?: VisualizationState) => void;
  onContainerCollapse?: (containerId: string, visualizationState?: VisualizationState) => void;
  onContainerExpand?: (containerId: string, visualizationState?: VisualizationState) => void;
  onParsed?: (metadata: any, visualizationState: VisualizationState) => void;
}

/**
 * HydroscopeMini: Interactive graph component with built-in container collapse/expand.
 *
 * Features:
 * - Click containers to collapse/expand automatically
 * - Pack/Unpack all controls
 * - Auto-fit after operations
 * - Zero configuration required - just pass data
 *
 * This bridges the gap between basic HydroscopeCore (read-only) and Hydroscope (full UI).
 */
export function HydroscopeMini({
  showControls = true,
  enableCollapse = true,
  autoFit = true,
  height,
  width,
  defaultHeight = 600,
  innerStyle,
  onNodeClick,
  onContainerCollapse,
  onContainerExpand,
  onParsed,
  style,
  className,
  ...hydroscopeProps
}: HydroscopeMiniProps) {
  const [visualizationState, setVisualizationState] = useState<VisualizationState | null>(null);
  const [isLayoutRunning, setIsLayoutRunning] = useState(false);
  const hydroscopeRef = useRef<HydroscopeRef>(null);

  // Handle parsing to get access to visualization state
  const handleParsed = useCallback(
    (metadata: any, visState: VisualizationState) => {
      setVisualizationState(visState);
      onParsed?.(metadata, visState);
    },
    [onParsed]
  );

  // Default interactive node click handler
  const handleNodeClick = useCallback(
    async (event: any, node: any) => {
      if (!visualizationState) {
        console.warn('⚠️ No visualization state available for node click');
        return;
      }

      if (onNodeClick) {
        // User provided custom handler - use that instead
        onNodeClick(event, node, visualizationState);
        return;
      }

      // Check if this is a container first
      const container = visualizationState.getContainer(node.id);
      if (container && enableCollapse) {
        // Built-in container collapse/expand logic
        try {
          setIsLayoutRunning(true);

          if (container.collapsed) {
            visualizationState.expandContainer(node.id);
            onContainerExpand?.(node.id, visualizationState);
          } else {
            visualizationState.collapseContainer(node.id);
            visualizationState.collapseContainer(node.id);
            onContainerCollapse?.(node.id, visualizationState);
          }

          // Trigger layout refresh
          if (hydroscopeRef.current?.refreshLayout) {
            await hydroscopeRef.current.refreshLayout();
          }

          // Auto-fit after layout completes
          if (autoFit && hydroscopeRef.current?.fitView) {
            setTimeout(() => {
              hydroscopeRef.current?.fitView();
            }, 300);
          }
        } catch (err) {
          console.error('❌ Error toggling container:', err);
        } finally {
          setIsLayoutRunning(false);
        }
        return; // Exit early after handling container
      }

      // Handle regular graph node label toggle
      const graphNode = visualizationState.getGraphNode(node.id);

      if (
        graphNode &&
        graphNode.fullLabel &&
        graphNode.shortLabel &&
        graphNode.fullLabel !== graphNode.shortLabel
      ) {
        // Toggle between short and full label (only if they're actually different)
        const currentLabel = graphNode.label || graphNode.shortLabel;
        const isShowingShort = currentLabel === graphNode.shortLabel;
        const newLabel = isShowingShort ? graphNode.fullLabel : graphNode.shortLabel;

        // Update the node's label field
        visualizationState.updateNode(node.id, { label: newLabel });

        // Trigger a refresh to update the display
        try {
          if (hydroscopeRef.current?.refreshLayout) {
            // Use refreshLayout to force a re-conversion of the visualization state
            await hydroscopeRef.current.refreshLayout(false);
          }
        } catch (err) {
          console.error('❌ Error refreshing after label toggle:', err);
        }
      } else {
      }
    },
    [
      visualizationState,
      enableCollapse,
      autoFit,
      onNodeClick,
      onContainerCollapse,
      onContainerExpand,
    ]
  );

  // Pack all containers (collapse all)
  const handlePackAll = useCallback(async () => {
    if (!visualizationState) return;

    try {
      setIsLayoutRunning(true);

      // collapseAllContainers() already triggers layout internally via _resumeLayoutTriggers(true)
      // No need to call refreshLayout() afterwards as it would create duplicate layout operations
      visualizationState.collapseAllContainers();

      // Auto-fit after packing
      if (autoFit && hydroscopeRef.current?.fitView) {
        setTimeout(() => {
          hydroscopeRef.current?.fitView();
        }, 500);
      }
    } catch (err) {
      console.error('❌ Error packing containers:', err);
    } finally {
      setIsLayoutRunning(false);
    }
  }, [visualizationState, autoFit]);

  // Unpack all containers (expand all)
  const handleUnpackAll = useCallback(async () => {
    if (!visualizationState) return;

    try {
      setIsLayoutRunning(true);

      // expandAllContainers() already triggers layout internally via _resumeLayoutTriggers(true)
      // No need to call refreshLayout() afterwards as it would create duplicate layout operations
      visualizationState.expandAllContainers();

      // Auto-fit after unpacking
      if (autoFit && hydroscopeRef.current?.fitView) {
        setTimeout(() => {
          hydroscopeRef.current?.fitView();
        }, 500);
      }
    } catch (err) {
      console.error('❌ Error unpacking containers:', err);
    } finally {
      setIsLayoutRunning(false);
    }
  }, [visualizationState, autoFit]);

  // Refresh layout manually
  const handleRefresh = useCallback(async () => {
    if (!hydroscopeRef.current?.refreshLayout) return;

    try {
      setIsLayoutRunning(true);
      await hydroscopeRef.current.refreshLayout();
    } catch (err) {
      console.error('❌ Error refreshing layout:', err);
    } finally {
      setIsLayoutRunning(false);
    }
  }, []);

  // Helper to coerce numeric values into px strings
  const toCssSize = (v: number | string | undefined): string | undefined => {
    if (v === undefined) return undefined;
    if (typeof v === 'number') return `${v}px`;
    return v;
  };

  // Determine a robust graph height:
  // - If explicit height prop passed, use it
  // - Else if fillViewport, use viewport height minus controls (approx)
  // - Else use defaultHeight fallback to avoid percent-based sizing issues
  const resolvedGraphHeight: string = (() => {
    if (height !== undefined) return toCssSize(height)!;
    if ((hydroscopeProps as any)?.fillViewport) {
      // Approximate controls height as 48px when visible
      return showControls ? 'calc(100vh - 48px)' : '100vh';
    }
    return toCssSize(defaultHeight) || '600px';
  })();

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    width: toCssSize(width) || '100%',
    // Intentionally avoid height: '100%' so parent without explicit height doesn't break
    ...style,
  };

  const controlsStyle: React.CSSProperties = {
    padding: '8px',
    borderBottom: '1px solid #d9d9d9',
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  };

  // Use explicit height to satisfy React Flow container requirement
  const graphStyle: React.CSSProperties = {
    width: toCssSize(width) || '100%',
    height: resolvedGraphHeight,
    // Avoid relying on flex growth when parent height is unknown
    flex: '0 0 auto',
  };

  return (
    <div className={className} style={containerStyle}>
      {showControls && (
        <div style={controlsStyle}>
          <Button
            icon={<CompressOutlined />}
            onClick={handlePackAll}
            loading={isLayoutRunning}
            size="small"
            title="Collapse all containers"
            disabled={!visualizationState}
          >
            Pack All
          </Button>
          <Button
            icon={<ExpandOutlined />}
            onClick={handleUnpackAll}
            loading={isLayoutRunning}
            size="small"
            title="Expand all containers"
            disabled={!visualizationState}
          >
            Unpack All
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={isLayoutRunning}
            size="small"
            title="Refresh layout"
            disabled={!visualizationState}
          >
            Refresh
          </Button>
        </div>
      )}

      <div style={graphStyle}>
        <Hydroscope
          ref={hydroscopeRef}
          {...hydroscopeProps}
          // Ensure inner FlowGraph fills this container
          style={{ width: '100%', height: '100%', ...(innerStyle || {}) }}
          onParsed={handleParsed}
          eventHandlers={{
            onNodeClick: handleNodeClick,
          }}
        />
      </div>
    </div>
  );
}

export default HydroscopeMini;
