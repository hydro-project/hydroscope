// --- Input JSON types (matching hydro's json.rs output) ---

export interface RawNode {
  id: string;
  nodeType: string;
  label: string;
  shortLabel: string;
  fullLabel: string;
  data?: {
    locationKey?: unknown;
    locationType?: string;
    backtrace?: BacktraceFrame[];
  };
}

export interface BacktraceFrame {
  fn: string;
  function: string;
  file: string;
  filename: string;
  line: number | null;
  lineNumber: number | null;
}

export interface RawEdge {
  id: string;
  source: string;
  target: string;
  semanticTags: string[];
  label?: string;
}

export interface HierarchyNode {
  id?: string;
  key?: string;
  name: string;
  children?: HierarchyNode[];
}

export interface HierarchyChoice {
  id: string;
  name: string;
  children: HierarchyNode[];
}

export interface NodeTypeConfig {
  types: { id: string; label: string; colorIndex: number }[];
  defaultType?: string;
}

export interface EdgeStyleConfig {
  semanticMappings: Record<string, Record<string, Record<string, string>>>;
  semanticPriorities?: string[][];
}

export interface LegendConfig {
  title: string;
  items: { type: string; label: string }[];
}

export interface HydroscopeData {
  nodes: RawNode[];
  edges: RawEdge[];
  hierarchyChoices: HierarchyChoice[];
  nodeAssignments: Record<string, Record<string, string>>;
  selectedHierarchy?: string;
  nodeTypeConfig?: NodeTypeConfig;
  edgeStyleConfig?: EdgeStyleConfig;
  legend?: LegendConfig;
}

// --- Internal graph types ---

export interface GraphNode {
  id: string;
  label: string;
  shortLabel: string;
  fullLabel: string;
  nodeType: string;
  parentId: string | null;
  data?: RawNode["data"];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  semanticTags: string[];
  label?: string;
}

export interface Container {
  id: string;
  name: string;
  parentId: string | null;
  childContainerIds: string[];
  nodeIds: string[];
}

export interface EdgeStyle {
  color: string;
  strokeDasharray?: string;
  animated: boolean;
  arrowhead: string;
  lineStyle: "single" | "hash-marks";
  waviness: "straight" | "wavy";
}

// --- Component props ---

export interface HydroscopeProps {
  data?: HydroscopeData | null;
  width?: string | number;
  height?: string | number;
  responsive?: boolean;
  onFileUpload?: (data: HydroscopeData, filename?: string) => void;
}

export interface HydroscopeCoreProps {
  data: HydroscopeData;
  width?: string | number;
  height?: string | number;
}
