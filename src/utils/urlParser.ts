/**
 * URL Parameter Parsing Utilities
 *
 * Functions for parsing graph data from URL parameters, useful for
 * sharing visualizations via URLs.
 */
import type { HydroscopeData } from "../types/core.js";
import { decompressData } from "./compression.js";

/**
 * Parse graph data from URL parameters
 *
 * Supports both compressed and uncompressed data formats.
 * Used for sharing graph visualizations via URL.
 *
 * @param dataParam - Base64 encoded JSON data
 * @param compressedParam - Compressed data parameter (if available)
 * @returns Promise that resolves to parsed graph data
 */
export async function parseDataFromUrl(
  dataParam?: string | null,
  compressedParam?: string | null,
): Promise<HydroscopeData | null> {
  try {
    let jsonString: string;

    if (compressedParam) {
      // Use proper decompression for compressed data
      jsonString = await decompressData(compressedParam);
    } else if (dataParam) {
      // Handle uncompressed data
      jsonString = atob(dataParam);
    } else {
      return null;
    }

    return JSON.parse(jsonString) as HydroscopeData;
  } catch (error) {
    throw new Error(
      `Failed to parse data from URL: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
/**
 * Encode graph data for URL sharing
 *
 * Converts graph data to a base64-encoded string suitable for URL parameters.
 *
 * @param data - Graph data to encode
 * @param compress - Whether to compress the data (not implemented yet)
 * @returns Base64 encoded string
 */
export function encodeDataForUrl(
  data: HydroscopeData,
  compress: boolean = false,
): string {
  try {
    const jsonString = JSON.stringify(data);
    if (compress) {
      // For now, just use base64. In the future, could add compression
      console.warn("Compression not implemented yet, using base64 encoding");
    }
    return btoa(jsonString);
  } catch (error) {
    throw new Error(
      `Failed to encode data for URL: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
