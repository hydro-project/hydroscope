import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseHydroscopeData, decompressData } from "../parse";

const loadRaw = (name: string) => readFileSync(join(__dirname, "../../test-data", name), "utf-8");

describe("parseHydroscopeData", () => {
  it("parses paxos JSON string", () => {
    const data = parseHydroscopeData(loadRaw("paxos.json"));
    expect(data.nodes.length).toBeGreaterThan(0);
    expect(data.edges.length).toBeGreaterThan(0);
    expect(data.hierarchyChoices.length).toBeGreaterThan(0);
    expect(data.edgeStyleConfig).toBeDefined();
    expect(data.nodeTypeConfig).toBeDefined();
    expect(data.legend).toBeDefined();
  });

  it("parses map_reduce JSON string", () => {
    const data = parseHydroscopeData(loadRaw("map_reduce.json"));
    expect(data.nodes.length).toBeGreaterThan(0);
    expect(data.edges.length).toBeGreaterThan(0);
  });

  it("parses pre-parsed object", () => {
    const obj = JSON.parse(loadRaw("map_reduce.json"));
    const data = parseHydroscopeData(obj);
    expect(data.nodes.length).toBeGreaterThan(0);
  });

  it("handles missing optional fields gracefully", () => {
    const data = parseHydroscopeData({ nodes: [], edges: [] });
    expect(data.nodes).toEqual([]);
    expect(data.edges).toEqual([]);
    expect(data.hierarchyChoices).toEqual([]);
    expect(data.nodeAssignments).toEqual({});
  });

  it("throws on invalid input", () => {
    expect(() => parseHydroscopeData(null)).toThrow();
    expect(() => parseHydroscopeData("not json")).toThrow();
  });

  it("nodes have expected fields", () => {
    const data = parseHydroscopeData(loadRaw("paxos.json"));
    const node = data.nodes[0];
    expect(node).toHaveProperty("id");
    expect(node).toHaveProperty("nodeType");
    expect(node).toHaveProperty("label");
    expect(node).toHaveProperty("shortLabel");
    expect(node).toHaveProperty("fullLabel");
  });

  it("edges have expected fields", () => {
    const data = parseHydroscopeData(loadRaw("paxos.json"));
    const edge = data.edges[0];
    expect(edge).toHaveProperty("id");
    expect(edge).toHaveProperty("source");
    expect(edge).toHaveProperty("target");
    expect(edge).toHaveProperty("semanticTags");
    expect(Array.isArray(edge.semanticTags)).toBe(true);
  });

  it("hierarchyChoices have children", () => {
    const data = parseHydroscopeData(loadRaw("paxos.json"));
    const loc = data.hierarchyChoices.find((c) => c.id === "location");
    expect(loc).toBeDefined();
    expect(loc!.children.length).toBeGreaterThan(0);
  });
});

describe("decompressData", () => {
  it("decompresses gzipped base64 data", async () => {
    // Create a compressed payload
    const original = JSON.stringify({ nodes: [{ id: "1" }], edges: [] });
    const encoder = new TextEncoder();
    const stream = new Blob([encoder.encode(original)]).stream().pipeThrough(new CompressionStream("gzip"));
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    const b64 = btoa(String.fromCharCode(...compressed)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const result = await decompressData(b64);
    expect(result).toBe(original);
  });
});
