import React from "react";
// import { Handle, Position } from "@xyflow/react";
import { HandlesRenderer } from "../../render/handles";

export interface StandardNodeProps {
  data: {
    label: string;
    longLabel?: string;
    showingLongLabel?: boolean;
    nodeType: string;
    semanticTags?: string[];
    onClick?: (elementId: string, elementType: "node" | "container") => void;
  };
  id: string;
  style?: React.CSSProperties; // Add style prop to receive ReactFlow styles
}

export const StandardNode: React.FC<StandardNodeProps> = ({ data, id, style }) => {
  const handleClick = () => {
    if (data.onClick) {
      data.onClick(id, "node");
    }
  };

  // Default styles that can be overridden by ReactFlow styles (for highlights)
  const defaultStyle: React.CSSProperties = {
    padding: "8px 12px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    backgroundColor: "white",
    cursor: "pointer",
    minWidth: "80px",
    textAlign: "center",
    fontSize: "12px",
  };

  // Merge default styles with ReactFlow styles (ReactFlow styles take precedence)
  const mergedStyle = { ...defaultStyle, ...style };

  return (
    <div
      onClick={handleClick}
      style={mergedStyle}
    >
      <HandlesRenderer />
      <div>{data.showingLongLabel ? data.longLabel : data.label}</div>
    </div>
  );
};

export const MemoStandardNode = React.memo(StandardNode);
