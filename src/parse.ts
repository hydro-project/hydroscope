import type { HydroscopeData } from "./types";

export function parseHydroscopeData(input: unknown): HydroscopeData {
  const obj = typeof input === "string" ? JSON.parse(input) : input;
  if (!obj || typeof obj !== "object") throw new Error("Invalid hydroscope data");
  const d = obj as Record<string, unknown>;
  return {
    nodes: Array.isArray(d.nodes) ? d.nodes : [],
    edges: Array.isArray(d.edges) ? d.edges : [],
    hierarchyChoices: Array.isArray(d.hierarchyChoices) ? d.hierarchyChoices : [],
    nodeAssignments: (d.nodeAssignments as HydroscopeData["nodeAssignments"]) ?? {},
    selectedHierarchy: d.selectedHierarchy as string | undefined,
    nodeTypeConfig: d.nodeTypeConfig as HydroscopeData["nodeTypeConfig"],
    edgeStyleConfig: d.edgeStyleConfig as HydroscopeData["edgeStyleConfig"],
    legend: d.legend as HydroscopeData["legend"],
  };
}

async function decompressDataAsync(compressed: string): Promise<string> {
  const raw = compressed.replace(/-/g, "+").replace(/_/g, "/");
  const pad = raw.length % 4 === 0 ? "" : "=".repeat(4 - (raw.length % 4));
  const bytes = Uint8Array.from(atob(raw + pad), (c) => c.charCodeAt(0));
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return new Response(ds.readable).text();
}

export async function decompressData(compressed: string): Promise<string> {
  return decompressDataAsync(compressed);
}

/**
 * Parse hydroscope data from URL parameters.
 * Supports two calling conventions:
 *   parseDataFromUrl() — reads from window.location
 *   parseDataFromUrl(dataParam, compressedParam) — uses provided values directly
 */
export async function parseDataFromUrl(
  dataOrUrl?: string | null,
  compressed?: string | null,
): Promise<HydroscopeData | null> {
  // Two-arg form: called with (dataParam, compressedParam) directly
  if (compressed) {
    const json = await decompressDataAsync(compressed);
    return parseHydroscopeData(json);
  }
  if (dataOrUrl && !dataOrUrl.includes("://")) {
    // Looks like a raw base64 data param, not a URL
    const raw = dataOrUrl.replace(/-/g, "+").replace(/_/g, "/");
    const pad = raw.length % 4 === 0 ? "" : "=".repeat(4 - (raw.length % 4));
    return parseHydroscopeData(atob(raw + pad));
  }

  // Single-arg or no-arg form: parse from URL
  const url = new URL(dataOrUrl ?? window.location.href);
  const dataParam = url.searchParams.get("data");
  const compressedParam = url.searchParams.get("compressed");
  const fileParam = url.searchParams.get("file");

  if (compressedParam) {
    const json = await decompressDataAsync(compressedParam);
    return parseHydroscopeData(json);
  }
  if (dataParam) {
    const raw = dataParam.replace(/-/g, "+").replace(/_/g, "/");
    const pad = raw.length % 4 === 0 ? "" : "=".repeat(4 - (raw.length % 4));
    return parseHydroscopeData(atob(raw + pad));
  }
  if (fileParam) {
    const resp = await fetch(fileParam);
    return parseHydroscopeData(await resp.text());
  }
  return null;
}
