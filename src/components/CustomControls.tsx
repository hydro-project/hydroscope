/**
 * Custom ReactFlow Controls with Pack/Unpack buttons
 * 
 * Extends ReactFlow's }: CustomControlsProps) {
  const standardControlsRef = useRef<HTMLDivElement>(null);
  const [standardControlsHeight, setStandardControlsHeight] = useState(0); // No fallback - will be calculated
  
  // Scale factors - use prop if provided, otherwise fall back to shared config
  const standardControlsScale = reactFlowControlsScale ?? LAYOUT_CONSTANTS.REACTFLOW_CONTROLS_SCALE;
  const customControlsScale = standardControlsScale * 1.04; // Slightly larger than standard controls zoom controls to include container pack/unpack functionality
 */

import { useRef, useEffect, useState } from 'react';
import { Controls, ControlButton } from '@xyflow/react';
import type { VisualizationState } from '../core/VisualizationState';
import { LAYOUT_CONSTANTS } from '../shared/config';

// SVG Icons for pack/unpack operations (same as GraphControls)
const PackIcon = () => (
<svg id="Layer_1" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 512 512">
  <path fill="currentColor" d="M48.68,170.67c30.01-3,69.24,1.26,99.98,1.2l-.47,44.47c-31.79-.64-85.93-5.15-91.45,31.65-8.5,56.73,5.61,129.95.95,188.29,4.46,11.9,12.64,21.32,26.06,26.84,108.97,7.41,220.75,1.13,330.73,3.21,20.07-2.42,37.72-16.78,40.27-34.05,8.32-56.31-6.25-127.27,0-185.09-11.77-36.93-54.69-30.94-90.5-30.85l-.47-45.27c31.13,1.64,69.66-3.56,99.98-.4,23.16,2.42,42.04,19.44,45.01,38.86-7.67,83.32,10.23,180.25,0,262.01-2.57,20.51-19.89,36.92-44.07,40.46H46.78c-26.2-4.46-41.74-21.6-44.07-43.67-8.55-81.04,6.41-172.67,0-254.8,1.08-21.27,20.53-40.32,45.96-42.87h.01Z"/>
  <path fill="currentColor" d="M258.31,429.8c-.72.25-4.19.29-4.81,0-5.19-2.36-56.57-122.05-66.1-135.93-3.69-24.83,25.3-7.28,33.65-15.32V11.79c1.18-4.89,3.41-9.69,6.81-10.85,3.66-1.26,53.37-1.27,56.89,0,.82.3,4.76,4.33,5.21,5.75l.8,271.87c9.31,8.06,42.87-10.94,32.05,20.42-5.44,15.77-52.12,113.24-60.09,125.08-1.07,1.58-3.09,5.29-4.41,5.75v-.02Z"/>
</svg>
);

const UnpackIcon = () => (
<svg id="Layer_1" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 512 512">
  <path fill="currentColor" d="M48.68,170.67c30.01-3,69.24,1.26,99.98,1.2l-.47,44.47c-31.79-.64-85.93-5.15-91.45,31.65-8.5,56.73,5.61,129.95.95,188.29,4.46,11.9,12.64,21.32,26.06,26.84,108.97,7.41,220.75,1.13,330.73,3.21,20.07-2.42,37.72-16.78,40.27-34.05,8.32-56.31-6.25-127.27,0-185.09-11.77-36.93-54.69-30.94-90.5-30.85l-.47-45.27c31.13,1.64,69.66-3.56,99.98-.4,23.16,2.42,42.04,19.44,45.01,38.86-7.67,83.32,10.23,180.25,0,262.01-2.57,20.51-19.89,36.92-44.07,40.46H46.78c-26.2-4.46-41.74-21.6-44.07-43.67-8.55-81.04,6.41-172.67,0-254.8,1.08-21.27,20.53-40.32,45.96-42.87h.01Z"/>
  <path fill="currentColor" d="M253.7.2c.72-.25,4.19-.29,4.81,0,5.19,2.36,56.57,122.05,66.1,135.93,3.69,24.83-25.3,7.28-33.65,15.32v266.76c-1.18,4.89-3.41,9.69-6.81,10.85-3.66,1.26-53.37,1.27-56.89,0-.82-.3-4.76-4.33-5.21-5.75l-.8-271.87c-9.31-8.06-42.87,10.94-32.05-20.42,5.44-15.77,52.12-113.24,60.09-125.08,1.07-1.58,3.09-5.29,4.41-5.75v.02Z"/>
</svg>
);

const FitIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M5.828 10.172a.5.5 0 0 0-.707 0l-4.096 4.096V11.5a.5.5 0 0 0-1 0v3.975a.5.5 0 0 0 .5.5H4.5a.5.5 0 0 0 0-1H1.732l4.096-4.096a.5.5 0 0 0 0-.707zm4.344 0a.5.5 0 0 1 .707 0l4.096 4.096V11.5a.5.5 0 1 1 1 0v3.975a.5.5 0 0 1-.5.5H11.5a.5.5 0 0 1 0-1h2.768l-4.096-4.096a.5.5 0 0 1 0-.707zm0-4.344a.5.5 0 0 0 .707 0l4.096-4.096V4.5a.5.5 0 1 0 1 0V.525a.5.5 0 0 0-.5-.5H11.5a.5.5 0 0 0 0 1h2.768l-4.096 4.096a.5.5 0 0 0 0 .707zm-4.344 0a.5.5 0 0 1-.707 0L1.025 1.732V4.5a.5.5 0 0 1-1 0V.525a.5.5 0 0 1 .5-.5H4.5a.5.5 0 0 1 0 1H1.732l4.096 4.096a.5.5 0 0 1 0 .707z"
      strokeWidth="1.5"
    />
  </svg>
);

const AutoFitIcon = ({ enabled }: { enabled: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    {/* Outer frame */}
    <rect x="1" y="1" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" rx="2"/>
    {/* Inner content - changes based on enabled state */}
    {enabled ? (
      // Enabled: filled center with arrows pointing outward
      <>
        <rect x="4" y="4" width="8" height="8" fill="currentColor" rx="1"/>
        <path d="M2 2l2 2M14 2l-2 2M2 14l2-2M14 14l-2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </>
    ) : (
      // Disabled: just the arrows pointing inward
      <path d="M4 4l2 2M12 4l-2 2M4 12l2-2M12 12l-2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    )}
  </svg>
);

const LoadFileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
    <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9zM2.5 3a.5.5 0 0 0-.5.5V6h12v-.5a.5.5 0 0 0-.5-.5H9c-.964 0-1.71-.629-2.174-1.154C6.374 3.334 5.82 3 5.264 3H2.5zM14 7H2v5.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V7z"
    />
  </svg>
);

export interface CustomControlsProps {
  visualizationState?: VisualizationState | null;
  onCollapseAll?: () => void;
  onExpandAll?: () => void;
  showPackUnpack?: boolean;
  onFitView?: () => void;
  autoFit?: boolean;
  onAutoFitToggle?: (enabled: boolean) => void;
  onLoadFile?: () => void;
  showLoadFile?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  reactFlowControlsScale?: number;
}

export function CustomControls({
  visualizationState,
  onCollapseAll,
  onExpandAll,
  showPackUnpack = true,
  onFitView,
  autoFit = false,
  onAutoFitToggle,
  onLoadFile,
  showLoadFile = false,
  position = 'bottom-left',
  reactFlowControlsScale
}: CustomControlsProps) {
  const standardControlsRef = useRef<HTMLDivElement>(null);
  const [standardControlsHeight, setStandardControlsHeight] = useState(40); // fallback value - much lower to test
  
  // Scale factors - use prop if provided, otherwise fall back to shared config
  const standardControlsScale = reactFlowControlsScale ?? LAYOUT_CONSTANTS.REACTFLOW_CONTROLS_SCALE;
  const customControlsScale = standardControlsScale * 1.0; // Sae size as standard controls for now

  // Check if there are any containers that can be collapsed/expanded
  const hasContainers = (visualizationState?.visibleContainers?.length ?? 0) > 0;
  const hasCollapsedContainers = visualizationState?.visibleContainers?.some(container => container.collapsed) ?? false;
  const hasExpandedContainers = visualizationState?.visibleContainers?.some(container => !container.collapsed) ?? false;

  // Calculate if we have any custom controls to show
  const hasCustomControls = showPackUnpack || onFitView || onAutoFitToggle || showLoadFile;

  // Dynamically measure the standard controls height
  useEffect(() => {
    const updateHeight = () => {
      if (standardControlsRef.current) {
        // Try to find the actual controls container within the ReactFlow Controls
        const controlsContainer = standardControlsRef.current.querySelector('.react-flow__controls');
        const elementToMeasure = controlsContainer || standardControlsRef.current;
        
        const rect = elementToMeasure.getBoundingClientRect();
        const baseHeight = rect.height;
        
        // Use the actual measured height directly (no scaling needed)
        const finalHeight = baseHeight;
        
        // Only update if we got a reasonable height measurement
        if (baseHeight > 0 && baseHeight < 200) { // Sanity check
          setStandardControlsHeight(finalHeight);
        }
      } else {
        // standardControlsRef not available yet - will retry on next effect run
      }
    };

    // Delay initial measurement to ensure DOM is ready
    const timeoutId = setTimeout(updateHeight, 100);

    // Create a ResizeObserver to watch for changes
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateHeight();
      });
      
      // Only observe if ref is available
      if (standardControlsRef.current) {
        resizeObserver.observe(standardControlsRef.current);
      }
    }

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [hasCustomControls, standardControlsScale]); // Re-run when custom controls visibility changes OR scale changes

  return (
    <>
      {/* Custom Controls - positioned dynamically above standard controls */}
      {hasCustomControls && (
        <div
          style={{
            position: 'absolute',
            bottom: `${standardControlsHeight}px`, // Dynamic positioning based on standard controls height
            left: '0px', // Same left alignment as standard controls
            zIndex: 10,
            // Add shadow back to custom controls
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            borderRadius: '6px',
            backgroundColor: 'white'
          }}
        >
          <Controls showZoom={false} showFitView={false} showInteractive={false} style={{ 
            transform: `scale(${customControlsScale})`, 
            transformOrigin: 'left bottom',
            borderRadius: '6px'
          }}>
            {/* Auto Fit Toggle Button - always show when callback provided */}
            {onAutoFitToggle && (
              <ControlButton
                onClick={() => onAutoFitToggle(!autoFit)}
                title={autoFit ? "Auto-fit enabled: Automatically fits view after layout changes" : "Auto-fit disabled: Click to enable automatic view fitting"}
                style={{
                  backgroundColor: autoFit ? 'rgba(59, 130, 246, 0.1)' : undefined,
                  borderColor: autoFit ? '#3b82f6' : undefined
                }}
              >
                <AutoFitIcon enabled={autoFit} />
              </ControlButton>
            )}
            {/* Fit View Button - always show when callback provided */}
            {onFitView && (
              <ControlButton
                onClick={onFitView}
                title="Fit graph to viewport"
              >
                <FitIcon />
              </ControlButton>
            )}
            {/* Load File Button - at the top when enabled */}
            {showLoadFile && onLoadFile && (
              <ControlButton
                onClick={onLoadFile}
                title="Load another file"
              >
                <LoadFileIcon />
              </ControlButton>
            )}
            {/* Pack/Unpack buttons - always show when pack/unpack is enabled */}
            {showPackUnpack && (
              <>
                {/* Pack All (Collapse All) Button */}
                <ControlButton
                  onClick={onCollapseAll}
                  disabled={!hasContainers || !hasExpandedContainers}
                  title={
                    !hasContainers 
                      ? "No containers available" 
                      : !hasExpandedContainers 
                        ? "No containers to collapse" 
                        : "Collapse All Containers"
                  }
                >
                  <PackIcon />
                </ControlButton>
                {/* Unpack All (Expand All) Button */}
                <ControlButton
                  onClick={onExpandAll}
                  disabled={!hasContainers || !hasCollapsedContainers}
                  title={
                    !hasContainers 
                      ? "No containers available" 
                      : !hasCollapsedContainers 
                        ? "No containers to expand" 
                        : "Expand All Containers"
                  }
                >
                  <UnpackIcon />
                </ControlButton>
              </>
            )}
          </Controls>
        </div>
      )}
      
      {/* Standard ReactFlow Controls - at the bottom */}
      <div ref={standardControlsRef}>
        <Controls position={position} style={{ 
          transform: `scale(${standardControlsScale})`, 
          transformOrigin: 'left bottom',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', // Restore shadow to standard controls
          borderRadius: '6px'
        }} />
      </div>
    </>
  );
}