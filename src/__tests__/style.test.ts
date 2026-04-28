import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { resolveEdgeStyle } from "../style";
import { parseHydroscopeData } from "../parse";

const loadTestData = (name: string) => {
  const raw = readFileSync(join(__dirname, "../../test-data", name), "utf-8");
  return parseHydroscopeData(raw);
};

const paxos = loadTestData("paxos.json");

describe("resolveEdgeStyle", () => {
  it("returns default style with no config", () => {
    const style = resolveEdgeStyle(["Local", "Stream"], null);
    expect(style.color).toBe("#666666");
    expect(style.animated).toBe(false);
    expect(style.lineStyle).toBe("single");
  });

  it("applies Network tag → animated + dashed", () => {
    const style = resolveEdgeStyle(["Network", "Stream"], paxos.edgeStyleConfig);
    expect(style.animated).toBe(true);
    expect(style.strokeDasharray).toBe("5,5");
  });

  it("applies Local tag → not animated, not dashed", () => {
    const style = resolveEdgeStyle(["Local", "Stream"], paxos.edgeStyleConfig);
    expect(style.animated).toBe(false);
    expect(style.strokeDasharray).toBeUndefined();
  });

  it("applies Keyed tag → hash-marks line style", () => {
    const style = resolveEdgeStyle(["Keyed", "Local"], paxos.edgeStyleConfig);
    expect(style.lineStyle).toBe("hash-marks");
  });

  it("applies Stream tag → color", () => {
    const style = resolveEdgeStyle(["Stream", "Local"], paxos.edgeStyleConfig);
    expect(style.color).not.toBe("#666666"); // Should have a specific color
  });

  it("applies NoOrder tag → wavy", () => {
    const style = resolveEdgeStyle(["NoOrder", "Local"], paxos.edgeStyleConfig);
    expect(style.waviness).toBe("wavy");
  });

  it("handles multiple tags from different groups", () => {
    const style = resolveEdgeStyle(["Network", "Keyed", "NoOrder", "Stream"], paxos.edgeStyleConfig);
    expect(style.animated).toBe(true);
    expect(style.lineStyle).toBe("hash-marks");
    expect(style.waviness).toBe("wavy");
  });

  it("handles empty semantic tags", () => {
    const style = resolveEdgeStyle([], paxos.edgeStyleConfig);
    expect(style.color).toBe("#666666");
  });

  it("handles unknown tags gracefully", () => {
    const style = resolveEdgeStyle(["UnknownTag", "AnotherUnknown"], paxos.edgeStyleConfig);
    expect(style.color).toBe("#666666");
  });
});
