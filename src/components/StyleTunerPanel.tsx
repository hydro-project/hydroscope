import React, { useState, useEffect } from 'react';
import { Drawer, Button, Divider } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

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
  };
  onChange: (next: StyleTunerPanelProps['value']) => void;
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


  return (
    <Drawer
      title="Style Tuner"
      placement="right"
      open={open}
      onClose={() => onOpenChange?.(false)}
      width={300}
      mask={false}
      rootClassName="hydro-custom-drawer"
      style={{ zIndex: 1100, height: 'auto', maxHeight: 'none', boxShadow: 'none', background: 'transparent' }}
      bodyStyle={{ height: 'auto', maxHeight: '90vh', overflow: 'auto', background: '#fff', boxShadow: 'none' }}
    >
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

        <hr />

        {/* Reset to Defaults Button */}
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
    </Drawer>
  );
}

export default StyleTunerPanel;
