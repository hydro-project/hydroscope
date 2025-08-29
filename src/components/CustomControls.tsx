/**
 * Custom ReactFlow Controls with Pack/Unpack buttons
 * 
 * Extends ReactFlow's default zoom controls to include container pack/unpack functionality
 */

import React from 'react';
import { Controls, ControlButton } from '@xyflow/react';
import type { VisualizationState } from '../core/VisualizationState';

// SVG Icons for pack/unpack operations (same as GraphControls)
const PackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 66 66" fill="currentColor">
    <path d="M63.6,28.1l-6.5-6.9c0,0-.3-.2-.4-.2l-14.8-5.8h0c.2-.3.3-.7,0-1-.2-.3-.5-.6-.8-.6h-3.6V3.4c0-.6-.4-.9-.9-.9h-7.7c-.6,0-.9.4-.9.9v10.1h-3.6c-.4,0-.7.2-.8.6-.2.3,0,.7,0,.9l-13.9,5.6c0,0-.2,0-.3.2h0l-7.3,7.4c-.2.2-.3.6-.3.8,0,.3.3.6.6.7l6.7,2.7v20.8c0,.4.2.7.6.8l22.5,10.1h0c0,0,.2,0,.4,0h0c0,0,.2,0,.3,0h0l23.8-9.8c.4-.2.6-.5.6-.8v-21.6l5.8-2.3c.3,0,.5-.4.6-.7,0-.4,0-.7-.2-.8ZM29.2,15.4c.6,0,.9-.4.9-.9V4.4h5.8v10.1c0,.6.4.9.9.9h2.5l-6.4,8.2-6.4-8.2h2.5ZM25.1,16.6l7.1,9.2c.2.2.5.4.7.4s.6,0,.7-.4l7.1-9.1,13.1,5.2-21.2,8-20-8.2,12.3-5.1ZM10.5,22.7l20.3,8.3-7.4,5.4c-14.5-6.1-10.6-4.5-18.8-7.8l5.9-6ZM11.3,33.3l12,5.1c.3,0,.7,0,.9,0l7.7-5.6v29.3l-20.6-9.3s0-19.4,0-19.4ZM55.6,52.9l-21.9,9.1v-29.3l6.7,5.5c.3.2.7.3.9.2l14.2-5.7v20.2ZM41.2,36.4l-6.6-5.3,21.7-8.2,5.1,5.4-20.2,8.1Z"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="currentColor"
    />
    
  </svg>
);

const UnpackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 66.1 65.8" fill="currentColor">
    <path d="M56.6,27.1l5.3-2.6c.3-.2.5-.5.5-.8s-.2-.6-.4-.8l-16.3-8.9c-.4-.3-1,0-1.2.4-.3.5,0,1,.4,1.3l14.8,8-4.6,2.3-11.8-5.9c-.4-.2-1,0-1.2.5s0,1,.4,1.2l10.6,5.2-19.8,9.7-19.6-9.7,11.1-5.4c.4-.2.6-.7.4-1.2s-.7-.6-1.2-.5l-12.5,6.1-4.6-2.3,15.2-8c.4-.3.6-.8.4-1.2-.3-.5-.8-.6-1.2-.4L4.5,22.9c-.3.2-.4.5-.4.8s.2.6.5.8l5.3,2.5-5.8,4.1c-.4.2-.4.5-.4.8s.2.6.4.7l6.6,3.4v17.5c0,.4.3.7.5.8l21.6,8.2c.2,0,.4,0,.6,0l21.6-8.1c.4,0,.6-.5.6-.8v-17.3l6.1-3.3c.3-.2.4-.5.4-.7s0-.6-.4-.8l-5.3-4.4ZM11.6,27.9l20.1,9.9-4.3,4.9L6.2,31.7l5.4-3.8ZM12.4,37l14.9,7.7c0,0,.3,0,.4,0,.3,0,.5,0,.7-.3l3.9-4.5v20.6l-19.9-7.6v-16ZM54,53.1l-19.8,7.4v-20.9l4.9,4.9c.2.2.4.3.6.3s.3,0,.4,0l13.9-7.4v15.8ZM39.8,42.8l-5-5.1,20-9.8,5.1,4.1-20.1,10.7Z"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="currentColor"
    />
    <path d="M22,18.5c.2.3.4.5.8.5h4.7v12.8c0,.3,0,.5.3.6s.4.3.6.3h9.6c.5,0,.9-.4.9-.9v-12.8h4.8c.4,0,.6-.2.8-.5.2-.3,0-.6,0-.9l-10.5-14.1c-.4-.5-1.1-.5-1.4,0l-10.4,14.1c-.2.3-.3.6,0,.9ZM33.2,5.5l8.7,11.7h-3.8c-.5,0-.9.4-.9.9v12.8h-7.8v-12.8c0-.3,0-.5-.3-.6-.2-.2-.4-.3-.6-.3h-3.8l8.5-11.7Z"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="currentColor"
    />
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
  position = 'bottom-left'
}: CustomControlsProps) {
  // Check if there are any containers that can be collapsed/expanded
  const hasContainers = (visualizationState?.visibleContainers?.length ?? 0) > 0;
  const hasCollapsedContainers = visualizationState?.visibleContainers?.some(container => container.collapsed) ?? false;
  const hasExpandedContainers = visualizationState?.visibleContainers?.some(container => !container.collapsed) ?? false;

  // Calculate if we have any custom controls to show
  const hasCustomControls = showPackUnpack || onFitView || onAutoFitToggle || showLoadFile;

  return (
    <>
      {/* Custom Controls - positioned directly above standard controls */}
      {hasCustomControls && (
        <div
          style={{
            position: 'absolute',
            bottom: '110px', // Position above the standard controls (which are at 0px)
            left: '0px', // Same left alignment as standard controls
            zIndex: 5
          }}
        >
          <Controls showZoom={false} showFitView={false} showInteractive={false}>
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
            
            {/* Fit View Button - always show when callback provided */}
            {onFitView && (
              <ControlButton
                onClick={onFitView}
                title="Fit graph to viewport"
              >
                <FitIcon />
              </ControlButton>
            )}
            
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
          </Controls>
        </div>
      )}
      
      {/* Standard ReactFlow Controls - at the bottom in their usual position */}
      <Controls position={position} />
    </>
  );
}