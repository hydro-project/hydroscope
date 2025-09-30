/**
 * @fileoverview InfoPanel Component Types
 *
 * TypeScript interfaces for the InfoPanel system components.
 */

import { VisualizationState } from "../core/VisualizationState";
import { AsyncCoordinator } from "../core/AsyncCoordinator";

// Define EdgeStyleConfig locally since EdgeStyleProcessor doesn't exist in v6
export interface EdgeStyleConfig {
  [key: string]: {
    color?: string;
    width?: number;
    style?: "solid" | "dashed" | "dotted";
    type?: "bezier" | "straight" | "smoothstep";
  };
}

// Define LayoutOrchestrator type locally since it doesn't exist in v6
export interface LayoutOrchestrator {
  // Placeholder for layout orchestrator functionality
  [key: string]: any;
}

// ============ Base Component Props ============

export interface BaseComponentProps {
  className?: string;
  style?: React.CSSProperties;
}

// ============ InfoPanel Props ============

export interface GroupingOption {
  id: string;
  name: string;
}

export interface LegendItem {
  type: string;
  label: string;
  description?: string;
}

export interface LegendData {
  title: string;
  items: LegendItem[];
}

interface NodeTypeConfig {
  color?: string;
  style?: string;
  [key: string]: unknown;
}

export interface InfoPanelProps extends BaseComponentProps {
  // Data
  visualizationState?: VisualizationState | null;
  reactFlowData?: { nodes: any[]; edges: any[] };
  legendData?: LegendData;
  edgeStyleConfig?: EdgeStyleConfig;
  nodeTypeConfig?: any;

  // Grouping & Hierarchy
  hierarchyChoices?: GroupingOption[];
  currentGrouping?: string | null;
  onGroupingChange?: (groupingId: string) => void;

  // Container Interaction
  collapsedContainers?: Set<string>;
  onToggleContainer?: (containerId: string) => void;
  layoutOrchestrator?: LayoutOrchestrator | null; // LayoutOrchestrator for coordinated operations
  asyncCoordinator?: AsyncCoordinator | null; // V6 AsyncCoordinator for operation coordination

  // Panel Control
  onPositionChange?: (panelId: string, position: PanelPosition) => void;
  onResetToDefaults?: () => void;
  onError?: (error: Error) => void;

  // Styling
  colorPalette?: string;
  defaultCollapsed?: boolean;
}

// ============ HierarchyTree Props ============

export interface HierarchyTreeNode {
  id: string;
  children: HierarchyTreeNode[];
  // Removed: label, shortLabel, nodeCount - these come from visualizationState
}

export interface HierarchyTreeProps extends BaseComponentProps {
  // Data - hierarchyTree removed, built internally from visualizationState
  collapsedContainers?: Set<string>;
  visualizationState?: VisualizationState; // Required for building tree structure

  // Interaction
  onToggleContainer?: (containerId: string) => void;
  layoutOrchestrator?: LayoutOrchestrator | null; // LayoutOrchestrator for coordinated search expansion
  asyncCoordinator?: AsyncCoordinator | null; // V6 AsyncCoordinator for operation coordination

  // Display
  title?: string;
  showNodeCounts?: boolean;
  truncateLabels?: boolean;
  maxLabelLength?: number;
}

// ============ Legend Props ============

export interface LegendProps extends BaseComponentProps {
  // Data
  legendData: LegendData;

  // Styling
  colorPalette?: string;
  nodeTypeConfig?: Record<string, NodeTypeConfig>;

  // Display
  title?: string;
  compact?: boolean;
}

// ============ Panel System ============

export const PANEL_POSITIONS = {
  TOP_LEFT: "top-left",
  TOP_RIGHT: "top-right",
  BOTTOM_LEFT: "bottom-left",
  BOTTOM_RIGHT: "bottom-right",
  FLOATING: "floating",
} as const;

export type PanelPosition =
  (typeof PANEL_POSITIONS)[keyof typeof PANEL_POSITIONS];

export interface DockablePanelProps extends BaseComponentProps {
  id: string;
  title: string;
  children: React.ReactNode;

  // Position & State
  defaultPosition?: PanelPosition;
  defaultDocked?: boolean;
  defaultCollapsed?: boolean;

  // Callbacks
  onPositionChange?: (panelId: string, position: PanelPosition) => void;
  onDockChange?: (panelId: string, docked: boolean) => void;
  onCollapseChange?: (panelId: string, collapsed: boolean) => void;

  // Sizing
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

// ============ Collapsible Section Props ============

export interface CollapsibleSectionProps extends BaseComponentProps {
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;

  // Styling
  level?: number; // For nested sections
  showIcon?: boolean;
  disabled?: boolean;
}

// ============ Utility Types ============

export interface ContainerMetrics {
  totalContainers: number;
  expandedContainers: number;
  collapsedContainers: number;
  maxDepth: number;
  nodesByContainer: Map<string, Set<string>>;
}

export interface PanelState {
  position: PanelPosition;
  docked: boolean;
  collapsed: boolean;
  floatingPosition?: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface InfoPanelState {
  panels: Record<string, PanelState>;
  legendCollapsed: boolean;
  hierarchyCollapsed: boolean;
  groupingCollapsed: boolean;
}
