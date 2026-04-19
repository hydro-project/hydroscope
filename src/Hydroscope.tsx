import React, { useState, useCallback, useReducer, useMemo, useEffect, useRef, memo } from "react";
import {
  ReactFlow, ReactFlowProvider, useReactFlow, Background, Controls, MiniMap,
  BaseEdge, getBezierPath, Handle, Position,
  type Node, type Edge, type NodeTypes, type EdgeTypes, type NodeProps, type EdgeProps,
} from "@xyflow/react";
import type { HydroscopeData, HydroscopeProps, HydroscopeCoreProps } from "./types";
import { parseHydroscopeData } from "./parse";
import { initState, reducer, getVisibleNodes, getVisibleEdges, getVisibleContainers } from "./state";
import { layoutGraph, type LayoutResult } from "./layout";
import { resolveEdgeStyle } from "./style";
import "./hydroscope.css";

// --- Node components ---

const DataflowNode = memo(function DataflowNode({ data }: NodeProps) {
  const d = data as any;
  const cls = ["hydro-node", d.dimmed && "hydro-node-dimmed", d.highlighted && "hydro-node-highlighted",
    d.isCollapsed && "hydro-node-collapsed"].filter(Boolean).join(" ");
  return (
    <div className={cls} title={d.fullLabel ?? d.label} onClick={d.onToggle}>
      <Handle type="target" position={Position.Top} />
      <div className="hydro-node-label">{d.label}</div>
      {d.isCollapsed && <div className="hydro-node-badge">+</div>}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
});

const ContainerNodeComponent = memo(function ContainerNodeComponent({ data }: NodeProps) {
  const d = data as any;
  return (
    <div className="hydro-container" onClick={d.onToggle}>
      <div className="hydro-container-header"><span>{d.label}</span></div>
    </div>
  );
});

// --- Edge component ---

interface HydroEdgeData {
  color: string;
  strokeDasharray?: string;
  lineStyle: "single" | "hash-marks";
  count: number;
  label?: string;
}

function HydroEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd } = props;
  const d = (props.data as unknown) as HydroEdgeData;
  if (!d) return null;
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const color = d.color ?? "#666666";
  const strokeWidth = d.count > 1 ? Math.min(1 + d.count * 0.5, 4) : 1.5;
  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd}
        style={{ stroke: color, strokeWidth, strokeDasharray: d.strokeDasharray, opacity: 0.8 }} />
      {d.lineStyle === "hash-marks" && <HashMarks path={path} color={color} />}
      {d.label && <text x={labelX} y={labelY - 8} textAnchor="middle" fontSize={10} fill="#666">{d.label}</text>}
      {d.count > 1 && <text x={labelX} y={labelY + 12} textAnchor="middle" fontSize={9} fill="#999">{d.count}x</text>}
    </>
  );
}

function HashMarks({ path, color }: { path: string; color: string }) {
  if (typeof document === "undefined") return null;
  const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pathEl.setAttribute("d", path);
  const totalLen = pathEl.getTotalLength();
  if (totalLen < 40) return null;
  const marks: React.ReactElement[] = [];
  for (let dist = 30; dist < totalLen - 30; dist += 30) {
    const p = pathEl.getPointAtLength(dist);
    const p2 = pathEl.getPointAtLength(Math.min(dist + 1, totalLen));
    const dx = p2.x - p.x, dy = p2.y - p.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len * 6, ny = dx / len * 6;
    marks.push(<line key={dist} x1={p.x - nx} y1={p.y - ny} x2={p.x + nx} y2={p.y + ny}
      stroke={color} strokeWidth={1.5} opacity={0.6} />);
  }
  return <g>{marks}</g>;
}

// --- Core component (receives measured pixel dimensions) ---

const nodeTypes: NodeTypes = { hydro: DataflowNode, container: ContainerNodeComponent };
const edgeTypes: EdgeTypes = { hydro: HydroEdge as any };

