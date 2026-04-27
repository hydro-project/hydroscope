import React, { useState, useCallback, useReducer, useMemo, useEffect, useRef, memo } from "react";
import {
  ReactFlow, ReactFlowProvider, useReactFlow, useNodesState, useEdgesState, useStore,
  Background, Controls, ControlButton, MiniMap, MarkerType,
  BaseEdge, getBezierPath, Handle, Position,
  type Node, type Edge, type NodeTypes, type EdgeTypes, type NodeProps, type EdgeProps,
} from "@xyflow/react";
import type { HydroscopeData, HydroscopeProps, HydroscopeCoreProps, BacktraceFrame } from "./types";
import { parseHydroscopeData, parseDataFromUrl } from "./parse";
import { initState, reducer, getVisibleNodes, getVisibleEdges, getVisibleContainers,
  searchAllNodes, containersToExpand, getContainerLeafCounts, type Action, type SearchHit } from "./state";
import { layoutGraph, computeContainerSizes, DEFAULT_LAYOUT_OPTIONS, type LayoutResult, type LayoutOptions, type LayoutDirection, type LayoutAlgorithm } from "./layout";
import { DOT_ZOOM_THRESHOLD, COLLAPSED_WIDTH, COLLAPSED_HEIGHT, ARROW_SIZE } from "./constants";
import { resolveEdgeStyle } from "./style";
import "./hydroscope.css";

// Suppress benign ResizeObserver loop errors (triggered by ReactFlow internals)
if (typeof window !== "undefined") {
  // Must use capture phase to run before webpack-dev-server's overlay handler
  window.addEventListener("error", (e) => {
    if (e.message?.includes("ResizeObserver")) { e.stopImmediatePropagation(); }
  }, true);
  // Also patch window.onerror for older error paths
  const _onerror = window.onerror;
  window.onerror = (msg, ...args) => {
    if (typeof msg === "string" && msg.includes("ResizeObserver")) return true;
    return _onerror ? (_onerror as any)(msg, ...args) : false;
  };
}

// --- Color palette for node types ---
const NODE_TYPE_COLORS = [
  "#8b5cf6", "#3b82f6", "#ef4444", "#f59e0b", "#10b981",
  "#ec4899", "#06b6d4", "#6366f1", "#84cc16", "#f97316",
];

function nodeTypeColor(colorIndex: number): string {
  return NODE_TYPE_COLORS[colorIndex % NODE_TYPE_COLORS.length];
}

/** Darken a hex color by a fraction (0–1) */
function darken(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) * (1 - amount)) | 0;
  const g = Math.max(0, ((n >> 8) & 0xff) * (1 - amount)) | 0;
  const b = Math.max(0, (n & 0xff) * (1 - amount)) | 0;
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// --- Zoom selector for semantic zoom ---
const zoomSelector = (s: any) => s.transform?.[2] ?? 1;

// --- Node components ---

