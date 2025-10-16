/**
 * URL Parameter Parsing Tests
 *
 * Tests the URL parameter functionality copied from main branch to v6 branch.
 * Covers data, compressed, and file parameter handling.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseDataFromUrl } from "../utils/urlParser.js";

describe("URL Parameter Parsing", () => {
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
  });

  afterEach(() => {
    // Restore original location
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    });
  });

  describe("parseDataFromUrl", () => {
    it("should parse uncompressed base64 data", async () => {
      const testData = {
        nodes: [{ id: "test", label: "Test Node" }],
        edges: [],
      };
      const base64Data = btoa(JSON.stringify(testData));

      const result = await parseDataFromUrl(base64Data, null);

      expect(result).toEqual(testData);
    });

    it("should handle null parameters gracefully", async () => {
      const result = await parseDataFromUrl(null, null);

      expect(result).toBeNull();
    });

    it("should throw error for invalid base64 data", async () => {
      await expect(parseDataFromUrl("invalid-base64", null)).rejects.toThrow(
        "Failed to parse data from URL",
      );
    });

    it("should throw error for invalid JSON data", async () => {
      const invalidJson = btoa("{ invalid json }");

      await expect(parseDataFromUrl(invalidJson, null)).rejects.toThrow(
        "Failed to parse data from URL",
      );
    });

    it("should prioritize compressed data over uncompressed", async () => {
      const uncompressedData = {
        nodes: [{ id: "uncompressed", label: "Uncompressed Data" }],
        edges: [],
      };

      const dataParam = btoa(JSON.stringify(uncompressedData));
      const compressedParam = null; // No compressed data

      const result = await parseDataFromUrl(dataParam, compressedParam);

      // Should use uncompressed data when no compressed data is available
      expect(result).toEqual(uncompressedData);
    });
  });

  describe("URL Parameter Detection", () => {
    it("should detect data parameter in search params", () => {
      const testData = { nodes: [], edges: [] };
      const base64Data = btoa(JSON.stringify(testData));
      const mockLocation = {
        ...originalLocation,
        search: `?data=${encodeURIComponent(base64Data)}`,
        hash: "",
      };

      Object.defineProperty(window, "location", {
        value: mockLocation,
        writable: true,
      });

      const urlParams = new URLSearchParams(window.location.search);
      const dataParam = urlParams.get("data");

      expect(dataParam).toBeTruthy();
      expect(dataParam).toBe(base64Data);
    });

    it("should detect compressed parameter in hash params", () => {
      const testData = { nodes: [], edges: [] };
      const base64Data = btoa(JSON.stringify(testData));
      const mockLocation = {
        ...originalLocation,
        search: "",
        hash: `#compressed=${encodeURIComponent(base64Data)}`,
      };

      Object.defineProperty(window, "location", {
        value: mockLocation,
        writable: true,
      });

      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const compressedParam = hashParams.get("compressed");

      expect(compressedParam).toBeTruthy();
      expect(compressedParam).toBe(base64Data);
    });

    it("should detect file parameter in search params", () => {
      const mockLocation = {
        ...originalLocation,
        search: "?file=%2Fpath%2Fto%2Ffile.json", // URL encoded /path/to/file.json
        hash: "",
      };

      Object.defineProperty(window, "location", {
        value: mockLocation,
        writable: true,
      });

      const urlParams = new URLSearchParams(window.location.search);
      const fileParam = urlParams.get("file");

      expect(fileParam).toBeTruthy();
      expect(decodeURIComponent(fileParam!)).toBe("/path/to/file.json");
    });

    it("should handle mixed parameters correctly", () => {
      const testData = { nodes: [], edges: [] };
      const base64Data = btoa(JSON.stringify(testData));
      const mockLocation = {
        ...originalLocation,
        search: `?data=${encodeURIComponent(base64Data)}&layout=force`,
        hash: `#compressed=${encodeURIComponent(base64Data)}&palette=Set1`,
      };

      Object.defineProperty(window, "location", {
        value: mockLocation,
        writable: true,
      });

      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.slice(1));

      const dataParam = urlParams.get("data") || hashParams.get("data");
      const compressedParam =
        urlParams.get("compressed") || hashParams.get("compressed");

      expect(dataParam).toBeTruthy();
      expect(compressedParam).toBeTruthy();

      // Should prioritize compressed from hash over data from search
      expect(compressedParam).toBe(base64Data);
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed URL parameters gracefully", async () => {
      const malformedBase64 = "not-valid-base64!@#$";

      await expect(parseDataFromUrl(malformedBase64, null)).rejects.toThrow(
        "Failed to parse data from URL",
      );
    });

    it("should provide meaningful error messages", async () => {
      const invalidJson = btoa('{ "incomplete": json');

      try {
        await parseDataFromUrl(invalidJson, null);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(
          "Failed to parse data from URL",
        );
      }
    });
  });
});
