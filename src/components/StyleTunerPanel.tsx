import React, { useState, useEffect } from 'react';
import { AntDockablePanel } from './AntDockablePanel';

type EdgeStyleKind = 'bezier' | 'straight' | 'smoothstep';

// Color palette options
const paletteOptions = {
  'Set2': 'Set2',
  'Set3': 'Set3', 
  'Pastel1': 'Pastel1',
  'Dark2': 'Dark2'
};

export interface StyleTunerPanelProps {
  // Feed and control the FlowGraph RenderConfig style fields
  value: {
    edgeStyle?: EdgeStyleKind;
    edgeWidth?: number;
    edgeDashed?: boolean;
    nodePadding?: number;
    nodeFontSize?: number;
    containerBorderWidth?: number;
  };
  onChange: (next: StyleTunerPanelProps['value']) => void;
  colorPalette?: string;
  onPaletteChange?: (palette: string) => void;
  defaultCollapsed?: boolean;
}

export function StyleTunerPanel({ 
  value, 
  onChange, 
  colorPalette = 'Set2',
  onPaletteChange,
  defaultCollapsed = false 
}: StyleTunerPanelProps) {
  const [local, setLocal] = useState(value);

  useEffect(() => setLocal(value), [value]);

  const update = (patch: Partial<typeof local>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onChange(next);
  };

  const inputStyle: React.CSSProperties = {
    padding: '4px 8px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    backgroundColor: '#fff',
    fontSize: '12px',
    width: '100%'
  };

  const rowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 120px',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px'
  };


  return (
    <AntDockablePanel
      title="Style Tuner"
      defaultOpen={!defaultCollapsed}
      placement="right"
      width={300}
    >
      <div style={{ fontSize: '12px' }}>
        <div style={rowStyle}>
          <label>Edge Style</label>
          <select
            value={local.edgeStyle || 'bezier'}
            style={inputStyle}
            onChange={(e) => update({ edgeStyle: e.target.value as EdgeStyleKind })}
          >
            <option value="bezier">Bezier</option>
            <option value="straight">Straight</option>
            <option value="smoothstep">SmoothStep</option>
          </select>
        </div>


        <div style={rowStyle}>
          <label>Color Palette</label>
          <select 
            value={colorPalette} 
            onChange={(e) => onPaletteChange?.(e.target.value)}
            style={inputStyle}
          >
            {Object.entries(paletteOptions).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <hr />

        <div style={rowStyle}>
          <label>Node Padding</label>
          <input
            type="range" min={4} max={32}
            value={local.nodePadding ?? 12}
            onChange={(e) => {
              update({ nodePadding: parseInt(e.target.value, 10) });
            }}
          />
        </div>

        <div style={rowStyle}>
          <label>Node Font Size</label>
          <input
            type="range" min={10} max={20}
            value={local.nodeFontSize ?? 12}
            onChange={(e) => {
              update({ nodeFontSize: parseInt(e.target.value, 10) });
            }}
          />
        </div>

        <hr />

        <div style={rowStyle}>
          <label>Container Border Width</label>
          <input
            type="range" min={1} max={6}
            value={local.containerBorderWidth ?? 2}
            onChange={(e) => update({ containerBorderWidth: parseInt(e.target.value, 10) })}
          />
        </div>
      </div>
    </AntDockablePanel>
  );
}

export default StyleTunerPanel;