function HydroscopeCoreInner({ data, containerWidth, containerHeight }: { data: HydroscopeData; containerWidth: number; containerHeight: number }) {
  const [state, dispatch] = useReducer(reducer, data, initState);
  const [layout, setLayout] = useState<LayoutResult | null>(null);
  const [search, setSearch] = useState("");
  const { fitView } = useReactFlow();
  const layoutVersion = useRef(0);

  useEffect(() => { dispatch({ type: "load", data }); }, [data]);

  const visibleNodes = useMemo(() => getVisibleNodes(state), [state]);
  const visibleEdges = useMemo(() => getVisibleEdges(state), [state]);
  const visibleContainers = useMemo(() => getVisibleContainers(state), [state]);

  const searchLower = search.toLowerCase();
  const searchMatches = useMemo(
    () => search ? new Set(visibleNodes.filter((n) =>
      n.label.toLowerCase().includes(searchLower) || n.fullLabel.toLowerCase().includes(searchLower)
    ).map((n) => n.id)) : null,
    [visibleNodes, searchLower, search],
  );

  useEffect(() => {
    const version = ++layoutVersion.current;
    layoutGraph(visibleNodes, visibleEdges, visibleContainers, state.collapsed).then((result) => {
      if (version === layoutVersion.current) {
        setLayout(result);
        setTimeout(() => fitView({ padding: 0.1, duration: 200 }), 100);
      }
    }).catch((err) => console.error("[hydroscope] layout error:", err));
  }, [visibleNodes, visibleEdges, visibleContainers, state.collapsed]);

  const rfNodes = useMemo((): Node[] => {
    if (!layout) return [];
    const nodes: Node[] = [];

    // Containers first (parents must come before children in ReactFlow)
    // Sort so parents come before their children
    const sortedContainers = [...visibleContainers].sort((a, b) => {
      // Root containers first (no parent), then children
      if (!a.parentId && b.parentId) return -1;
      if (a.parentId && !b.parentId) return 1;
      return 0;
    });

    const containerPositions = layout.containerPositions;

    for (const container of sortedContainers) {
      const pos = containerPositions.get(container.id);
      if (!pos) continue;
      const isCollapsed = state.collapsed.has(container.id);

      // Position relative to parent container if nested
      let x = pos.x, y = pos.y;
      if (container.parentId) {
        const parentPos = containerPositions.get(container.parentId);
        if (parentPos) { x -= parentPos.x; y -= parentPos.y; }
      }

      nodes.push({
        id: container.id,
        type: isCollapsed ? "hydro" : "group",
        position: { x, y },
        data: { label: container.name, isCollapsed, onToggle: () => dispatch({ type: "toggle_collapse", containerId: container.id }) },
        style: isCollapsed ? undefined : {
          width: pos.width, height: pos.height,
          background: "rgba(240,240,240,0.4)", border: "1px solid #ddd",
          borderRadius: 6, padding: 0,
        },
        ...(container.parentId && containerPositions.has(container.parentId)
          ? { parentId: container.parentId } : {}),
      });
    }

    // Graph nodes — position relative to parent container
    for (const node of visibleNodes) {
      const pos = layout.nodePositions.get(node.id);
      if (!pos) continue;
      const highlighted = searchMatches === null || searchMatches.has(node.id);

      let x = pos.x, y = pos.y;
      if (node.parentId) {
        const parentPos = containerPositions.get(node.parentId);
        if (parentPos) { x -= parentPos.x; y -= parentPos.y; }
      }

      nodes.push({
        id: node.id, type: "hydro",
        position: { x, y },
        data: { label: node.shortLabel, fullLabel: node.fullLabel, nodeType: node.nodeType,
          highlighted, dimmed: searchMatches !== null && !highlighted },
        ...(node.parentId && containerPositions.has(node.parentId)
          ? { parentId: node.parentId, extent: "parent" as const } : {}),
      });
    }
    return nodes;
  }, [layout, visibleNodes, visibleContainers, state.collapsed, searchMatches]);

  const rfEdges = useMemo((): Edge[] => {
    if (!layout) return [];
    return visibleEdges.map((edge) => {
      const s = resolveEdgeStyle(edge.semanticTags, data.edgeStyleConfig);
      return {
        id: edge.id, source: edge.source, target: edge.target, type: "hydro", animated: s.animated,
        data: { color: s.color, strokeDasharray: s.strokeDasharray, lineStyle: s.lineStyle,
          count: edge.count, label: edge.label } satisfies HydroEdgeData,
      };
    });
  }, [layout, visibleEdges, data.edgeStyleConfig]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (state.containers.has(node.id)) dispatch({ type: "toggle_collapse", containerId: node.id });
  }, [state.containers]);

  // Toolbar height ~40px
  const toolbarHeight = 41;
  const flowHeight = containerHeight - toolbarHeight;

  return (
    <>
      <div className="hydroscope-toolbar">
        <input className="hydroscope-search" type="text" placeholder="Search nodes..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        {data.hierarchyChoices.length > 1 && (
          <select className="hydroscope-hierarchy-select" value={state.hierarchyId}
            onChange={(e) => dispatch({ type: "set_hierarchy", hierarchyId: e.target.value })}>
            {data.hierarchyChoices.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <button className="hydroscope-btn" onClick={() => dispatch({ type: "collapse_all" })}>Collapse All</button>
        <button className="hydroscope-btn" onClick={() => dispatch({ type: "expand_all" })}>Expand All</button>
      </div>
      <div style={{ width: containerWidth, height: flowHeight > 0 ? flowHeight : 400 }}>
        <ReactFlow nodes={rfNodes} edges={rfEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          onNodeClick={onNodeClick} fitView minZoom={0.05} maxZoom={2}
          panOnDrag panOnScroll={false} zoomOnScroll zoomOnPinch
          proOptions={{ hideAttribution: true }}>
          <Background /><Controls /><MiniMap />
        </ReactFlow>
      </div>
    </>
  );
}

// --- Wrapper: measures container, passes pixel dims ---

export function HydroscopeCore({ data, width = "100%", height = "100%" }: HydroscopeCoreProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      console.log("[hydroscope] measured container:", r.width, r.height);
      if (r.width > 0 && r.height > 0) setSize([r.width, r.height]);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width, height }}>
      {size[0] > 0 && size[1] > 0 && (
        <ReactFlowProvider>
          <HydroscopeCoreInner data={data} containerWidth={size[0]} containerHeight={size[1]} />
        </ReactFlowProvider>
      )}
    </div>
  );
}

