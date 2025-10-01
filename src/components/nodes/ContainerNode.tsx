import React from "react";
// import { Handle, Position } from "@xyflow/react";
import { HandlesRenderer } from "../../render/handles";

export interface ContainerNodeProps {
  data: {
    label: string;
    nodeType: string;
    collapsed?: boolean;
    containerChildren?: number;
    onClick?: (elementId: string, elementType: "node" | "container") => void;
  };
  id: string;
}

export const ContainerNode: React.FC<ContainerNodeProps> = ({ data, id }) => {
  const handleClick = () => {
    if (data.onClick) {
      data.onClick(id, "container");
    }
  };

  if (data.collapsed) {
    // Collapsed container - render as a compact node
    return (
      <div
        onClick={handleClick}
        style={{
          padding: "12px 16px",
          border: "2px solid #666",
          borderRadius: "8px",
          backgroundColor: "#f5f5f5",
          cursor: "pointer",
          minWidth: "120px",
          textAlign: "center",
          fontSize: "14px",
          fontWeight: "bold",
        }}
      >
        <HandlesRenderer />

        <div>
          {data.label}
          {data.containerChildren && (
            <span style={{ fontSize: "10px", marginLeft: "4px" }}>
              ({data.containerChildren})
            </span>
          )}
        </div>
      </div>
    );
  } else {
    // Expanded container - render as a background rectangle
    return (
      <div
        onClick={handleClick}
        style={{
          width: "100%",
          height: "100%",
          border: "2px dashed #999",
          borderRadius: "12px",
          backgroundColor: "rgba(245, 245, 245, 0.1)",
          cursor: "pointer",
          position: "relative",
          minWidth: "200px",
          minHeight: "150px",
        }}
      >
        {/* Container label in top-left corner */}
        <div
          style={{
            position: "absolute",
            top: "8px",
            left: "12px",
            fontSize: "12px",
            fontWeight: "bold",
            color: "#666",
            backgroundColor: "rgba(255, 255, 255, 0.8)",
            padding: "2px 6px",
            borderRadius: "4px",
          }}
        >
          {data.label}
        </div>

        <HandlesRenderer />
      </div>
    );
  }
};

export const MemoContainerNode = React.memo(ContainerNode);
