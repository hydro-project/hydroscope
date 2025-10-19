import { describe, it, expect } from "vitest";
import { trimPathForMarkers } from "../render/edgeStyleUtils.js";

describe("edgeStyleUtils", () => {
  describe("trimPathForMarkers", () => {
    it("should trim a straight line path and return correct endpoints", () => {
      // Simple straight line from (0,0) to (100,0)
      const path = "M 0 0 L 100 0";
      const result = trimPathForMarkers(path, 0.2); // 20% trim on each end

      // Should trim 20 pixels from each end (20% of 100)
      expect(result.sourcePoint.x).toBeCloseTo(20, 1);
      expect(result.sourcePoint.y).toBeCloseTo(0, 1);
      expect(result.targetPoint.x).toBeCloseTo(80, 1);
      expect(result.targetPoint.y).toBeCloseTo(0, 1);

      // Trimmed path should start and end at the trim points
      expect(result.trimmedPath).toContain("M 20");
      expect(result.trimmedPath).toContain("L 80");
    });

    it("should not trim very short paths", () => {
      // Path shorter than 2 * minTrimLength
      const path = "M 0 0 L 10 0";
      const result = trimPathForMarkers(path, 0.2);

      // Should return original path
      expect(result.trimmedPath).toBe(path);
      expect(result.sourcePoint.x).toBe(0);
      expect(result.targetPoint.x).toBe(10);
    });

    it("should handle diagonal lines correctly", () => {
      // Diagonal line from (0,0) to (100,100)
      const path = "M 0 0 L 100 100";
      const result = trimPathForMarkers(path, 0.15); // 15% trim

      // Length is sqrt(100^2 + 100^2) = 141.42
      // 15% of 141.42 = 21.21
      // Trim point should be 21.21 pixels along the line
      // Direction is (1/sqrt(2), 1/sqrt(2))
      const expectedTrim = 21.21;
      const expectedX = expectedTrim / Math.sqrt(2);
      const expectedY = expectedTrim / Math.sqrt(2);

      expect(result.sourcePoint.x).toBeCloseTo(expectedX, 0);
      expect(result.sourcePoint.y).toBeCloseTo(expectedY, 0);
    });

    it("should ensure connection paths have non-zero length", () => {
      const path = "M 0 0 L 100 0";
      const result = trimPathForMarkers(path, 0.2);

      // Source and target points should be different from original endpoints
      expect(result.sourcePoint.x).not.toBe(0);
      expect(result.targetPoint.x).not.toBe(100);

      // Connection path from (0,0) to sourcePoint should have length > 0
      const sourceConnectionLength = Math.sqrt(
        result.sourcePoint.x ** 2 + result.sourcePoint.y ** 2,
      );
      expect(sourceConnectionLength).toBeGreaterThan(0);

      // Connection path from targetPoint to (100,0) should have length > 0
      const targetConnectionLength = Math.sqrt(
        (100 - result.targetPoint.x) ** 2 + result.targetPoint.y ** 2,
      );
      expect(targetConnectionLength).toBeGreaterThan(0);
    });
  });
});