const DataflowNode = memo(function DataflowNode({ data }: NodeProps) {
  const d = data as any;
  const zoom = useStore(zoomSelector);
  const bgColor = d.typeColor ?? "#999";

  // Dot mode: below zoom threshold, render as a small colored circle
  if (zoom < DOT_ZOOM_THRESHOLD) {
    return (
      <div className="hydro-node-dot" style={{ background: bgColor }}>
        <Handle type="target" position={Position.Top} />
        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  }

  const cls = ["hydro-node", d.dimmed && "hydro-node-dimmed", d.highlighted && "hydro-node-highlighted"].filter(Boolean).join(" ");
  const showTooltip = d.fullLabel && d.fullLabel !== d.label;
  return (
    <div className={cls}
      style={{ borderLeftColor: bgColor, borderLeftWidth: 3 }}>
      <Handle type="target" position={Position.Top} />
      <div className="hydro-node-label">{d.label}</div>
      {showTooltip && <div className="hydro-node-tooltip">{d.fullLabel}</div>}
      <button className="hydro-node-info-btn" onClick={(e) => { e.stopPropagation(); d.onInfo?.(); }}
        title="Node details">ℹ</button>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
});

const CollapsedContainerNode = memo(function CollapsedContainerNode({ data }: NodeProps) {
  const d = data as any;
  const count = d.leafCount as number;
  const es = d.elemStyle as ElementStyle | undefined;
  const bg = es?.color ?? d.collapsedColor ?? "#475569";
  const shadow = es?.shadow ?? "medium";
  const grad = es?.gradient ?? false;

  const shadowMap: Record<string, string> = {
    none: "none",
    light: "1px 2px 4px rgba(0,0,0,0.15)",
    medium: "2px 3px 10px rgba(0,0,0,0.2)",
    heavy: "3px 6px 18px rgba(0,0,0,0.3)",
  };

  const style: React.CSSProperties = {
    background: grad
      ? `linear-gradient(180deg, ${bg} 0%, ${darken(bg, 0.15)} 100%)`
      : bg,
    boxShadow: shadowMap[shadow],
  };

  return (
    <div className="hydro-collapsed-container" style={style}>
      <Handle type="target" position={Position.Top} />
      <div className="hydro-collapsed-label">{d.label}</div>
      <div className="hydro-collapsed-count">{count}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
});

const ContainerNodeComponent = memo(function ContainerNodeComponent({ data }: NodeProps) {
  const d = data as any;
  return (
    <div className="hydro-container">
      <div className="hydro-container-header" title={d.label}>
        <span className="hydro-container-name">{d.label}</span>
        {d.hasDissolved && (
          <button className="hydro-rebundle-btn"
            onClick={(e) => { e.stopPropagation(); d.onRebundle?.(); }}
            title="Re-bundle leaf nodes">⊡</button>
        )}
      </div>
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
      {d.count > 1 && <text x={labelX} y={labelY + 12} textAnchor="middle" fontSize={9} fill="#999">{d.count}×</text>}
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

// --- Node info popup ---

interface NodeInfoData {
  id: string;
  label: string;
  fullLabel: string;
  nodeType: string;
  locationType?: string;
  backtrace?: BacktraceFrame[];
}

function NodeInfoPopup({ info, onClose }: { info: NodeInfoData; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyText = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    }).catch(() => {});
  }, []);

  // Top backtrace frames (user code, skip runtime internals)
  const frames = info.backtrace?.slice(0, 5) ?? [];

  return (
    <div className="hydro-popup-overlay" onClick={onClose}>
      <div className="hydro-popup" onClick={(e) => e.stopPropagation()}>
        <div className="hydro-popup-header">
          <span className="hydro-popup-title">{info.label}</span>
          <button className="hydro-popup-close" onClick={onClose}>×</button>
        </div>
        <div className="hydro-popup-body">
          <div className="hydro-popup-row">
            <span className="hydro-popup-key">Type</span>
            <span className="hydro-popup-val">{info.nodeType}</span>
          </div>
          {info.locationType && (
            <div className="hydro-popup-row">
              <span className="hydro-popup-key">Location</span>
              <span className="hydro-popup-val">{info.locationType}</span>
            </div>
          )}
          <div className="hydro-popup-row hydro-popup-row-full">
            <span className="hydro-popup-key">Full label</span>
            <button className="hydro-copy-btn" onClick={() => copyText(info.fullLabel, "label")}>
              {copied === "label" ? "✓" : "Copy"}
            </button>
          </div>
          <pre className="hydro-popup-code">{info.fullLabel}</pre>
          {frames.length > 0 && (
            <>
              <div className="hydro-popup-row hydro-popup-row-full">
                <span className="hydro-popup-key">Backtrace</span>
                <button className="hydro-copy-btn" onClick={() => copyText(
                  (info.backtrace ?? []).map((f) => `${f.function} (${f.filename}:${f.lineNumber ?? "?"})`).join("\n"),
                  "bt"
                )}>
                  {copied === "bt" ? "✓" : "Copy"}
                </button>
              </div>
              <div className="hydro-popup-frames">
                {frames.map((f, i) => (
                  <div key={i} className="hydro-popup-frame">
                    <span className="hydro-popup-fn">{f.function ?? f.fn}</span>
                    <span className="hydro-popup-file">{f.filename ?? f.file}{f.lineNumber != null ? `:${f.lineNumber}` : ""}</span>
                  </div>
                ))}
                {(info.backtrace?.length ?? 0) > 5 && (
                  <div className="hydro-popup-frame-more">…{(info.backtrace?.length ?? 0) - 5} more frames</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Visual style config ---

type Intensity = "none" | "light" | "medium" | "heavy";

interface ElementStyle {
  color: string;
  shadow: Intensity;
  gradient: boolean;
}

interface VisualStyle {
  node: ElementStyle;
  collapsed: ElementStyle;
  synthetic: ElementStyle;
  containerStyle: Intensity;
  containerTint: string;
  edgeGlow: Intensity;
  edgeGlowColor: string;
}

const DEFAULT_VISUAL_STYLE: VisualStyle = {
  node: { color: "#f5f5f5", shadow: "heavy", gradient: true },
  collapsed: { color: "#475569", shadow: "heavy", gradient: true },
  synthetic: { color: "#7c8594", shadow: "heavy", gradient: true },
  containerStyle: "medium",
  containerTint: "#64e1f2",
  edgeGlow: "none",
  edgeGlowColor: "#6366f1",
};

// --- Sidebar Panel (search, legends, appearance) ---

function SidebarPanel({ data, search, onSearchChange, state, dispatch, visualStyle, onVisualStyleChange }: {
  data: HydroscopeData;
  search: string;
  onSearchChange: (q: string) => void;
  state: ReturnType<typeof initState>;
  dispatch: React.Dispatch<Action>;
  visualStyle: VisualStyle;
  onVisualStyleChange: (s: VisualStyle) => void;
}) {
  const [open, setOpen] = useState(false);

  const nodeTypeColors = useMemo(() => {
    const map = new Map<string, string>();
    if (data.nodeTypeConfig) {
      for (const t of data.nodeTypeConfig.types) map.set(t.id, nodeTypeColor(t.colorIndex));
    }
    return map;
  }, [data.nodeTypeConfig]);

  const searchHits = useMemo(() => searchAllNodes(state, search), [state, search]);
  const hiddenHits = useMemo(() => searchHits.filter((h) => h.hidden), [searchHits]);

  const revealAll = useCallback(() => {
    const ids = containersToExpand(state, hiddenHits.map((h) => h.node.id));
    if (ids.length > 0) dispatch({ type: "expand_to", containerIds: ids });
  }, [state, hiddenHits, dispatch]);

  if (!open) {
    return (
      <div className="hydro-sidebar-collapsed" onClick={() => setOpen(true)} title="Show controls">
        <span className="hydro-sidebar-caret">›</span>
      </div>
    );
  }

  return (
    <div className="hydro-sidebar">
      <div className="hydro-sidebar-header">
        <span>Panel</span>
        <button className="hydro-sidebar-close" onClick={() => setOpen(false)}>×</button>
      </div>

      {/* Search */}
      <div className="hydro-sidebar-search">
        <input className="hydroscope-search" type="text" placeholder="Search nodes..."
          value={search} onChange={(e) => onSearchChange(e.target.value)} />
        {search && (
          <div className="hydro-search-results">
            <span>{searchHits.length} match{searchHits.length !== 1 ? "es" : ""}</span>
            {hiddenHits.length > 0 && (
              <button className="hydro-reveal-btn" onClick={revealAll}
                title="Expand collapsed containers to reveal hidden matches">
                Reveal {hiddenHits.length} hidden
              </button>
            )}
          </div>
        )}
        {search && searchHits.length > 0 && (
          <div className="hydro-search-hits">
            {searchHits.slice(0, 50).map((hit) => (
              <SearchHitRow key={hit.node.id} hit={hit} state={state} dispatch={dispatch}
                containerNames={state.containers} />
            ))}
            {searchHits.length > 50 && (
              <div className="hydro-search-more">…and {searchHits.length - 50} more</div>
            )}
          </div>
        )}
      </div>

      {/* Node type legend */}
      {data.legend && (
        <Section title={data.legend.title ?? "Node Types"} defaultOpen={false}>
          <div className="hydro-legend">
            {data.legend.items.map((item) => (
              <div key={item.type} className="hydro-legend-item">
                <span className="hydro-legend-swatch" style={{ background: nodeTypeColors.get(item.type) ?? "#999" }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Edge style legend */}
      {data.edgeStyleConfig?.semanticMappings && (
        <Section title="Edge Styles" defaultOpen={false}>
          <EdgeStyleLegend mappings={data.edgeStyleConfig.semanticMappings} />
        </Section>
      )}

      {/* Appearance tuner */}
      <Section title="Appearance" defaultOpen={false}>
        <ElementStyleEditor label="Leaf nodes" value={visualStyle.node}
          onChange={(v) => onVisualStyleChange({ ...visualStyle, node: v })} />
        <ElementStyleEditor label="Collapsed containers" value={visualStyle.collapsed}
          onChange={(v) => onVisualStyleChange({ ...visualStyle, collapsed: v })} />
        <ElementStyleEditor label="Leaf bundles" value={visualStyle.synthetic}
          onChange={(v) => onVisualStyleChange({ ...visualStyle, synthetic: v })} />
        <label className="hydro-field">
          <span>Expanded containers</span>
          <div className="hydro-field-row">
            <select className="hydro-select" value={visualStyle.containerStyle}
              onChange={(e) => onVisualStyleChange({ ...visualStyle, containerStyle: e.target.value as Intensity })}>
              <option value="none">Plain</option>
              <option value="light">Tinted</option>
              <option value="medium">Gradient</option>
              <option value="heavy">Bold</option>
            </select>
            {visualStyle.containerStyle !== "none" && (
              <input type="color" className="hydro-color-picker" value={visualStyle.containerTint}
                onChange={(e) => onVisualStyleChange({ ...visualStyle, containerTint: e.target.value })} />
            )}
          </div>
        </label>
        <label className="hydro-field">
          <span>Edge glow</span>
          <div className="hydro-field-row">
            <select className="hydro-select" value={visualStyle.edgeGlow}
              onChange={(e) => onVisualStyleChange({ ...visualStyle, edgeGlow: e.target.value as Intensity })}>
              <option value="none">None</option>
              <option value="light">Subtle</option>
              <option value="medium">Glow</option>
              <option value="heavy">Neon</option>
            </select>
            {visualStyle.edgeGlow !== "none" && (
              <input type="color" className="hydro-color-picker" value={visualStyle.edgeGlowColor}
                onChange={(e) => onVisualStyleChange({ ...visualStyle, edgeGlowColor: e.target.value })} />
            )}
          </div>
        </label>
        <SaveStyleButton visualStyle={visualStyle} onReset={() => onVisualStyleChange(DEFAULT_VISUAL_STYLE)} />
      </Section>
    </div>
  );
}

// --- Custom controls (ControlButton children of ReactFlow Controls) ---

const DIRECTION_CYCLE: LayoutDirection[] = ["DOWN", "RIGHT", "UP", "LEFT"];
const ALGORITHM_CYCLE: LayoutAlgorithm[] = ["layered", "mrtree", "stress", "force"];
const ALGORITHM_TITLES: Record<LayoutAlgorithm, string> = { layered: "Layered (Sugiyama)", mrtree: "MR Tree", stress: "Stress", force: "Force" };

const CollapseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="16" height="16" fill="currentColor">
    <path d="M48.68,170.67c30.01-3,69.24,1.26,99.98,1.2l-.47,44.47c-31.79-.64-85.93-5.15-91.45,31.65-8.5,56.73,5.61,129.95.95,188.29,4.46,11.9,12.64,21.32,26.06,26.84,108.97,7.41,220.75,1.13,330.73,3.21,20.07-2.42,37.72-16.78,40.27-34.05,8.32-56.31-6.25-127.27,0-185.09-11.77-36.93-54.69-30.94-90.5-30.85l-.47-45.27c31.13,1.64,69.66-3.56,99.98-.4,23.16,2.42,42.04,19.44,45.01,38.86-7.67,83.32,10.23,180.25,0,262.01-2.57,20.51-19.89,36.92-44.07,40.46H46.78c-26.2-4.46-41.74-21.6-44.07-43.67-8.55-81.04,6.41-172.67,0-254.8,1.08-21.27,20.53-40.32,45.96-42.87h.01Z"/>
    <path d="M258.31,429.8c-.72.25-4.19.29-4.81,0-5.19-2.36-56.57-122.05-66.1-135.93-3.69-24.83,25.3-7.28,33.65-15.32V11.79c1.18-4.89,3.41-9.69,6.81-10.85,3.66-1.26,53.37-1.27,56.89,0,.82.3,4.76,4.33,5.21,5.75l.8,271.87c9.31,8.06,42.87-10.94,32.05,20.42-5.44,15.77-52.12,113.24-60.09,125.08-1.07,1.58-3.09,5.29-4.41,5.75v-.02Z"/>
  </svg>
);

const ExpandIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="16" height="16" fill="currentColor">
    <path d="M48.68,170.67c30.01-3,69.24,1.26,99.98,1.2l-.47,44.47c-31.79-.64-85.93-5.15-91.45,31.65-8.5,56.73,5.61,129.95.95,188.29,4.46,11.9,12.64,21.32,26.06,26.84,108.97,7.41,220.75,1.13,330.73,3.21,20.07-2.42,37.72-16.78,40.27-34.05,8.32-56.31-6.25-127.27,0-185.09-11.77-36.93-54.69-30.94-90.5-30.85l-.47-45.27c31.13,1.64,69.66-3.56,99.98-.4,23.16,2.42,42.04,19.44,45.01,38.86-7.67,83.32,10.23,180.25,0,262.01-2.57,20.51-19.89,36.92-44.07,40.46H46.78c-26.2-4.46-41.74-21.6-44.07-43.67-8.55-81.04,6.41-172.67,0-254.8,1.08-21.27,20.53-40.32,45.96-42.87h.01Z"/>
    <path d="M253.7.2c.72-.25,4.19-.29,4.81,0,5.19,2.36,56.57,122.05,66.1,135.93,3.69,24.83-25.3,7.28-33.65,15.32v266.76c-1.18,4.89-3.41,9.69-6.81,10.85-3.66,1.26-53.37,1.27-56.89,0-.82-.3-4.76-4.33-5.21-5.75l-.8-271.87c-9.31-8.06-42.87,10.94-32.05-20.42,5.44-15.77,52.12-113.24,60.09-125.08,1.07-1.58,3.09-5.29,4.41-5.75v.02Z"/>
  </svg>
);

const DirectionIcon = ({ direction }: { direction: LayoutDirection }) => {
  const rot: Record<LayoutDirection, number> = { DOWN: 0, RIGHT: 270, UP: 180, LEFT: 90 };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="12" height="12" fill="currentColor"
      style={{ transform: `rotate(${rot[direction]}deg)` }}>
      <path d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1z"/>
    </svg>
  );
};

/** Tiny graph layout icons — each shows a characteristic node arrangement */
const AlgorithmIcon = ({ algorithm }: { algorithm: LayoutAlgorithm }) => {
  const r = 1.3;
  const icons: Record<LayoutAlgorithm, React.ReactElement> = {
    layered: (
      <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
        <circle cx="5" cy="3" r={r}/><circle cx="11" cy="3" r={r}/>
        <circle cx="4" cy="8" r={r}/><circle cx="8" cy="8" r={r}/><circle cx="12" cy="8" r={r}/>
        <circle cx="6" cy="13" r={r}/><circle cx="10" cy="13" r={r}/>
        <line x1="5" y1="4.3" x2="4" y2="6.7" stroke="currentColor" strokeWidth="0.7"/>
        <line x1="5" y1="4.3" x2="8" y2="6.7" stroke="currentColor" strokeWidth="0.7"/>
        <line x1="11" y1="4.3" x2="12" y2="6.7" stroke="currentColor" strokeWidth="0.7"/>
        <line x1="8" y1="9.3" x2="6" y2="11.7" stroke="currentColor" strokeWidth="0.7"/>
        <line x1="12" y1="9.3" x2="10" y2="11.7" stroke="currentColor" strokeWidth="0.7"/>
      </svg>
    ),
    mrtree: (
      <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
        <circle cx="8" cy="2.5" r={r}/>
        <circle cx="4" cy="8" r={r}/><circle cx="12" cy="8" r={r}/>
        <circle cx="2" cy="13.5" r={r}/><circle cx="6" cy="13.5" r={r}/>
        <circle cx="10" cy="13.5" r={r}/><circle cx="14" cy="13.5" r={r}/>
        <line x1="8" y1="3.8" x2="4" y2="6.7" stroke="currentColor" strokeWidth="0.7"/>
        <line x1="8" y1="3.8" x2="12" y2="6.7" stroke="currentColor" strokeWidth="0.7"/>
        <line x1="4" y1="9.3" x2="2" y2="12.2" stroke="currentColor" strokeWidth="0.7"/>
        <line x1="4" y1="9.3" x2="6" y2="12.2" stroke="currentColor" strokeWidth="0.7"/>
        <line x1="12" y1="9.3" x2="10" y2="12.2" stroke="currentColor" strokeWidth="0.7"/>
        <line x1="12" y1="9.3" x2="14" y2="12.2" stroke="currentColor" strokeWidth="0.7"/>
      </svg>
    ),
    stress: (
      <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
        <circle cx="3" cy="4" r={r}/><circle cx="10" cy="2.5" r={r}/>
        <circle cx="13" cy="7" r={r}/><circle cx="6" cy="9" r={r}/>
        <circle cx="2" cy="13" r={r}/><circle cx="11" cy="13" r={r}/>
        <line x1="3" y1="4" x2="10" y2="2.5" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="10" y1="2.5" x2="13" y2="7" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="3" y1="4" x2="6" y2="9" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="6" y1="9" x2="11" y2="13" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="6" y1="9" x2="2" y2="13" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="13" y1="7" x2="11" y2="13" stroke="currentColor" strokeWidth="0.5"/>
      </svg>
    ),
    force: (
      <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
        <circle cx="8" cy="2" r={r}/>
        <circle cx="13" cy="5.5" r={r}/><circle cx="3" cy="5.5" r={r}/>
        <circle cx="12" cy="11.5" r={r}/><circle cx="4" cy="11.5" r={r}/>
        <circle cx="8" cy="14" r={r}/>
        <line x1="8" y1="2" x2="13" y2="5.5" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="8" y1="2" x2="3" y2="5.5" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="3" y1="5.5" x2="4" y2="11.5" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="13" y1="5.5" x2="12" y2="11.5" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="4" y1="11.5" x2="8" y2="14" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="12" y1="11.5" x2="8" y2="14" stroke="currentColor" strokeWidth="0.5"/>
      </svg>
    ),
  };
  return icons[algorithm];
};

function GraphControlButtons({ layoutOpts, onLayoutChange, dispatch }: {
  layoutOpts: LayoutOptions;
  onLayoutChange: (opts: LayoutOptions) => void;
  dispatch: React.Dispatch<Action>;
}) {
  const cycleDirection = useCallback(() => {
    const idx = DIRECTION_CYCLE.indexOf(layoutOpts.direction);
    const next = DIRECTION_CYCLE[(idx + 1) % DIRECTION_CYCLE.length];
    onLayoutChange({ ...layoutOpts, direction: next });
  }, [layoutOpts, onLayoutChange]);

  const cycleAlgorithm = useCallback(() => {
    const idx = ALGORITHM_CYCLE.indexOf(layoutOpts.algorithm);
    const next = ALGORITHM_CYCLE[(idx + 1) % ALGORITHM_CYCLE.length];
    onLayoutChange({ ...layoutOpts, algorithm: next });
  }, [layoutOpts, onLayoutChange]);

  return (
    <>
      <ControlButton onClick={() => dispatch({ type: "expand_all" })} title="Expand all containers"><ExpandIcon /></ControlButton>
      <ControlButton onClick={() => dispatch({ type: "collapse_all" })} title="Collapse all containers"><CollapseIcon /></ControlButton>
      <ControlButton onClick={cycleDirection} title={`Layout direction: ${layoutOpts.direction}`}><DirectionIcon direction={layoutOpts.direction} /></ControlButton>
      <ControlButton onClick={cycleAlgorithm} title={ALGORITHM_TITLES[layoutOpts.algorithm]}><AlgorithmIcon algorithm={layoutOpts.algorithm} /></ControlButton>
    </>
  );
}

function SearchHitRow({ hit, state, dispatch, containerNames }: {
  hit: SearchHit;
  state: ReturnType<typeof initState>;
  dispatch: React.Dispatch<Action>;
  containerNames: Map<string, { name: string }>;
}) {
  const reveal = useCallback(() => {
    const ids = containersToExpand(state, [hit.node.id]);
    if (ids.length > 0) dispatch({ type: "expand_to", containerIds: ids });
  }, [state, hit.node.id, dispatch]);

  const path = hit.containerPath.map((id) => containerNames.get(id)?.name ?? id).join(" › ");

  return (
    <div className={`hydro-search-hit ${hit.hidden ? "hydro-search-hit-hidden" : ""}`}>
      <div className="hydro-search-hit-label" title={hit.node.fullLabel}>
        {hit.node.shortLabel}
      </div>
      {path && <div className="hydro-search-hit-path">{path}</div>}
      {hit.hidden && (
        <button className="hydro-search-hit-reveal" onClick={reveal} title="Expand to reveal">⤵</button>
      )}
    </div>
  );
}

function ElementStyleEditor({ label, value, onChange }: {
  label: string; value: ElementStyle; onChange: (v: ElementStyle) => void;
}) {
  return (
    <div className="hydro-element-style">
      <div className="hydro-element-style-label">{label}</div>
      <div className="hydro-element-style-controls">
        <input type="color" className="hydro-color-picker" value={value.color}
          onChange={(e) => onChange({ ...value, color: e.target.value })} />
        <select className="hydro-select hydro-select-sm" value={value.shadow}
          onChange={(e) => onChange({ ...value, shadow: e.target.value as Intensity })}>
          <option value="none">Flat</option>
          <option value="light">Light</option>
          <option value="medium">Med</option>
          <option value="heavy">Heavy</option>
        </select>
        <label className="hydro-toggle-inline" title="Gradient">
          <input type="checkbox" checked={value.gradient}
            onChange={(e) => onChange({ ...value, gradient: e.target.checked })} />
          <span>G</span>
        </label>
      </div>
    </div>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="hydro-section">
      <div className="hydro-section-header" onClick={() => setOpen(!open)}>
        <span className={`hydro-section-arrow ${open ? "hydro-section-arrow-open" : ""}`}>▶</span>
        <span>{title}</span>
      </div>
      {open && <div className="hydro-section-body">{children}</div>}
    </div>
  );
}

function SaveStyleButton({ visualStyle, onReset }: { visualStyle: VisualStyle; onReset: () => void }) {
  const [saved, setSaved] = useState(false);
  const save = useCallback(() => {
    const json = JSON.stringify(visualStyle, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }).catch(() => {});
  }, [visualStyle]);
  return (
    <div className="hydro-save-row">
      <button className="hydro-sidebar-btn hydro-save-btn" onClick={save}>
        {saved ? "✓ Copied" : "Save config"}
      </button>
      <button className="hydro-sidebar-btn hydro-reset-btn" onClick={onReset}>Reset</button>
    </div>
  );
}

function EdgeStyleLegend({ mappings }: { mappings: Record<string, Record<string, Record<string, string>>> }) {
  const groups = useMemo(() => {
    const result: { group: string; items: { tag: string; color: string; dashed: boolean; animated: boolean; hashMarks: boolean; wavy: boolean }[] }[] = [];
    for (const [groupName, tags] of Object.entries(mappings)) {
      const items: typeof result[0]["items"] = [];
      for (const [tagName, props] of Object.entries(tags)) {
        let color = "#666", dashed = false, animated = false, hashMarks = false, wavy = false;
        for (const [k, v] of Object.entries(props)) {
          if (k === "color") color = v;
          else if (k === "line-pattern" && v === "dashed") dashed = true;
          else if (k === "animation" && v === "animated") animated = true;
          else if (k === "line-style" && v === "hash-marks") hashMarks = true;
          else if (k === "waviness" && v === "wavy") wavy = true;
        }
        // Only show items that have a visible style effect
        if (color !== "#666" || dashed || animated || hashMarks || wavy) {
          items.push({ tag: tagName, color, dashed, animated, hashMarks, wavy });
        }
      }
      if (items.length > 0) result.push({ group: groupName.replace(/Group$/, ""), items });
    }
    return result;
  }, [mappings]);

  return (
    <div className="hydro-edge-legend">
      {groups.map((g) => (
        <div key={g.group} className="hydro-edge-legend-group">
          <div className="hydro-edge-legend-group-name">{g.group}</div>
          {g.items.map((item) => (
            <div key={item.tag} className="hydro-edge-legend-item">
              <svg width="40" height="16" className="hydro-edge-preview">
                <EdgePreviewLine color={item.color} dashed={item.dashed} hashMarks={item.hashMarks} wavy={item.wavy} />
              </svg>
              <span className="hydro-edge-legend-tag">{item.tag}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function EdgePreviewLine({ color, dashed, hashMarks, wavy }: { color: string; dashed: boolean; hashMarks: boolean; wavy: boolean }) {
  const y = 8;
  const path = wavy ? `M2,${y} Q10,${y - 4} 18,${y} Q26,${y + 4} 34,${y}` : `M2,${y} L38,${y}`;
  return (
    <>
      <path d={path} stroke={color} strokeWidth={2} fill="none"
        strokeDasharray={dashed ? "4,3" : undefined} />
      {hashMarks && (
        <>
          <line x1={14} y1={y - 4} x2={14} y2={y + 4} stroke={color} strokeWidth={1.5} />
          <line x1={26} y1={y - 4} x2={26} y2={y + 4} stroke={color} strokeWidth={1.5} />
        </>
      )}
      {/* Arrowhead */}
      <polygon points={`38,${y} 33,${y - 3} 33,${y + 3}`} fill={color} />
    </>
  );
}

// --- Core component ---

const nodeTypes: NodeTypes = { hydro: DataflowNode, group: ContainerNodeComponent, collapsed: CollapsedContainerNode };
const edgeTypes: EdgeTypes = { hydro: HydroEdge as any };

function HydroscopeCoreInner({ data, containerWidth, containerHeight, onClose }: { data: HydroscopeData; containerWidth: number; containerHeight: number; onClose?: () => void }) {
  const [state, dispatch] = useReducer(reducer, data, initState);
  const [layout, setLayout] = useState<LayoutResult | null>(null);
  const [search, setSearch] = useState("");
  const [layoutOpts, setLayoutOpts] = useState<LayoutOptions>(DEFAULT_LAYOUT_OPTIONS);
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeInfo, setSelectedNodeInfo] = useState<NodeInfoData | null>(null);
  const [visualStyle, setVisualStyle] = useState<VisualStyle>(DEFAULT_VISUAL_STYLE);
  const { fitView } = useReactFlow();
  const layoutVersion = useRef(0);

  useEffect(() => { dispatch({ type: "load", data }); }, [data]);

  // Run headless ELK pass to get container sizes, then auto-expand
  const autoExpandRan = useRef(false);
  useEffect(() => {
    if (autoExpandRan.current) return;
    autoExpandRan.current = true;
    const allNodes = [...state.nodes.values()];
    const allContainers = [...state.containers.values()];
    if (allContainers.length === 0) return;
    computeContainerSizes(allNodes, state.edges, allContainers).then((sizes) => {
      if (sizes.size > 0) dispatch({ type: "auto_expand", containerSizes: sizes });
    }).catch(() => {});
  }, [state.nodes, state.containers, state.edges]);

  const visibleNodes = useMemo(() => getVisibleNodes(state), [state]);
  const visibleEdges = useMemo(() => getVisibleEdges(state), [state]);
  const visibleContainers = useMemo(() => getVisibleContainers(state), [state]);
  const leafCounts = useMemo(() => getContainerLeafCounts(state), [state]);

  const nodeTypeColors = useMemo(() => {
    const map = new Map<string, string>();
    if (data.nodeTypeConfig) {
      for (const t of data.nodeTypeConfig.types) map.set(t.id, nodeTypeColor(t.colorIndex));
    }
    return map;
  }, [data.nodeTypeConfig]);

  // Search matches among visible nodes (for highlighting)
  const searchLower = search.toLowerCase();
  const searchMatches = useMemo(
    () => search ? new Set(visibleNodes.filter((n) =>
      n.label.toLowerCase().includes(searchLower) || n.fullLabel.toLowerCase().includes(searchLower)
    ).map((n) => n.id)) : null,
    [visibleNodes, searchLower, search],
  );

  useEffect(() => {
    const version = ++layoutVersion.current;
    layoutGraph(visibleNodes, visibleEdges, visibleContainers, state.collapsed, layoutOpts).then((result) => {
      if (version === layoutVersion.current) {
        setLayout(result);
        setTimeout(() => fitView({ padding: 0.1, duration: 200 }), 100);
      }
    }).catch(() => {});
  }, [visibleNodes, visibleEdges, visibleContainers, state.collapsed, layoutOpts]);

  // Build ReactFlow nodes
  useEffect(() => {
    if (!layout) return;
    const nodes: Node[] = [];

    const sortedContainers = [...visibleContainers].sort((a, b) => {
      if (!a.parentId && b.parentId) return -1;
      if (a.parentId && !b.parentId) return 1;
      return 0;
    });

    const containerPositions = layout.containerPositions;

    for (const container of sortedContainers) {
      const pos = containerPositions.get(container.id);
      if (!pos) continue;
      const isSynthetic = container.id.startsWith("__syn_");
      const isCollapsed = state.collapsed.has(container.id) || isSynthetic;

      let x = pos.x, y = pos.y;
      if (container.parentId) {
        const parentPos = containerPositions.get(container.parentId);
        if (parentPos) { x -= parentPos.x; y -= parentPos.y; }
      }

      const color = isSynthetic ? visualStyle.synthetic.color : visualStyle.collapsed.color;
      const elemStyle = isSynthetic ? visualStyle.synthetic : visualStyle.collapsed;

      nodes.push({
        id: container.id,
        type: isCollapsed ? "collapsed" : "group",
        position: { x, y },
        draggable: true,
        data: { label: container.name, isCollapsed, locationType: container.locationType,
          collapsedColor: color, elemStyle, leafCount: leafCounts.get(container.id) ?? container.nodeIds.length,
          hasDissolved: !isCollapsed && state.dissolvedSynthetics.has(`__syn_${container.id}`),
          onRebundle: () => dispatch({ type: "toggle_synthetic", syntheticId: `__syn_${container.id}` }),
        },
        style: isCollapsed ? { width: COLLAPSED_WIDTH, height: COLLAPSED_HEIGHT } : { width: pos.width, height: pos.height, padding: 0 },
        ...(container.parentId && containerPositions.has(container.parentId)
          ? { parentId: container.parentId } : {}),
      });
    }

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
        draggable: true,
        data: {
          label: node.shortLabel, fullLabel: node.fullLabel, nodeType: node.nodeType,
          typeColor: nodeTypeColors.get(node.nodeType),
          highlighted, dimmed: searchMatches !== null && !highlighted,
          onInfo: () => setSelectedNodeInfo({
            id: node.id, label: node.shortLabel, fullLabel: node.fullLabel,
            nodeType: node.nodeType, locationType: node.data?.locationType,
            backtrace: node.data?.backtrace,
          }),
        },
        ...(node.parentId && containerPositions.has(node.parentId)
          ? { parentId: node.parentId, extent: "parent" as const } : {}),
      });
    }
    setRfNodes(nodes);
  }, [layout, visibleNodes, visibleContainers, state.collapsed, searchMatches, nodeTypeColors, visualStyle.collapsed, visualStyle.synthetic]);

  // Build ReactFlow edges
  useEffect(() => {
    if (!layout) return;
    setRfEdges(visibleEdges.map((edge) => {
      const s = resolveEdgeStyle(edge.semanticTags, data.edgeStyleConfig);
      return {
        id: edge.id, source: edge.source, target: edge.target, type: "hydro", animated: s.animated,
        markerEnd: { type: MarkerType.ArrowClosed, color: s.color, width: ARROW_SIZE, height: ARROW_SIZE },
        data: { color: s.color, strokeDasharray: s.strokeDasharray, lineStyle: s.lineStyle,
          count: edge.count, label: edge.label } satisfies HydroEdgeData,
      };
    }));
  }, [layout, visibleEdges, data.edgeStyleConfig]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.id.startsWith("__syn_")) {
      dispatch({ type: "toggle_synthetic", syntheticId: node.id });
    } else if (state.containers.has(node.id)) {
      dispatch({ type: "toggle_collapse", containerId: node.id });
    }
  }, [state.containers]);

  const toolbarHeight = 37;
  const flowHeight = containerHeight - toolbarHeight;

  const styleClasses = [
    "hydro-layout",
    visualStyle.node.shadow !== "none" && `hydro-shadow-${visualStyle.node.shadow}`,
    visualStyle.node.gradient && "hydro-node-gradient",
    visualStyle.containerStyle !== "none" && `hydro-container-${visualStyle.containerStyle}`,
    visualStyle.edgeGlow !== "none" && `hydro-glow-${visualStyle.edgeGlow}`,
  ].filter(Boolean).join(" ");

  const styleVars = {
    "--hydro-container-tint": visualStyle.containerTint,
    "--hydro-glow-color": visualStyle.edgeGlowColor,
    "--hydro-collapsed-w": `${COLLAPSED_WIDTH}px`,
    "--hydro-collapsed-h": `${COLLAPSED_HEIGHT}px`,
  } as React.CSSProperties;

  return (
    <div className={styleClasses} style={styleVars}>
      <SidebarPanel data={data} search={search} onSearchChange={setSearch}
        state={state} dispatch={dispatch}
        visualStyle={visualStyle} onVisualStyleChange={setVisualStyle} />
      <div className="hydro-main">
        <div className="hydroscope-toolbar">
          {data.hierarchyChoices.length > 1 && (
            <select className="hydro-toolbar-hierarchy" value={state.hierarchyId}
              onChange={(e) => dispatch({ type: "set_hierarchy", hierarchyId: e.target.value })}>
              {data.hierarchyChoices.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <div className="hydro-toolbar-stats">
            {visibleNodes.length} nodes · {visibleEdges.length} edges
            {searchMatches && ` · ${searchMatches.size} visible matches`}
          </div>
          {onClose && (
            <button className="hydro-toolbar-close" onClick={onClose} title="Close file">✕ Close</button>
          )}
        </div>
        <div style={{ width: "100%", height: flowHeight > 0 ? flowHeight : 400 }}>
          <ReactFlow nodes={rfNodes} edges={rfEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick} fitView minZoom={0.05} maxZoom={2}
            nodesDraggable panOnDrag panOnScroll={false} zoomOnScroll zoomOnPinch
            proOptions={{ hideAttribution: true }}>
            <Background />
            <Controls>
              <GraphControlButtons layoutOpts={layoutOpts} onLayoutChange={setLayoutOpts} dispatch={dispatch} />
            </Controls>
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
      </div>
      {selectedNodeInfo && (
        <NodeInfoPopup info={selectedNodeInfo} onClose={() => setSelectedNodeInfo(null)} />
      )}
    </div>
  );
}

// --- Wrapper ---

export function HydroscopeCore({ data, width = "100%", height = "100%", onClose }: HydroscopeCoreProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
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
          <HydroscopeCoreInner data={data} containerWidth={size[0]} containerHeight={size[1]} onClose={onClose} />
        </ReactFlowProvider>
      )}
    </div>
  );
}

// --- Top-level component with file upload ---

export function Hydroscope({ data, width = "100%", height = "100%", responsive, onFileUpload }: HydroscopeProps) {
  const [fileData, setFileData] = useState<HydroscopeData | null>(null);
  const [urlLoading, setUrlLoading] = useState(true);
  const [cleared, setCleared] = useState(false);
  const activeData = cleared ? null : (data ?? fileData);

  // Reset cleared state when new data prop arrives
  useEffect(() => { if (data) setCleared(false); }, [data]);

  useEffect(() => {
    parseDataFromUrl().then((d) => {
      if (d) setFileData(d);
    }).catch(() => {}).finally(() => setUrlLoading(false));
  }, []);

  const handleClose = useCallback(() => {
    setFileData(null);
    setCleared(true);
  }, []);

  const handleFile = useCallback((file: File) => {
    file.text().then((text) => {
      try {
        const parsed = parseHydroscopeData(text);
        setFileData(parsed);
        setCleared(false);
        onFileUpload?.(parsed, file.name);
      } catch { /* parse error */ }
    });
  }, [onFileUpload]);

  const style: React.CSSProperties = {
    width: responsive ? "100%" : width,
    height: responsive ? "100%" : height,
  };

  if (!activeData) {
    if (urlLoading) {
      return (
        <div style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
          <span style={{ color: "#888" }}>Loading…</span>
        </div>
      );
    }
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
      <HydroscopeCore data={activeData} width="100%" height="100%"
        onClose={handleClose} />
    </div>
  );
}
