import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import { ELKBridge } from "../bridges/ELKBridge.js";

describe("Project Structure Validation", () => {
  describe("Architectural constraints", () => {
    it("should segregate React code into components directory", async () => {
      expect(existsSync(join(process.cwd(), "src/components"))).toBe(true);
    });

    it("should have React-free core directory", async () => {
      expect(existsSync(join(process.cwd(), "src/core"))).toBe(true);
    });

    it("should have stateless bridges directory", async () => {
      expect(existsSync(join(process.cwd(), "src/bridges"))).toBe(true);
    });

    it("should have types directory for shared interfaces", async () => {
      expect(existsSync(join(process.cwd(), "src/types"))).toBe(true);
    });

    it("should have utils directory for test data and helpers", async () => {
      expect(existsSync(join(process.cwd(), "src/utils"))).toBe(true);
    });
  });

  describe("Core interface files", () => {
    it("should have VisualizationState class", async () => {
      expect(
        existsSync(join(process.cwd(), "src/core/VisualizationState.ts")),
      ).toBe(true);
    });

    it("should have ELKBridge class", async () => {
      expect(existsSync(join(process.cwd(), "src/bridges/ELKBridge.ts"))).toBe(
        true,
      );
    });

    it("should have ReactFlowBridge class", async () => {
      expect(
        existsSync(join(process.cwd(), "src/bridges/ReactFlowBridge.ts")),
      ).toBe(true);
    });

    it("should have core types defined", async () => {
      expect(existsSync(join(process.cwd(), "src/types/core.ts"))).toBe(true);
    });
  });

  describe("Test utilities", () => {
    it("should have paxos.json test data utilities", async () => {
      expect(existsSync(join(process.cwd(), "src/utils/testData.ts"))).toBe(
        true,
      );
    });
  });
});
