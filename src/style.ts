import type { EdgeStyleConfig, EdgeStyle } from "./types";

const DEFAULT_STYLE: EdgeStyle = {
  color: "#666666",
  animated: false,
  arrowhead: "triangle-filled",
  lineStyle: "single",
  waviness: "straight",
};

export function resolveEdgeStyle(semanticTags: string[], config?: EdgeStyleConfig | null): EdgeStyle {
  if (!config?.semanticMappings) return { ...DEFAULT_STYLE };
  const style: EdgeStyle = { ...DEFAULT_STYLE };
  const tagSet = new Set(semanticTags);

  for (const [, groupMappings] of Object.entries(config.semanticMappings)) {
    for (const [tagName, properties] of Object.entries(groupMappings)) {
      if (!tagSet.has(tagName)) continue;
      for (const [prop, value] of Object.entries(properties)) {
        switch (prop) {
          case "color": style.color = value; break;
          case "line-pattern":
            style.strokeDasharray = value === "dashed" ? "5,5" : undefined; break;
          case "animation": style.animated = value === "animated"; break;
          case "arrowhead": style.arrowhead = value; break;
          case "line-style": style.lineStyle = value as EdgeStyle["lineStyle"]; break;
          case "waviness": style.waviness = value as EdgeStyle["waviness"]; break;
        }
      }
    }
  }
  return style;
}
