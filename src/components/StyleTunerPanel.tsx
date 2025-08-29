import React, { useState, useEffect } from 'react';
import { Button, Divider } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { LAYOUT_CONSTANTS } from '../shared/config';

type EdgeStyleKind = 'bezier' | 'straight' | 'smoothstep';

// Layout algorithm options (matching ELK's available algorithms)
const layoutOptions = {
  'mrtree': 'MR Tree (Default)',
  'layered': 'Layered',
  'force': 'Force-Directed',
  'stress': 'Stress Minimization',
  'radial': 'Radial'
};

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
    reactFlowControlsScale?: number;
  };
  onChange: (next: {
    edgeStyle?: EdgeStyleKind;
    edgeWidth?: number;
    edgeDashed?: boolean;
    nodePadding?: number;
    nodeFontSize?: number;
    containerBorderWidth?: number;
    reactFlowControlsScale?: number;
  }) => void;
  colorPalette?: string;
  onPaletteChange?: (palette: string) => void;
  currentLayout?: string;
  onLayoutChange?: (layout: string) => void;
  onResetToDefaults?: () => void;
  defaultCollapsed?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function StyleTunerPanel({ 
  value,
  onChange,
  colorPalette = 'Set2',
  onPaletteChange,
  currentLayout = 'layered',
  onLayoutChange,
  onResetToDefaults,
  defaultCollapsed = false,
  open = true,
  onOpenChange
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

  // Custom button style for open/close, matching CustomControls
  const controlButtonStyle: React.CSSProperties = {
    fontSize: 18,
    color: '#222',
    marginLeft: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid #3b82f6',
    borderRadius: 4,
    boxShadow: '0 1px 4px rgba(59,130,246,0.08)',
    transition: 'background 0.18s, box-shadow 0.18s',
    padding: '2px 8px',
    outline: 'none',
    cursor: 'pointer',
  };

  // Add hover/focus effect via inline event handlers
  const [btnHover, setBtnHover] = useState(false);
  const [btnFocus, setBtnFocus] = useState(false);
  const mergedButtonStyle = {
    ...controlButtonStyle,
    backgroundColor: btnHover || btnFocus ? 'rgba(59,130,246,0.18)' : controlButtonStyle.backgroundColor,
    boxShadow: btnHover || btnFocus ? '0 2px 8px rgba(59,130,246,0.16)' : controlButtonStyle.boxShadow,
    borderColor: btnHover || btnFocus ? '#2563eb' : '#3b82f6',
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 10, // position to occlude the button
        right: 8, // further right, nearly flush with edge
        zIndex: 1200, // higher than button
        minWidth: 280,
        maxWidth: 340,
        background: '#fff',
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        borderRadius: 2,
        border: '1px solid #eee',
        padding: 20,
        transition: 'transform 0.3s cubic-bezier(.4,0,.2,1), opacity 0.2s',
        transform: open ? 'translateX(0)' : 'translateX(120%)', // slide from right
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 16 }}>Style Tuner</span>
        <Button
          type="text"
          size="small"
          onClick={() => onOpenChange?.(false)}
          style={mergedButtonStyle}
          onMouseEnter={() => setBtnHover(true)}
          onMouseLeave={() => setBtnHover(false)}
          onFocus={() => setBtnFocus(true)}
          onBlur={() => setBtnFocus(false)}
        >
          ×
        </Button>
      </div>
      <div style={{ fontSize: '12px' }}>
        <div style={rowStyle}>
          <label>Layout Algorithm</label>
          <select
            value={currentLayout}
            style={inputStyle}
            onChange={(e) => onLayoutChange?.(e.target.value)}
          >
            {Object.entries(layoutOptions).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
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
        <div style={rowStyle}>
          <label>Controls Scale</label>
          <input
            type="range"
            min="0.8"
            max="1.9"
            step="0.1"
            value={local.reactFlowControlsScale || LAYOUT_CONSTANTS.REACTFLOW_CONTROLS_SCALE}
            onChange={(e) => update({ reactFlowControlsScale: parseFloat(e.target.value) })}
            style={{ ...inputStyle, cursor: 'pointer' }}
            title={`Scale: ${(local.reactFlowControlsScale || LAYOUT_CONSTANTS.REACTFLOW_CONTROLS_SCALE).toFixed(1)}x`}
          />
        </div>
        <Divider style={{ margin: '16px 0 12px 0' }} />
        <Button 
          type="default"
          icon={<ReloadOutlined />}
          onClick={onResetToDefaults}
          block
          size="small"
          style={{ fontSize: '12px' }}
        >
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}

export default StyleTunerPanel;
