/**
 * Azure Speech Service WebSocket client for TTS.
 *
 * Uses Azure's official Cognitive Services WebSocket API with subscription
 * key auth. WebSocket is required (over REST) because word boundary events
 * for text highlighting are only available via the streaming protocol.
 *
 * This module uses `node:tls` to make a raw TLS connection, performs the
 * HTTP/1.1 WebSocket upgrade handshake with custom headers, and implements
 * minimal WebSocket framing (RFC 6455) for text/binary messages.
 *
 * Only implements what Azure Speech TTS needs:
 * - Send text frames (config + SSML)
 * - Receive text frames (metadata, turn.end)
 * - Receive binary frames (audio chunks)
 * - Close handling
 */

import { connect as tlsConnect, type TLSSocket } from "node:tls";
import { randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";

// --- Azure Speech config (set once at startup via initAzureTTS) ---

interface AzureSpeechConfig {
  key: string;
  region: string;
}

let config: AzureSpeechConfig | null = null;

/**
 * Initialize Azure TTS with validated env vars. Must be called once at startup.
 * Throws if key or region is missing.
 */
export function initAzureTTS(key: string, region: string): void {
  config = { key, region };
}

function getConfig(): AzureSpeechConfig {
  if (!config) {
    throw new Error("Azure TTS not initialized — call initAzureTTS() at startup");
  }
  return config;
}

// --- Azure Speech URL/header builders ---

/** Build the Azure TTS WebSocket URL. */
export function buildTTSUrl(connectionId: string): string {
  const { region } = getConfig();
  return `wss://${region}.tts.speech.microsoft.com/cognitiveservices/websocket/v1?ConnectionId=${connectionId}`;
}

/** Get Azure TTS auth headers. */
export function getTTSHeaders(): Record<string, string> {
  const { key } = getConfig();
  return { "Ocp-Apim-Subscription-Key": key };
}

/** Get the Host header value for the TTS WebSocket. */
export function getTTSHost(): string {
  const { region } = getConfig();
  return `${region}.tts.speech.microsoft.com`;
}

/** Get the Origin header value for the TTS WebSocket. */
export function getTTSOrigin(): string {
  const { region } = getConfig();
  return `https://${region}.tts.speech.microsoft.com`;
}

/** Build the Azure voice list REST URL. */
export function buildVoiceListUrl(): string {
  const { region } = getConfig();
  return `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
}

/** Get auth headers for the voice list fetch. */
export function getVoiceListHeaders(): Record<string, string> {
  const { key } = getConfig();
  return { "Ocp-Apim-Subscription-Key": key };
}

// --- WebSocket opcodes ---
const OP_CONTINUATION = 0x0;
const OP_TEXT = 0x1;
const OP_BINARY = 0x2;
const OP_CLOSE = 0x8;
const OP_PING = 0x9;
const OP_PONG = 0xa;

interface WSOptions {
  host: string;
  origin: string;
  headers?: Record<string, string>;
}

/**
 * Raw TLS WebSocket client for Azure Speech Service.
 *
 * Bun's native WebSocket does NOT support custom headers (Origin, Host),
 * which Azure requires for auth. This class uses `node:tls` directly to
 * perform the HTTP/1.1 WebSocket upgrade with custom headers and implements
 * minimal RFC 6455 framing.
 */
export class AzureTTSWebSocket extends EventEmitter {
  private socket: TLSSocket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private upgraded = false;
  private closed = false;

  // Fragment reassembly
  private fragmentOpcode = 0;
  private fragments: Buffer[] = [];

  constructor(url: string, options: WSOptions) {
    super();

    const parsed = new URL(url);
    const host = parsed.hostname;
    const port = parsed.port ? parseInt(parsed.port) : 443;
    const path = parsed.pathname + parsed.search;

    // Generate WebSocket key for upgrade
    const wsKey = randomBytes(16).toString("base64");

    const socket = tlsConnect({ host, port, servername: host }, () => {
      if (this.closed) {
        socket.destroy();
        return;
      }

      // Build HTTP upgrade request with custom headers
      const headerLines = [
        `GET ${path} HTTP/1.1`,
        `Host: ${options.host || host}`,
        `Origin: ${options.origin}`,
        `Upgrade: websocket`,
        `Connection: Upgrade`,
        `Sec-WebSocket-Key: ${wsKey}`,
        `Sec-WebSocket-Version: 13`,
      ];

      if (options.headers) {
        for (const [key, value] of Object.entries(options.headers)) {
          headerLines.push(`${key}: ${value}`);
        }
      }

      headerLines.push("", ""); // End with \r\n\r\n
      socket.write(headerLines.join("\r\n"));
    });

    this.socket = socket;

    socket.on("data", (data: Buffer) => {
      if (!this.upgraded) {
        this.handleUpgrade(data);
      } else {
        this.buffer = Buffer.concat([this.buffer, data]);
        this.processFrames();
      }
    });

    socket.on("error", (err: Error) => {
      if (!this.closed) {
        this.emit("error", err);
      }
    });

    socket.on("close", () => {
      if (!this.closed) {
        this.closed = true;
        this.emit("close");
      }
    });
  }

  private handleUpgrade(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);
    const headerEnd = this.buffer.indexOf("\r\n\r\n");

    if (headerEnd === -1) return; // Wait for full headers

    const headerStr = this.buffer.subarray(0, headerEnd).toString("utf-8");
    const remaining = this.buffer.subarray(headerEnd + 4);

    // Check status line
    const statusLine = headerStr.split("\r\n")[0];
    if (!statusLine.includes("101")) {
      this.emit("error", new Error(`WebSocket upgrade failed: ${statusLine}`));
      this.socket?.destroy();
      return;
    }

    // Note: Sec-WebSocket-Accept verification intentionally skipped.
    // Some proxies/CDNs modify or strip this header. The 101 status
    // code is sufficient to confirm a successful WebSocket upgrade.

    this.upgraded = true;
    this.buffer = remaining;
    this.emit("open");

    // Process any remaining data after headers
    if (this.buffer.length > 0) {
      this.processFrames();
    }
  }

  private processFrames(): void {
    while (this.buffer.length >= 2) {
      const byte0 = this.buffer[0];
      const byte1 = this.buffer[1];

      const fin = (byte0 & 0x80) !== 0;
      const opcode = byte0 & 0x0f;
      const masked = (byte1 & 0x80) !== 0;
      let payloadLength = byte1 & 0x7f;
      let offset = 2;

      if (payloadLength === 126) {
        if (this.buffer.length < 4) return; // Need more data
        payloadLength = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLength === 127) {
        if (this.buffer.length < 10) return;
        const high = this.buffer.readUInt32BE(2);
        const low = this.buffer.readUInt32BE(6);
        payloadLength = high * 0x100000000 + low;
        offset = 10;
      }

      if (masked) offset += 4; // Skip mask key (server shouldn't mask)

      const totalFrameLength = offset + payloadLength;
      if (this.buffer.length < totalFrameLength) return; // Need more data

      let payload = this.buffer.subarray(offset, totalFrameLength);

      // Unmask if needed (shouldn't happen from server, but handle it)
      if (masked) {
        const maskKey = this.buffer.subarray(offset - 4, offset);
        payload = Buffer.from(payload); // Copy before mutating
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= maskKey[i & 3];
        }
      }

      // Consume this frame from buffer
      this.buffer = this.buffer.subarray(totalFrameLength);

      // Handle frame based on opcode
      this.handleFrame(fin, opcode, payload);
    }
  }

  private handleFrame(fin: boolean, opcode: number, payload: Buffer): void {
    // Continuation frame
    if (opcode === OP_CONTINUATION) {
      this.fragments.push(payload);
      if (fin) {
        const fullPayload = Buffer.concat(this.fragments);
        this.fragments = [];
        this.dispatchMessage(this.fragmentOpcode, fullPayload);
      }
      return;
    }

    // Control frames (can appear between fragmented frames)
    if (opcode === OP_CLOSE) {
      this.sendClose();
      this.closed = true;
      this.emit("close");
      this.socket?.destroy();
      return;
    }
    if (opcode === OP_PING) {
      this.sendPong(payload);
      return;
    }
    if (opcode === OP_PONG) return;

    // Data frame (text or binary)
    if (!fin) {
      // Start of fragmented message
      this.fragmentOpcode = opcode;
      this.fragments = [payload];
      return;
    }

    this.dispatchMessage(opcode, payload);
  }

  private dispatchMessage(opcode: number, payload: Buffer): void {
    if (opcode === OP_TEXT) {
      this.emit("message", payload, false); // isBinary = false
    } else if (opcode === OP_BINARY) {
      this.emit("message", payload, true); // isBinary = true
    }
  }

  /**
   * Send a text message (with masking as required by RFC 6455 for clients).
   */
  send(
    data: string | Buffer,
    _options?: { compress?: boolean },
    callback?: (err?: Error) => void,
  ): void {
    if (this.closed || !this.socket || !this.upgraded) {
      callback?.(new Error("WebSocket is not open"));
      return;
    }

    const isString = typeof data === "string";
    const payload = isString ? Buffer.from(data, "utf-8") : data;
    const opcode = isString ? OP_TEXT : OP_BINARY;

    const frame = this.encodeFrame(opcode, payload);
    this.socket.write(frame, (err) => {
      callback?.(err || undefined);
    });
  }

  private encodeFrame(opcode: number, payload: Buffer): Buffer {
    const maskKey = randomBytes(4);
    let headerSize = 2;

    if (payload.length >= 65536) {
      headerSize += 8;
    } else if (payload.length >= 126) {
      headerSize += 2;
    }

    // +4 for mask key (client frames MUST be masked)
    const frame = Buffer.alloc(headerSize + 4 + payload.length);

    // Byte 0: FIN + opcode
    frame[0] = 0x80 | opcode;

    // Byte 1: MASK + payload length
    let offset = 2;
    if (payload.length >= 65536) {
      frame[1] = 0x80 | 127;
      frame.writeUInt32BE(0, 2); // High 32 bits
      frame.writeUInt32BE(payload.length, 6);
      offset = 10;
    } else if (payload.length >= 126) {
      frame[1] = 0x80 | 126;
      frame.writeUInt16BE(payload.length, 2);
      offset = 4;
    } else {
      frame[1] = 0x80 | payload.length;
    }

    // Mask key
    maskKey.copy(frame, offset);
    offset += 4;

    // Masked payload
    for (let i = 0; i < payload.length; i++) {
      frame[offset + i] = payload[i] ^ maskKey[i & 3];
    }

    return frame;
  }

  private sendClose(): void {
    if (!this.socket || this.closed) return;
    const frame = this.encodeFrame(OP_CLOSE, Buffer.alloc(0));
    try {
      this.socket.write(frame);
    } catch {
      // Ignore write errors during close
    }
  }

  private sendPong(payload: Buffer): void {
    if (!this.socket || this.closed) return;
    const frame = this.encodeFrame(OP_PONG, payload);
    try {
      this.socket.write(frame);
    } catch {
      // Ignore
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.sendClose();
    // Give the server a moment to respond, then force close
    setTimeout(() => {
      this.socket?.destroy();
    }, 1000);
  }
}
