/**
 * HydroscopeEnhanced - Comprehensive graph visualization component
 * 
 * This component provides all the enhanced features specified in the requirements:
 * - Advanced file upload with drag-and-drop
 * - URL parameter data loading
 * - InfoPanel with search and container controls
 * - StyleTuner for real-time style configuration
 * - Error handling and recovery
 * - Responsive design
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ReactFlow, Background, Controls, MiniMap, useReactFlow, ControlButton, ReactFlowProvider, applyNodeChanges } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "./nodes/index.js";
import { edgeTypes } from "./edges/index.js";
import { StyleConfigProvider, useStyleConfig } from "../render/StyleConfigContext.js";
import { FileUpload } from "./FileUpload.js";
import { SearchIntegration } from "./SearchIntegration.js";
import { ContainerControls } from "./ContainerControls.js";

import { VisualizationState } from "../core/VisualizationState.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import { InteractionHandler } from "../core/InteractionHandler.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import type { HydroscopeData } from "../types/core.js";

// Utility functions for responsive design and optimization
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };

    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func(...args);
  };
};

// Dynamic height calculator with RAF-based debouncing
class OptimizedHeightCalculator {
  private rafId: number | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  private lastHeight: string = '100vh';
  private onHeightChange: (height: string) => void;
  private isDestroyed: boolean = false;

  constructor(onHeightChange: (height: string) => void) {
    this.onHeightChange = onHeightChange;
  }

  calculateHeight = (): void => {
    // Cancel pending calculations
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.timeoutId) clearTimeout(this.timeoutId);

    // Use RAF for smooth updates
    this.rafId = requestAnimationFrame(() => {
      // Debounce with timeout
      this.timeoutId = setTimeout(() => {
        // Check if calculator has been destroyed
        if (this.isDestroyed) return;

        try {
          const navbar = document.querySelector('.navbar');
          const navbarHeight = navbar?.getBoundingClientRect().height || 60;
          const newHeight = `calc(100vh - ${navbarHeight}px)`;

          if (newHeight !== this.lastHeight) {
            this.lastHeight = newHeight;
            this.onHeightChange(newHeight);
          }
        } catch (error) {
          console.warn('Height calculation failed, using fallback:', error);
          const fallbackHeight = 'calc(100vh - 60px)';
          if (fallbackHeight !== this.lastHeight && !this.isDestroyed) {
            this.lastHeight = fallbackHeight;
            this.onHeightChange(fallbackHeight);
          }
        }
      }, 150);
    });
  };

  cleanup = (): void => {
    this.isDestroyed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.rafId = null;
    this.timeoutId = null;
  };
}

// SVG Icons for CustomControls
const PackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 512 512" fill="currentColor">
    <path d="M48.68,170.67c30.01-3,69.24,1.26,99.98,1.2l-.47,44.47c-31.79-.64-85.93-5.15-91.45,31.65-8.5,56.73,5.61,129.95.95,188.29,4.46,11.9,12.64,21.32,26.06,26.84,108.97,7.41,220.75,1.13,330.73,3.21,20.07-2.42,37.72-16.78,40.27-34.05,8.32-56.31-6.25-127.27,0-185.09-11.77-36.93-54.69-30.94-90.5-30.85l-.47-45.27c31.13,1.64,69.66-3.56,99.98-.4,23.16,2.42,42.04,19.44,45.01,38.86-7.67,83.32,10.23,180.25,0,262.01-2.57,20.51-19.89,36.92-44.07,40.46H46.78c-26.2-4.46-41.74-21.6-44.07-43.67-8.55-81.04,6.41-172.67,0-254.8,1.08-21.27,20.53-40.32,45.96-42.87h.01Z" />
    <path d="M258.31,429.8c-.72.25-4.19.29-4.81,0-5.19-2.36-56.57-122.05-66.1-135.93-3.69-24.83,25.3-7.28,33.65-15.32V11.79c1.18-4.89,3.41-9.69,6.81-10.85,3.66-1.26,53.37-1.27,56.89,0,.82.3,4.76,4.33,5.21,5.75l.8,271.87c9.31,8.06,42.87-10.94,32.05,20.42-5.44,15.77-52.12,113.24-60.09,125.08-1.07,1.58-3.09,5.29-4.41,5.75v-.02Z" />
  </svg>
);

const UnpackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 512 512" fill="currentColor">
    <path d="M48.68,170.67c30.01-3,69.24,1.26,99.98,1.2l-.47,44.47c-31.79-.64-85.93-5.15-91.45,31.65-8.5,56.73,5.61,129.95.95,188.29,4.46,11.9,12.64,21.32,26.06,26.84,108.97,7.41,220.75,1.13,330.73,3.21,20.07-2.42,37.72-16.78,40.27-34.05,8.32-56.31-6.25-127.27,0-185.09-11.77-36.93-54.69-30.94-90.5-30.85l-.47-45.27c31.13,1.64,69.66-3.56,99.98-.4,23.16,2.42,42.04,19.44,45.01,38.86-7.67,83.32,10.23,180.25,0,262.01-2.57,20.51-19.89,36.92-44.07,40.46H46.78c-26.2-4.46-41.74-21.6-44.07-43.67-8.55-81.04,6.41-172.67,0-254.8,1.08-21.27,20.53-40.32,45.96-42.87h.01Z" />
    <path d="M253.7.2c.72-.25,4.19-.29,4.81,0,5.19,2.36,56.57,122.05,66.1,135.93,3.69,24.83-25.3,7.28-33.65,15.32v266.76c-1.18,4.89-3.41,9.69-6.81,10.85-3.66,1.26-53.37,1.27-56.89,0-.82-.3-4.76-4.33-5.21-5.75l-.8-271.87c-9.31-8.06-42.87,10.94-32.05-20.42,5.44-15.77,52.12-113.24,60.09-125.08,1.07-1.58,3.09-5.29,4.41-5.75v.02Z" />
  </svg>
);

const FitIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M5.828 10.172a.5.5 0 0 0-.707 0l-4.096 4.096V11.5a.5.5 0 0 0-1 0v3.975a.5.5 0 0 0 .5.5H4.5a.5.5 0 0 0 0-1H1.732l4.096-4.096a.5.5 0 0 0 0-.707zm4.344 0a.5.5 0 0 1 .707 0l4.096 4.096V11.5a.5.5 0 1 1 1 0v3.975a.5.5 0 0 1-.5.5H11.5a.5.5 0 0 1 0-1h2.768l-4.096-4.096a.5.5 0 0 1 0-.707zm0-4.344a.5.5 0 0 0 .707 0l4.096-4.096V4.5a.5.5 0 1 0 1 0V.525a.5.5 0 0 0-.5-.5H11.5a.5.5 0 0 0 0 1h2.768l-4.096 4.096a.5.5 0 0 0 0 .707zm-4.344 0a.5.5 0 0 1-.707 0L1.025 1.732V4.5a.5.5 0 0 1-1 0V.525a.5.5 0 0 1 .5-.5H4.5a.5.5 0 0 1 0 1H1.732l4.096 4.096a.5.5 0 0 1 0 .707z" strokeWidth="1.5" />
  </svg>
);

const AutoFitIcon = ({ enabled }: { enabled: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    {/* Mask definition for enabled state */}
    <defs>
      {/* Mask that defines the interior area of the corner bracket frame */}
      <mask id="frame-interior-mask">
        {/* White rectangle covers the entire area */}
        <rect x="0" y="0" width="16" height="16" fill="white" />
        {/* Black corner brackets cut out the frame areas */}
        <g transform="translate(-9, -0) scale(0.25)" fill="black">
          <path d="M99,55h-7s-1.1-11.9-1.1-11.9h-10.9c0-.1,0-7.1,0-7.1,15.5-1.8,20.8,3.5,19,19Z" />
          <path d="M99,75c1.2,15.5-3.6,20.1-19,18v-7s11.1-.4,11.1-.4l.9-10.6h7Z" />
          <path d="M55,36v7s-10,.5-10,.5c-3.3,1.6-1.6,8.4-2,11.5h-6c-1.6-15.9,1.5-20.7,18-19Z" />
          <path d="M43,75l1.1,10.9h10.9c0,.1,0,7.1,0,7.1-16,1.6-19.6-2-18-18h6Z" />
        </g>
      </mask>
    </defs>

    {/* Outer frame — scaled from 135×130 to 16×16 and vertically centered */}
    <g transform="translate(-10.5, -9.25) scale(0.275)" fill="currentColor">
      <path d="M99,55h-7s-1.1-11.9-1.1-11.9h-10.9c0-.1,0-7.1,0-7.1,15.5-1.8,20.8,3.5,19,19Z" />
      <path d="M99,75c1.2,15.5-3.6,20.1-19,18v-7s11.1-.4,11.1-.4l.9-10.6h7Z" />
      <path d="M55,36v7s-10,.5-10,.5c-3.3,1.6-1.6,8.4-2,11.5h-6c-1.6-15.9,1.5-20.7,18-19Z" />
      <path d="M43,75l1.1,10.9h10.9c0,.1,0,7.1,0,7.1-16,1.6-19.6-2-18-18h6Z" />
    </g>

    {/* Inner content - changes based on enabled state */}
    {enabled ? (
      // Enabled: 20% transparent black fill that matches the frame interior
      <>
        <rect
          x="0"
          y="0"
          width="16"
          height="16"
          fill="black"
          fillOpacity="0.2"
          mask="url(#frame-interior-mask)"
        />
        <g transform="translate(0.9, 1.1) scale(0.9)">
          <path
            d="M4 4l2 2M12 4l-2 2M4 12l2-2M12 12l-2-2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      </>
    ) : (
      <g transform="translate(0.9, 1.1) scale(0.9)">
        <path
          d="M4 4l2 2M12 4l-2 2M4 12l2-2M12 12l-2-2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
    )}
  </svg>
);


const LoadFileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9zM2.5 3a.5.5 0 0 0-.5.5V6h12v-.5a.5.5 0 0 0-.5-.5H9c-.964 0-1.71-.629-2.174-1.154C6.374 3.334 5.82 3 5.264 3H2.5zM14 7H2v5.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V7z" />
  </svg>
);

// CustomControls Component for v6 integration
interface CustomControlsProps {
  visualizationState?: VisualizationState | null;
  asyncCoordinator?: AsyncCoordinator | null;
  onCollapseAll?: () => void;
  onExpandAll?: () => void;
  autoFit?: boolean;
  onAutoFitToggle?: (enabled: boolean) => void;
  onLoadFile?: () => void;
  showLoadFile?: boolean;
  reactFlowControlsScale?: number;
  setReactFlowDataRef?: React.MutableRefObject<((data: { nodes: any[]; edges: any[] }) => void) | null>;
}

function CustomControls({
  visualizationState,
  asyncCoordinator,
  onCollapseAll,
  onExpandAll,
  autoFit = false,
  onAutoFitToggle,
  onLoadFile,
  showLoadFile = false,
  reactFlowControlsScale = 1.3,
  setReactFlowDataRef,
}: CustomControlsProps) {
  const standardControlsRef = useRef<HTMLDivElement>(null);
  const [standardControlsHeight, setStandardControlsHeight] = useState(40);

  // Check if there are any containers that can be collapsed/expanded
  const hasContainers = (visualizationState?.visibleContainers?.length ?? 0) > 0;
  const hasCollapsedContainers = visualizationState?.visibleContainers?.some(container => container.collapsed) ?? false;
  const hasExpandedContainers = visualizationState?.visibleContainers?.some(container => !container.collapsed) ?? false;

  // Calculate if we have any custom controls to show
  const hasCustomControls = hasContainers || onAutoFitToggle || showLoadFile;

  // Dynamically measure the standard controls height
  useEffect(() => {
    const updateHeight = () => {
      if (standardControlsRef.current) {
        const controlsContainer = standardControlsRef.current.querySelector('.react-flow__controls');
        const elementToMeasure = controlsContainer || standardControlsRef.current;
        const rect = elementToMeasure.getBoundingClientRect();
        const baseHeight = rect.height;

        if (baseHeight > 0 && baseHeight < 200) {
          setStandardControlsHeight(baseHeight);
        }
      }
    };

    const timeoutId = setTimeout(updateHeight, 100);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateHeight();
      });

      if (standardControlsRef.current) {
        resizeObserver.observe(standardControlsRef.current);
      }
    }

    return () => {
      clearTimeout(timeoutId);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [hasCustomControls, reactFlowControlsScale]);

  // Handle pack/unpack operations through v6 AsyncCoordinator
  const handleCollapseAll = useCallback(async () => {
    console.log('🔍 Collapse All clicked:', {
      hasAsyncCoordinator: !!asyncCoordinator,
      hasVisualizationState: !!visualizationState,
      hasExpandedContainers,
      visibleContainers: visualizationState?.visibleContainers?.length || 0
    });

    if (!asyncCoordinator || !visualizationState || !hasExpandedContainers) {
      console.log('❌ Collapse All: Early return due to missing requirements');
      return;
    }

    try {
      console.log('🔄 Calling asyncCoordinator.collapseAllContainers...');
      await asyncCoordinator.collapseAllContainers(visualizationState, {
        triggerLayout: true,
      });
      console.log('✅ Collapse All completed successfully');

      // Trigger layout recalculation and update ReactFlow data after collapse
      if (setReactFlowDataRef && setReactFlowDataRef.current) {
        console.log('🔄 Triggering layout recalculation after collapse...');

        // Debug: Check container states before layout
        const containers = visualizationState.visibleContainers;
        console.log('📊 Container states before layout:', containers.map(c => ({
          id: c.id,
          collapsed: c.collapsed,
          children: c.children.size,
          position: c.position,
          dimensions: c.dimensions
        })));

        const elkBridge = new ELKBridge({});
        await elkBridge.layout(visualizationState);
        console.log('✅ Layout recalculated');

        // Debug: Check container states after layout
        console.log('📊 Container states after layout:', containers.map(c => ({
          id: c.id,
          collapsed: c.collapsed,
          children: c.children.size,
          position: c.position,
          dimensions: c.dimensions
        })));

        console.log('🔄 Updating ReactFlow data after collapse...');
        const reactFlowBridge = new ReactFlowBridge({
          nodeStyles: {},
          edgeStyles: {},
          semanticMappings: {},
          propertyMappings: {}
        });
        const updatedFlowData = reactFlowBridge.toReactFlowData(visualizationState);

        // Debug: Check ReactFlow node positions
        console.log('📊 ReactFlow node positions:');
        updatedFlowData.nodes.forEach(n => {
          console.log(`  ${n.id}: position=(${n.position.x}, ${n.position.y}) type=${n.type} collapsed=${n.data.collapsed}`);
        });

        // Debug: Check ReactFlow edge connections
        console.log('📊 ReactFlow edge connections:');
        updatedFlowData.edges.forEach(e => {
          console.log(`  ${e.id}: ${e.source} -> ${e.target} aggregated=${e.data?.aggregated}`);
        });

        setReactFlowDataRef.current(updatedFlowData);
        console.log('✅ ReactFlow data updated:', { nodes: updatedFlowData.nodes.length, edges: updatedFlowData.edges.length });
      }

      onCollapseAll?.();
    } catch (error) {
      console.error('❌ Error collapsing all containers:', error);
    }
  }, [asyncCoordinator, visualizationState, hasExpandedContainers, onCollapseAll]);

  const handleExpandAll = useCallback(async () => {
    if (!asyncCoordinator || !visualizationState || !hasCollapsedContainers) return;

    try {
      console.log('🔄 Calling asyncCoordinator.expandAllContainers...');
      await asyncCoordinator.expandAllContainers(visualizationState, {
        triggerLayout: true,
      });
      console.log('✅ Expand All completed successfully');

      // Trigger layout recalculation and update ReactFlow data after expand
      if (setReactFlowDataRef && setReactFlowDataRef.current) {
        console.log('🔄 Triggering layout recalculation after expand...');
        const elkBridge = new ELKBridge({});
        await elkBridge.layout(visualizationState);
        console.log('✅ Layout recalculated');

        console.log('🔄 Updating ReactFlow data after expand...');
        const reactFlowBridge = new ReactFlowBridge({
          nodeStyles: {},
          edgeStyles: {},
          semanticMappings: {},
          propertyMappings: {}
        });
        const updatedFlowData = reactFlowBridge.toReactFlowData(visualizationState);
        setReactFlowDataRef.current(updatedFlowData);
        console.log('✅ ReactFlow data updated:', { nodes: updatedFlowData.nodes.length, edges: updatedFlowData.edges.length });
      }

      onExpandAll?.();
    } catch (error) {
      console.error('❌ Error expanding all containers:', error);
    }
  }, [asyncCoordinator, visualizationState, hasCollapsedContainers, onExpandAll]);

  return (
    <>
      {/* Custom Controls - positioned dynamically above standard controls */}
      {hasCustomControls && (
        <div
          style={{
            position: 'absolute',
            bottom: `${standardControlsHeight}px`,
            left: '0px',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            borderRadius: '6px',
            backgroundColor: 'white',
          }}
        >
          <Controls
            showZoom={false}
            showFitView={false}
            showInteractive={false}
            style={{
              transform: `scale(${reactFlowControlsScale})`,
              transformOrigin: 'left bottom',
              borderRadius: '6px',
            }}
          >
            {/* Auto Fit Toggle Button */}
            {onAutoFitToggle && (
              <ControlButton
                onClick={() => onAutoFitToggle(!autoFit)}
                title={
                  autoFit
                    ? 'Auto-fit enabled: Automatically fits view after layout changes'
                    : 'Auto-fit disabled: Click to enable automatic view fitting'
                }
                style={{
                  backgroundColor: autoFit ? 'rgba(59, 130, 246, 0.1)' : undefined,
                  borderColor: autoFit ? '#3b82f6' : undefined,
                }}
              >
                <AutoFitIcon enabled={autoFit} />
              </ControlButton>
            )}

            {/* Load File Button */}
            {showLoadFile && onLoadFile && (
              <ControlButton onClick={onLoadFile} title="Load another file">
                <LoadFileIcon />
              </ControlButton>
            )}

            {/* Pack All (Collapse All) Button */}
            {hasContainers && (
              <ControlButton
                onClick={handleCollapseAll}
                disabled={!hasExpandedContainers}
                title={
                  !hasExpandedContainers
                    ? 'No containers to collapse'
                    : 'Collapse All Containers'
                }
              >
                <PackIcon />
              </ControlButton>
            )}

            {/* Unpack All (Expand All) Button */}
            {hasContainers && (
              <ControlButton
                onClick={handleExpandAll}
                disabled={!hasCollapsedContainers}
                title={
                  !hasCollapsedContainers
                    ? 'No containers to expand'
                    : 'Expand All Containers'
                }
              >
                <UnpackIcon />
              </ControlButton>
            )}
          </Controls>
        </div>
      )}

      {/* Standard ReactFlow Controls - at the bottom */}
      <div ref={standardControlsRef}>
        <Controls
          position="bottom-left"
          style={{
            transform: `scale(${reactFlowControlsScale})`,
            transformOrigin: 'left bottom',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            borderRadius: '6px',
          }}
        />
      </div>
    </>
  );
}

