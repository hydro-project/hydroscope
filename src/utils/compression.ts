/**
 * Compression utilities for hydroscope data
 */

/**
 * Decompress base64-encoded gzipped data
 * @param compressedData Base64-encoded compressed data (URL-safe format)
 * @returns Promise resolving to the decompressed string
 */
export async function decompressData(compressedData: string): Promise<string> {
  // Convert URL-safe base64 to standard base64
  let standardBase64 = compressedData.replace(/-/g, '+').replace(/_/g, '/');

  // Add padding if needed
  while (standardBase64.length % 4) {
    standardBase64 += '=';
  }

  // Decode base64 and decompress
  const compressedBytes = Uint8Array.from(atob(standardBase64), c => c.charCodeAt(0));

  // Use browser's built-in decompression (if available) or fallback
  let jsonString: string;

  if (typeof DecompressionStream !== 'undefined') {
    // Modern browser with Compression Streams API
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    writer.write(compressedBytes);
    writer.close();

    const chunks: Uint8Array[] = [];
    let done = false;
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) chunks.push(value);
    }

    const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      decompressed.set(chunk, offset);
      offset += chunk.length;
    }

    jsonString = new TextDecoder().decode(decompressed);
  } else {
    // Fallback: assume uncompressed for older browsers
    console.warn('Browser does not support compression streams, assuming uncompressed data');
    jsonString = new TextDecoder().decode(compressedBytes);
  }

  return jsonString;
}

/**
 * Parse JSON data from either compressed or uncompressed base64 data
 * @param dataParam Uncompressed base64 data
 * @param compressedParam Compressed base64 data
 * @returns Promise resolving to parsed JSON object
 */
export async function parseDataFromUrl(
  dataParam?: string | null,
  compressedParam?: string | null
): Promise<any> {
  let jsonString: string;

  if (compressedParam) {
    jsonString = await decompressData(compressedParam);
  } else if (dataParam) {
    jsonString = atob(dataParam);
  } else {
    throw new Error('No data parameter provided');
  }

  return JSON.parse(jsonString);
}
