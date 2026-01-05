import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Compress data for Redis storage.
 * Uses async gzip to avoid blocking the event loop and reduce memory pressure.
 */
export const compressAsync = async (data: any): Promise<string> => {
  const jsonString = JSON.stringify(data);
  const compressed = await gzipAsync(Buffer.from(jsonString));
  return compressed.toString('base64');
};

/**
 * Decompress data from Redis storage.
 * Uses async gunzip to avoid blocking the event loop and reduce memory pressure.
 */
export const decompressAsync = async (data: unknown): Promise<any> => {
  // If it's already an object, return it (backward compatibility for uncompressed JSON)
  if (typeof data === 'object' && data !== null) {
    return data;
  }

  if (typeof data !== 'string') {
    return null;
  }

  try {
    // Try to decode base64 and decompress
    const buffer = Buffer.from(data, 'base64');
    const decompressed = await gunzipAsync(buffer);
    return JSON.parse(decompressed.toString());
  } catch {
    // If decompression fails, it might be uncompressed JSON string or invalid data
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
};

/**
 * Synchronous compress - use only when async is not possible.
 * Prefer compressAsync for better memory management under load.
 */
export const compress = (data: any): string => {
  const { gzipSync } = require('zlib');
  const jsonString = JSON.stringify(data);
  return gzipSync(jsonString).toString('base64');
};

/**
 * Synchronous decompress - use only when async is not possible.
 * Prefer decompressAsync for better memory management under load.
 */
export const decompress = (data: unknown): any => {
  const { gunzipSync } = require('zlib');

  // If it's already an object, return it (backward compatibility for uncompressed JSON)
  if (typeof data === 'object' && data !== null) {
    return data;
  }

  if (typeof data !== 'string') {
    return null;
  }

  try {
    // Try to decode base64 and decompress
    const buffer = Buffer.from(data, 'base64');
    const jsonString = gunzipSync(buffer).toString();
    return JSON.parse(jsonString);
  } catch {
    // If decompression fails, it might be uncompressed JSON string or invalid data
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
};
