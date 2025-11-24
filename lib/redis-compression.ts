import { gzipSync, gunzipSync } from 'zlib';

export const compress = (data: any): string => {
  const jsonString = JSON.stringify(data);
  // Compress and convert to base64 for storage
  return gzipSync(jsonString).toString('base64');
};

export const decompress = (data: unknown): any => {
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
    // Although Upstash Redis client usually parses JSON automatically, 
    // if we manually stored a string that isn't JSON, it might come back as string.
    try {
        return JSON.parse(data);
    } catch {
        // If it's just a plain string that happened to fail decompression (unlikely if we control writes)
        // treat as failure
        return null; 
    }
  }
};

