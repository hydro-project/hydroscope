import React, { createContext, useContext } from 'react';
import { UI_CONSTANTS, PANEL_CONSTANTS } from '../shared/config';

export type EdgeStyleKind = 'bezier' | 'straight' | 'smoothstep';

export interface StyleConfig {
  edgeStyle?: EdgeStyleKind;
  edgeColor?: string;
  edgeWidth?: number;
  edgeDashed?: boolean;

  nodeBorderRadius?: number;
  nodePadding?: number;
  nodeFontSize?: number; // px

  containerBorderRadius?: number;
  containerBorderWidth?: number;
  containerShadow?: 'LIGHT' | 'MEDIUM' | 'LARGE' | 'NONE';
}

const defaultStyleConfig: StyleConfig = {
  edgeStyle: 'bezier',
  edgeColor: '#1976d2',
  edgeWidth: UI_CONSTANTS.EDGE_STROKE_WIDTH,
  edgeDashed: false,

  nodeBorderRadius: PANEL_CONSTANTS.COMPONENT_BORDER_RADIUS,
  nodePadding: PANEL_CONSTANTS.COMPONENT_PADDING,
  nodeFontSize: PANEL_CONSTANTS.FONT_SIZE_SMALL,

  containerBorderRadius: 8, // Keep as 8 since it's different from general component border radius
  containerBorderWidth: UI_CONSTANTS.BORDER_WIDTH_DEFAULT,
  containerShadow: 'LIGHT',
};

const StyleConfigContext = createContext<StyleConfig>(defaultStyleConfig);

export function StyleConfigProvider({
  value,
  children,
}: {
  value?: StyleConfig;
  children: React.ReactNode;
}) {
  return (
    <StyleConfigContext.Provider value={{ ...defaultStyleConfig, ...(value || {}) }}>
      {children}
    </StyleConfigContext.Provider>
  );
}

export function useStyleConfig(): StyleConfig {
  return useContext(StyleConfigContext);
}