export interface HydroscopeEnhancedProps {
  /** JSON data to visualize (optional) */
  data?: HydroscopeData;
  /** Height of the visualization container */
  height?: string | number;
  /** Width of the visualization container */
  width?: string | number;
  /** Whether to show controls */
  showControls?: boolean;
  /** Whether to show minimap */
  showMiniMap?: boolean;
  /** Whether to show background pattern */
  showBackground?: boolean;
  /** Enable enhanced features (InfoPanel, StyleTuner, etc.) */
  enhanced?: boolean;
  /** Enable responsive height calculation */
  responsive?: boolean;
  /** Enable URL parameter parsing for data loading */
  enableUrlParams?: boolean;
}

// InfoPanel Component
interface InfoPanelProps {
  visualizationState: VisualizationState | null;
  reactFlowData: { nodes: any[]; edges: any[] };
  onSearchResultSelect: (result: any) => void;
  onContainerOperation: (operation: string, containerId?: string) => void;
  onError: (error: Error) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function InfoPanel({
  visualizationState,
  reactFlowData,
  onSearchResultSelect,
  onContainerOperation,
  onError,
  open,
  onOpenChange
}: InfoPanelProps) {
  if (!open) {
    return null; // Don't render toggle button - handled by parent
  }

  return (
    <div style={{
      position: 'fixed',
      top: '0',
      right: '0',
      width: '350px',
      height: '100vh',
      backgroundColor: 'white',
      borderLeft: '1px solid #e0e0e0',
      boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#f9f9f9',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          Graph Info
        </h3>
        <button
          onClick={() => onOpenChange(false)}
          style={{
            padding: '4px 8px',
            backgroundColor: 'transparent',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px'
      }}>
        {visualizationState ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Search Section */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
                Search
              </h4>
              <SearchIntegration
                visualizationState={visualizationState}
                onSearchResultSelect={onSearchResultSelect}
                placeholder="Search nodes and containers..."
                maxResults={50}
                groupByType={true}
                showResultsPanel={true}
              />
            </div>

            {/* Container Controls Section */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
                Container Controls
              </h4>
              {/* Container Controls - simplified for now */}
              <div style={{ fontSize: '14px', color: '#666' }}>
                Container controls will be available when AsyncCoordinator is integrated
              </div>
            </div>

            {/* Graph Statistics */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
                Statistics
              </h4>
              <div style={{ fontSize: '14px', color: '#666' }}>
                <div>Nodes: {reactFlowData.nodes.length}</div>
                <div>Edges: {reactFlowData.edges.length}</div>
                <div>Containers: {visualizationState.visibleContainers?.length || 0}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            color: '#666',
            fontSize: '14px',
            padding: '20px'
          }}>
            Load graph data to see info panel content
          </div>
        )}
      </div>
    </div>
  );
}

// StyleTuner Component
interface StyleTunerProps {
  value: any;
  onChange: (config: any) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function StyleTuner({
  value,
  onChange,
  open,
  onOpenChange
}: StyleTunerProps) {
  if (!open) {
    return null; // Don't render toggle button - handled by parent
  }

  return (
    <div style={{
      position: 'fixed',
      top: '0',
      left: '0',
      width: '320px',
      height: '100vh',
      backgroundColor: 'white',
      borderRight: '1px solid #e0e0e0',
      boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#f9f9f9',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          Style Tuner
        </h3>
        <button
          onClick={() => onOpenChange(false)}
          style={{
            padding: '4px 8px',
            backgroundColor: 'transparent',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Edge Styles */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
              Edge Styles
            </h4>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                Edge Type
              </label>
              <select
                value={value.edgeStyle}
                onChange={(e) => onChange({ ...value, edgeStyle: e.target.value })}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="bezier">Bezier Curves</option>
                <option value="straight">Straight Lines</option>
                <option value="smoothstep">Smooth Steps</option>
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                Edge Color
              </label>
              <input
                type="color"
                value={value.edgeColor}
                onChange={(e) => onChange({ ...value, edgeColor: e.target.value })}
                style={{
                  width: '100%',
                  height: '32px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                Edge Width: {value.edgeWidth}px
              </label>
              <input
                type="range"
                min="1"
                max="8"
                value={value.edgeWidth}
                onChange={(e) => onChange({ ...value, edgeWidth: parseInt(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Node Styles */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
              Node Styles
            </h4>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                Border Radius: {value.nodeBorderRadius}px
              </label>
              <input
                type="range"
                min="0"
                max="20"
                value={value.nodeBorderRadius}
                onChange={(e) => onChange({ ...value, nodeBorderRadius: parseInt(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                Font Size: {value.nodeFontSize}px
              </label>
              <input
                type="range"
                min="8"
                max="20"
                value={value.nodeFontSize}
                onChange={(e) => onChange({ ...value, nodeFontSize: parseInt(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Reset Button */}
          <div>
            <button
              onClick={() => onChange({
                edgeStyle: 'bezier',
                edgeColor: '#1976d2',
                edgeWidth: 2,
                nodeBorderRadius: 4,
                nodeFontSize: 12,
                containerBorderRadius: 8,
                containerBorderWidth: 2,
                containerShadow: 'LIGHT'
              })}
              style={{
                width: '100%',
                padding: '8px 16px',
                backgroundColor: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Internal component that uses ReactFlow hooks
const HydroscopeEnhancedInternal: React.FC<HydroscopeEnhancedProps> = ({
  data,
  height = 600,
  width = "100%",
  showControls = true,
  showMiniMap = true,
  showBackground = true,
  enhanced = true,
  responsive = false,
  enableUrlParams = false,
}) => {
  console.log('🔍 HydroscopeEnhancedInternal props:', { enhanced, enableUrlParams, hasData: !!data });

  // Ref for setReactFlowData to use in handlers (will be set after state is defined)
  const setReactFlowDataRef = useRef<((data: { nodes: any[]; edges: any[] }) => void) | null>(null);

  const [visualizationState, setVisualizationState] = useState<VisualizationState | null>(null);
  const [asyncCoordinator, setAsyncCoordinator] = useState<AsyncCoordinator | null>(null);
  const [reactFlowData, setReactFlowData] = useState<{
    nodes: any[];
    edges: any[];
  }>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<HydroscopeData | null>(data || null);

  // Update the ref with the actual setReactFlowData function
  useEffect(() => {
    setReactFlowDataRef.current = setReactFlowData;
  }, [setReactFlowData]);

  // Minimal page state for UI visibility (Requirements 5.4, 11.1)
  const [pageState, setPageState] = useState({
    showInfoPanel: false,
    showStyleTuner: false,
    autoFit: false,
  });

  // Debug: Log graphData changes
  useEffect(() => {
    console.log('🔍 graphData changed:', graphData ? 'HAS DATA' : 'NULL');
    if (graphData) {
      console.log('   - Nodes:', graphData.nodes?.length || 0);
      console.log('   - Toggle buttons should render:', enhanced && !!graphData);
    }
  }, [graphData, enhanced]);

  // Style configuration state
  const [styleConfig, setStyleConfig] = useState({
    edgeStyle: 'bezier' as const,
    edgeColor: '#1976d2',
    edgeWidth: 2,
    nodeBorderRadius: 4,
    nodeFontSize: 12,
    containerBorderRadius: 8,
    containerBorderWidth: 2,
    containerShadow: 'LIGHT' as const,
    reactFlowControlsScale: 1.3
  });

  // Responsive design state
  const [dynamicHeight, setDynamicHeight] = useState<string>(
    typeof height === 'string' ? height : `${height}px`
  );
  const [isResizing, setIsResizing] = useState(false);

  // Refs for proper cleanup and memory management (Requirements 5.5, 11.2)
  const interactionHandlerRef = useRef<InteractionHandler | null>(null);
  const heightCalculatorRef = useRef<OptimizedHeightCalculator | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const cleanupFunctionsRef = useRef<Array<() => void>>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutIdsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const animationFrameIdsRef = useRef<Set<number>>(new Set());
  const reactFlowInstance = useReactFlow();

  // Page state update helpers (Requirements 5.4, 11.1)
  const updatePageState = useCallback((updates: Partial<typeof pageState>) => {
    setPageState(prev => ({ ...prev, ...updates }));
  }, []);

  const toggleInfoPanel = useCallback(() => {
    updatePageState({ showInfoPanel: !pageState.showInfoPanel });
  }, [pageState.showInfoPanel, updatePageState]);

  const toggleStyleTuner = useCallback(() => {
    updatePageState({ showStyleTuner: !pageState.showStyleTuner });
  }, [pageState.showStyleTuner, updatePageState]);

  const toggleAutoFit = useCallback((enabled?: boolean) => {
    const newAutoFit = enabled !== undefined ? enabled : !pageState.autoFit;
    updatePageState({ autoFit: newAutoFit });
  }, [pageState.autoFit, updatePageState]);

  // Enhanced timeout and animation frame management (Requirements 5.5, 11.2)
  const managedSetTimeout = useCallback((callback: () => void, delay: number): NodeJS.Timeout => {
    const timeoutId = setTimeout(() => {
      timeoutIdsRef.current.delete(timeoutId);
      callback();
    }, delay);
    timeoutIdsRef.current.add(timeoutId);
    return timeoutId;
  }, []);

  const managedRequestAnimationFrame = useCallback((callback: FrameRequestCallback): number => {
    const frameId = requestAnimationFrame((time) => {
      animationFrameIdsRef.current.delete(frameId);
      callback(time);
    });
    animationFrameIdsRef.current.add(frameId);
    return frameId;
  }, []);

  // Responsive height calculation with enhanced cleanup (Requirements 5.5, 11.2)
  useEffect(() => {
    if (!responsive) {
      // Reset to static height when responsive is disabled
      setDynamicHeight(typeof height === 'string' ? height : `${height}px`);
      return;
    }

    const handleHeightChange = (newHeight: string) => {
      setDynamicHeight(newHeight);
    };

    // Initialize height calculator
    heightCalculatorRef.current = new OptimizedHeightCalculator(handleHeightChange);

    // Initial calculation
    heightCalculatorRef.current.calculateHeight();

    // Set up resize listener with debouncing
    const debouncedResize = debounce(() => {
      setIsResizing(true);
      heightCalculatorRef.current?.calculateHeight();
      // Clear resizing flag after animation with managed timeout
      managedSetTimeout(() => setIsResizing(false), 300);
    }, 100);

    window.addEventListener('resize', debouncedResize);
    cleanupFunctionsRef.current.push(() => {
      window.removeEventListener('resize', debouncedResize);
    });

    // Set up ResizeObserver for navbar changes
    if (typeof ResizeObserver !== 'undefined') {
      const navbar = document.querySelector('.navbar');
      if (navbar) {
        resizeObserverRef.current = new ResizeObserver(
          debounce(() => {
            heightCalculatorRef.current?.calculateHeight();
          }, 150)
        );
        resizeObserverRef.current.observe(navbar);
        cleanupFunctionsRef.current.push(() => {
          resizeObserverRef.current?.disconnect();
        });
      }
    }

    return () => {
      heightCalculatorRef.current?.cleanup();
    };
  }, [responsive, height, managedSetTimeout]);

  // URL parameter parsing with async operation cancellation (Requirements 5.5, 11.2)
  useEffect(() => {
    console.log('🔍 URL parsing useEffect running:', { enableUrlParams, graphData: !!graphData });
    if (!enableUrlParams || graphData) {
      console.log('🔍 URL parsing skipped:', { enableUrlParams, hasGraphData: !!graphData });
      return;
    }

    // Create AbortController for this effect
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const parseUrlData = async () => {
      try {
        // Check if operation was cancelled
        if (abortController.signal.aborted) return;
        const urlParams = new URLSearchParams(window.location.search);

        // Check for uncompressed data parameter
        const dataParam = urlParams.get('data');
        if (dataParam) {
          try {
            console.log('🔄 Parsing URL data parameter...');
            const decodedData = decodeURIComponent(dataParam);
            const parsedData = JSON.parse(decodedData);
            console.log('✅ URL data parsed successfully, setting graphData:', parsedData);
            setGraphData(parsedData);
            return;
          } catch (error) {
            console.error('Failed to parse data parameter:', error);
            setError('Invalid data parameter in URL');
            return;
          }
        }

        // Check for compressed data parameter
        const compressedParam = urlParams.get('compressed');
        if (compressedParam) {
          try {
            // Try to use Hydroscope's parseDataFromUrl if available
            if (typeof window !== 'undefined' && (window as any).parseDataFromUrl) {
              const parsedData = await (window as any).parseDataFromUrl(compressedParam);
              setGraphData(parsedData);
              return;
            } else {
              // Fallback: try basic decompression
              const decodedData = atob(compressedParam);
              const parsedData = JSON.parse(decodedData);
              setGraphData(parsedData);
              return;
            }
          } catch (error) {
            console.error('Failed to parse compressed parameter:', error);
            setError('Invalid compressed data parameter in URL');
            return;
          }
        }

        // Check for file parameter (display only)
        const fileParam = urlParams.get('file');
        if (fileParam) {
          console.log('File parameter detected:', fileParam);
          // File parameter is for reference only, don't load data
        }
      } catch (error) {
        // Only set error if operation wasn't cancelled
        if (!abortController.signal.aborted) {
          console.error('Error parsing URL parameters:', error);
          setError('Failed to parse URL parameters');
        }
      }
    };

    parseUrlData();

    // Cleanup function for URL parameter parsing
    return () => {
      abortController.abort();
    };
  }, [enableUrlParams, graphData]);

  // Track initialization to prevent double runs
  const initializationRef = useRef<{ completed: boolean; inProgress: boolean }>({
    completed: false,
    inProgress: false
  });

  // Set loading to false when there's no data to show FileUpload
  useEffect(() => {
    if (!graphData) {
      setLoading(false);
      return;
    }
  }, [graphData]);

  // Initialize the visualization
  useEffect(() => {
    // Only run when we have data
    if (!graphData) return;

    // Allow re-initialization when data changes - only prevent if currently in progress
    if (initializationRef.current.inProgress) {
      console.log('🔍 Skipping visualization init - already in progress');
      return;
    }

    console.log('🔍 Visualization init useEffect running:', { hasGraphData: !!graphData });
    initializationRef.current.inProgress = true;

    const initializeVisualization = async () => {
      try {
        console.log('🔄 Starting visualization initialization...');
        setLoading(true);
        setError(null);

        const dataToUse = graphData;

        if (!dataToUse) {
          console.log('🔍 No data to use, skipping initialization');
          setLoading(false);
          return;
        }

        console.log('🔄 Parsing data with JSONParser...');
        // Parse the data
        const parser = JSONParser.createPaxosParser({ debug: false });
        const parseResult = await parser.parseData(dataToUse);
        const state = parseResult.visualizationState;
        console.log('✅ Data parsed successfully, state created');

        // Create AsyncCoordinator for v6 operations
        const coordinator = new AsyncCoordinator();

        // Set up bridges with default configs
        const elkBridge = new ELKBridge({});
        const reactFlowBridge = new ReactFlowBridge({
          nodeStyles: {},
          edgeStyles: {},
          semanticMappings: {},
          propertyMappings: {}
        });

        // Perform layout using real ELK calculation
        await elkBridge.layout(state);

        // Convert to ReactFlow format
        const flowData = reactFlowBridge.toReactFlowData(state);

        // Debug: Check edge handles
        console.log('🔍 [DEBUG] ReactFlow data after conversion:');
        console.log(`  - Nodes: ${flowData.nodes.length}`);
        console.log(`  - Edges: ${flowData.edges.length}`);

        const edgesWithHandles = flowData.edges.filter(e => e.sourceHandle && e.targetHandle);
        const edgesWithoutHandles = flowData.edges.filter(e => !e.sourceHandle || !e.targetHandle);

        console.log(`  - Edges with handles: ${edgesWithHandles.length}`);
        console.log(`  - Edges without handles: ${edgesWithoutHandles.length}`);

        if (edgesWithoutHandles.length > 0) {
          console.log('❌ Edges without handles:', edgesWithoutHandles.slice(0, 3).map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle
          })));
        }

        if (edgesWithHandles.length > 0) {
          console.log('✅ Example edges with handles:', edgesWithHandles.slice(0, 3).map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle
          })));
        }

        // Set up interaction handler
        const interactionHandler = new InteractionHandler(state);
        interactionHandlerRef.current = interactionHandler;

        // Update state
        console.log('✅ Setting visualization state and ReactFlow data...');
        console.log('   ReactFlow data:', { nodes: flowData.nodes.length, edges: flowData.edges.length });
        setVisualizationState(state);
        setAsyncCoordinator(coordinator);
        setReactFlowData(flowData);
        setLoading(false);
        initializationRef.current.completed = true;
        initializationRef.current.inProgress = false;
        console.log('✅ Visualization initialization complete!');
      } catch (err) {
        console.error("❌ Failed to initialize Hydroscope:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        setLoading(false);
        initializationRef.current.inProgress = false;
        // Don't set completed to true on error, allow retry
      }
    };

    initializeVisualization();
  }, [graphData]);



  // Prevent double initialization
  const [isInitialized, setIsInitialized] = useState(false);

  // Enhanced cleanup effect with comprehensive memory management (Requirements 5.5, 11.2, 11.5)
  useEffect(() => {
    return () => {
      console.log('🧹 Starting HydroscopeEnhanced cleanup...');

      // Cancel all pending async operations
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Clear all managed timeouts
      timeoutIdsRef.current.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      timeoutIdsRef.current.clear();

      // Cancel all managed animation frames
      animationFrameIdsRef.current.forEach(frameId => {
        cancelAnimationFrame(frameId);
      });
      animationFrameIdsRef.current.clear();

      // Clean up height calculator
      if (heightCalculatorRef.current) {
        heightCalculatorRef.current.cleanup();
        heightCalculatorRef.current = null;
      }

      // Clean up resize observer
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      // Run all registered cleanup functions
      cleanupFunctionsRef.current.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.warn('Cleanup function failed:', error);
        }
      });

      // Clear cleanup functions array
      cleanupFunctionsRef.current = [];

      // Clean up interaction handler
      if (interactionHandlerRef.current) {
        interactionHandlerRef.current = null;
      }

      // Reset page state to defaults
      setPageState({
        showInfoPanel: false,
        showStyleTuner: false,
        autoFit: false,
      });

      console.log('🧹 HydroscopeEnhanced cleanup completed');
    };
  }, []);

  // Debounced file processing with managed timeouts (Requirements 5.5, 11.2)
  const debouncedFileProcess = useCallback(
    debounce(async (data: HydroscopeData, filename: string) => {
      try {
        console.log('✅ Processing file:', filename);
        setLoading(true);
        setError(null);

        // Add small delay to show loading state using managed timeout
        await new Promise(resolve => {
          managedSetTimeout(() => resolve(undefined), 100);
        });

        setGraphData(data);
      } catch (error) {
        console.error('❌ File processing error:', error);
        setError(`Failed to process ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    }, 300),
    [managedSetTimeout]
  );

  // Handle file upload
  const handleFileLoaded = useCallback((data: HydroscopeData, filename: string) => {
    // Reset initialization state to allow re-initialization with new data
    initializationRef.current.completed = false;
    initializationRef.current.inProgress = false;

    // Clear existing state to force complete re-initialization
    setVisualizationState(null);
    setAsyncCoordinator(null);
    setReactFlowData({ nodes: [], edges: [] });

    // Create a new object reference to ensure React detects the change
    const newData = { ...data, _timestamp: Date.now() };

    // Set the new data directly instead of using debounced function
    setGraphData(newData);
    setLoading(true);
    setError(null);
  }, []);

  const handleFileError = useCallback((error: any, filename: string) => {
    console.error('❌ File error:', error, filename);
    setError(`Failed to load ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    setLoading(false);
  }, []);

  // Debounced style change handler
  const debouncedStyleChange = useCallback(
    debounce((newConfig: any) => {
      setStyleConfig(newConfig);
      // Let v6 AsyncCoordinator handle style updates automatically
      // No manual intervention needed - v6 handles operation sequencing
    }, 150),
    []
  );

  // Handle fit view
  const handleFitView = useCallback(() => {
    try {
      // Allow much more zoom-out for large expanded graphs
      // minZoom: 0.05 allows zooming out to 5% (20x zoom out)
      // maxZoom: 2.0 allows zooming in to 200%
      // This gives a much wider range to accommodate large graphs
      reactFlowInstance.fitView({
        padding: 0.1,
        minZoom: 0.05,
        maxZoom: 2.0,
        duration: 300
      });
    } catch (error) {
      console.error('Error fitting view:', error);
    }
  }, [reactFlowInstance]);

  // Handle auto-fit toggle
  const handleAutoFitToggle = useCallback((enabled: boolean) => {
    toggleAutoFit(enabled);
    if (enabled) {
      handleFitView();
    }
  }, [handleFitView, toggleAutoFit]);

  // Handle load file (trigger file input)
  const handleLoadFile = useCallback(() => {
    // Create a hidden file input and trigger it
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target?.result as string);
            handleFileLoaded(data, file.name);
          } catch (error) {
            handleFileError(error, file.name);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, [handleFileLoaded, handleFileError]);

  // Auto-fit effect when layout changes with managed timeouts (Requirements 5.5, 11.2)
  useEffect(() => {
    if (pageState.autoFit && reactFlowData.nodes.length > 0) {
      // Delay to ensure layout is complete using managed timeout
      const timeoutId = managedSetTimeout(() => {
        handleFitView();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [pageState.autoFit, reactFlowData, handleFitView, managedSetTimeout]);

  // Handle node/edge clicks
  const handleNodeClick = async (event: React.MouseEvent, node: any) => {
    if (!visualizationState || !interactionHandlerRef.current) return;

    try {
      // Handle container expand/collapse - check data.nodeType instead of node.type
      if (node.data?.nodeType === "container") {
        const container = visualizationState.getContainer(node.id);
        if (container) {
          if (container.collapsed) {
            visualizationState.expandContainer(node.id);
          } else {
            visualizationState.collapseContainer(node.id);
          }

          // Update ReactFlow data
          const elkBridge = new ELKBridge({});
          const reactFlowBridge = new ReactFlowBridge({
            nodeStyles: {},
            edgeStyles: {},
            semanticMappings: {},
            propertyMappings: {}
          });

          try {
            await elkBridge.layout(visualizationState);
            const flowData = reactFlowBridge.toReactFlowData(visualizationState);
            setReactFlowData(flowData);
          } catch (err) {
            console.error("Error updating layout:", err);
          }
        }
      }
      // Handle node label toggle - check if it's NOT a container
      else if (node.data?.nodeType !== "container") {
        const graphNode = visualizationState.getGraphNode(node.id);
        if (graphNode) {
          visualizationState.toggleNodeLabel(node.id);

          // Update ReactFlow data
          const reactFlowBridge = new ReactFlowBridge({
            nodeStyles: {},
            edgeStyles: {},
            semanticMappings: {},
            propertyMappings: {}
          });
          const flowData = reactFlowBridge.toReactFlowData(visualizationState);
          setReactFlowData(flowData);
        }
      }
    } catch (err) {
      console.error("Error handling node click:", err);
    }
  };

  // Handle node drag events
  const handleNodesChange = useCallback((changes: any[]) => {
    if (!visualizationState || !reactFlowData) return;

    try {
      // Apply changes to ReactFlow nodes for immediate visual feedback
      const updatedNodes = applyNodeChanges(changes, reactFlowData.nodes);

      // Update ReactFlow data with the new node positions
      setReactFlowData({
        nodes: updatedNodes,
        edges: reactFlowData.edges
      });

      // Also update visualization state for final positions (when drag is complete)
      const finalPositionChanges = changes.filter(change =>
        change.type === 'position' && change.dragging === false && change.position
      );

      if (finalPositionChanges.length > 0) {
        finalPositionChanges.forEach(change => {
          const { id, position } = change;

          // Check if it's a container
          const container = visualizationState.getContainer(id);
          if (container) {
            container.position = position;
            console.log(`Updated container ${id} position to (${position.x}, ${position.y})`);
          } else {
            // Check if it's a node
            const node = visualizationState.getGraphNode(id);
            if (node) {
              node.position = position;
              console.log(`Updated node ${id} position to (${position.x}, ${position.y})`);
            }
          }
        });

        console.log('Drag completed, positions saved to visualization state');
      }

    } catch (err) {
      console.error("Error handling node drag:", err);
    }
  }, [visualizationState, reactFlowData]);

  if (loading) {
    return (
      <div className="hydroscope-loading" style={{ height, width, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading Hydroscope visualization...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hydroscope-error" style={{ height, width, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#d32f2f' }}>
          <div>Error loading visualization: {error}</div>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
            }}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Calculate final height
  const finalHeight = responsive ? dynamicHeight : (typeof height === 'string' ? height : `${height}px`);

  return (
    <StyleConfigProvider value={styleConfig}>
      <div
        className="hydroscope-enhanced"
        style={{
          height: finalHeight,
          width,
          position: 'relative',
          transition: isResizing ? 'none' : 'height 0.3s ease',
          overflow: 'hidden'
        }}
      >
        {/* File Upload Landing Page (when no data) */}
        {!graphData && enhanced && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50
          }}>
            <FileUpload
              onFileLoaded={handleFileLoaded}
              onParseError={handleFileError}
              onValidationError={handleFileError}
              acceptedTypes={['.json']}
              maxFileSize={100 * 1024 * 1024} // 100MB
              showDetailedErrors={true}
            />
          </div>
        )}

        {/* Main Visualization */}
        <ReactFlow
          nodes={reactFlowData.nodes}
          edges={reactFlowData.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={handleNodeClick}
          onNodesChange={handleNodesChange}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          fitView
          minZoom={0.05}
          maxZoom={2.0}
          attributionPosition="bottom-left"
        >
          {showBackground && <Background />}
          {showControls && (
            <CustomControls
              visualizationState={visualizationState}
              asyncCoordinator={asyncCoordinator}
              autoFit={pageState.autoFit}
              onAutoFitToggle={toggleAutoFit}
              onLoadFile={handleLoadFile}
              showLoadFile={true}
              reactFlowControlsScale={styleConfig.reactFlowControlsScale}
              setReactFlowDataRef={setReactFlowDataRef}
            />
          )}
          {showMiniMap && <MiniMap />}
        </ReactFlow>

        {/* Panel Toggle Buttons (upper right corner) */}
        {enhanced && (() => {
          console.log('🔍 Rendering toggle buttons!');
          return <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: 1001,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <button
              onClick={toggleInfoPanel}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: pageState.showInfoPanel ? '#4caf50' : 'rgba(255, 255, 255, 0.9)',
                color: '#222',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'all 0.2s ease'
              }}
              title="Toggle Info Panel"
            >
              <svg width="20" height="20" viewBox="0 0 1024 1024" fill="currentColor">
                <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z" />
                <path d="M464 336a48 48 0 1 0 96 0 48 48 0 1 0-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z" />
              </svg>
            </button>
            <button
              onClick={toggleStyleTuner}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: pageState.showStyleTuner ? '#4caf50' : 'rgba(255, 255, 255, 0.9)',
                color: '#222',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'all 0.2s ease'
              }}
              title="Toggle Style Tuner"
            >
              <svg width="20" height="20" viewBox="0 0 1024 1024" fill="currentColor">
                <path d="M924.8 625.7l-65.5-56c3.1-19 4.7-38.4 4.7-57.8s-1.6-38.8-4.7-57.8l65.5-56a32.03 32.03 0 0 0 9.3-35.2l-.9-2.6a443.74 443.74 0 0 0-79.7-137.9l-1.8-2.1a32.12 32.12 0 0 0-35.1-9.5l-81.3 28.9c-30-24.6-63.5-44-99.7-57.6l-15.7-85a32.05 32.05 0 0 0-25.8-25.7l-2.7-.5c-52.1-9.4-106.9-9.4-159 0l-2.7.5a32.05 32.05 0 0 0-25.8 25.7l-15.8 85.4a351.86 351.86 0 0 0-99 57.4l-81.9-29.1a32 32 0 0 0-35.1 9.5l-1.8 2.1a446.02 446.02 0 0 0-79.7 137.9l-.9 2.6c-4.5 12.5-.8 26.5 9.3 35.2l66.3 56.6c-3.1 18.8-4.6 38-4.6 57.1 0 19.2 1.5 38.4 4.6 57.1L99 625.5a32.03 32.03 0 0 0-9.3 35.2l.9 2.6c18.1 50.4 44.9 96.9 79.7 137.9l1.8 2.1a32.12 32.12 0 0 0 35.1 9.5l81.9-29.1c29.8 24.5 63.1 43.9 99 57.4l15.8 85.4a32.05 32.05 0 0 0 25.8 25.7l2.7.5a449.4 449.4 0 0 0 159 0l2.7-.5a32.05 32.05 0 0 0 25.8-25.7l15.7-85a350 350 0 0 0 99.7-57.6l81.3 28.9a32 32 0 0 0 35.1-9.5l1.8-2.1c34.8-41.1 61.6-87.5 79.7-137.9l.9-2.6c4.5-12.3.8-26.3-9.3-35zM512 701c-104.9 0-190-85.1-190-190s85.1-190 190-190 190 85.1 190 190-85.1 190-190 190z" />
              </svg>
            </button>
          </div>;
        })()}

        {/* Enhanced UI Components */}
        {enhanced && graphData && (
          <>
            {/* InfoPanel */}
            <InfoPanel
              visualizationState={visualizationState}
              reactFlowData={reactFlowData}
              onSearchResultSelect={() => { }}
              onContainerOperation={() => { }}
              onError={(error: Error) => setError(error.message)}
              open={pageState.showInfoPanel}
              onOpenChange={(open) => updatePageState({ showInfoPanel: open })}
            />

            {/* StyleTuner */}
            <StyleTuner
              value={styleConfig}
              onChange={debouncedStyleChange}
              open={pageState.showStyleTuner}
              onOpenChange={(open) => updatePageState({ showStyleTuner: open })}
            />
          </>
        )}
      </div>
    </StyleConfigProvider>
  );
};

// Main component wrapped with ReactFlowProvider
export const HydroscopeEnhanced: React.FC<HydroscopeEnhancedProps> = (props) => {
  return (
    <ReactFlowProvider>
      <HydroscopeEnhancedInternal {...props} />
    </ReactFlowProvider>
  );
};

export default HydroscopeEnhanced;