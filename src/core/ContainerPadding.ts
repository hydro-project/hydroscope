/**
 * @fileoverview Container Padding Management
 * 
 * Encapsulates all logic related to container label padding and dimension adjustments.
 */

import { LAYOUT_CONSTANTS } from '../shared/config';

/**
 * Container padding configuration and utilities
 */
export class ContainerPadding {
  /**
   * Get the padding dimensions needed for container labels
   */
  static getLabelPadding(): { width: number; height: number } {
    return {
      width: 0, // No horizontal padding needed for labels currently
      height: LAYOUT_CONSTANTS.CONTAINER_LABEL_HEIGHT + LAYOUT_CONSTANTS.CONTAINER_LABEL_PADDING
    };
  }

  /**
   * Get minimum dimensions for a collapsed container
   */
  static getCollapsedContainerMinDimensions(): { width: number; height: number } {
    const collapsedHeight = LAYOUT_CONSTANTS.CONTAINER_LABEL_HEIGHT + (LAYOUT_CONSTANTS.CONTAINER_LABEL_PADDING * 2);
    
    return {
      width: LAYOUT_CONSTANTS.MIN_CONTAINER_WIDTH,
      height: Math.max(collapsedHeight, LAYOUT_CONSTANTS.MIN_CONTAINER_HEIGHT)
    };
  }

  /**
   * Calculate final dimensions for an expanded container including label space
   */
  static getExpandedContainerDimensions(contentWidth: number, contentHeight: number): { width: number; height: number } {
    const labelPadding = this.getLabelPadding();
    
    return {
      width: Math.max(contentWidth, LAYOUT_CONSTANTS.MIN_CONTAINER_WIDTH),
      height: Math.max(
        contentHeight + labelPadding.height,
        LAYOUT_CONSTANTS.MIN_CONTAINER_HEIGHT
      )
    };
  }

  /**
   * Get ELK container padding configuration (if we decide to tell ELK about padding)
   */
  static getELKPaddingConfig(): { top: number; bottom: number; left: number; right: number } {
    return {
      top: LAYOUT_CONSTANTS.CONTAINER_LABEL_PADDING,
      bottom: LAYOUT_CONSTANTS.CONTAINER_LABEL_HEIGHT + LAYOUT_CONSTANTS.CONTAINER_LABEL_PADDING,
      left: LAYOUT_CONSTANTS.CONTAINER_LABEL_PADDING,
      right: LAYOUT_CONSTANTS.CONTAINER_LABEL_PADDING
    };
  }

  /**
   * Get ReactFlow-ready dimensions for a container
   * This is what ReactFlow should see for consistent rendering
   */
  static getReactFlowDimensions(container: { 
    collapsed?: boolean; 
    expandedDimensions?: { width?: number; height?: number }; 
    layout?: { dimensions?: { width?: number; height?: number } } 
  }): { width: number; height: number } {
    
    if (container.collapsed) {
      return this.getCollapsedContainerMinDimensions();
    }

    // For expanded containers, use the layout dimensions (which include padding adjustments)
    // or fall back to expandedDimensions with padding added
    const layoutDims = container.layout?.dimensions;
    if (layoutDims?.width && layoutDims?.height) {
      return {
        width: layoutDims.width,
        height: layoutDims.height
      };
    }

    // Fallback: add padding to base dimensions
    const baseWidth = container.expandedDimensions?.width || LAYOUT_CONSTANTS.MIN_CONTAINER_WIDTH;
    const baseHeight = container.expandedDimensions?.height || LAYOUT_CONSTANTS.MIN_CONTAINER_HEIGHT;
    
    return this.getExpandedContainerDimensions(baseWidth, baseHeight);
  }
}