// --- Top-level component with file upload ---

export function Hydroscope({ data, width = "100%", height = "100%", responsive, onFileUpload }: HydroscopeProps) {
  const [fileData, setFileData] = useState<HydroscopeData | null>(null);
  const activeData = data ?? fileData;

  const handleFile = useCallback((file: File) => {
    file.text().then((text) => {
      try {
        const parsed = parseHydroscopeData(text);
        setFileData(parsed);
        onFileUpload?.(parsed, file.name);
      } catch (err) { console.error("Failed to parse file:", err); }
    });
  }, [onFileUpload]);

  const style: React.CSSProperties = {
    width: responsive ? "100%" : width,
    height: responsive ? "100%" : height,
  };

  if (!activeData) {
    return (
      <div style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center",
        border: "2px dashed #ccc", borderRadius: 8, background: "#fafafa", minHeight: 300 }}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onDragOver={(e) => e.preventDefault()}>
        <div style={{ textAlign: "center", color: "#888" }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>Drop a Hydroscope JSON file here</p>
          <p style={{ marginBottom: 12 }}>or</p>
          <label style={{ display: "inline-block", padding: "8px 16px", background: "#4a90d9",
            color: "white", borderRadius: 4, cursor: "pointer" }}>
            Choose File
            <input type="file" accept=".json" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} hidden />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div style={style}>
      <HydroscopeCore data={activeData} width="100%" height="100%" />
    </div>
  );
}
