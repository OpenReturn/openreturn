import { Buffer } from "node:buffer";

/** Minimal JSON-RPC 2.0 request shape used by MCP transports. */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

/** Minimal JSON-RPC 2.0 response shape used by MCP transports. */
export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/** Handler contract for a JSON-RPC request. Notifications return undefined. */
export type JsonRpcHandler = (request: JsonRpcRequest) => Promise<JsonRpcResponse | undefined>;

/** Encodes a JSON-RPC payload with an MCP stdio Content-Length header. */
export function encodeMessage(message: unknown): Buffer {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.from(`Content-Length: ${payload.byteLength}\r\n\r\n`, "utf8");
  return Buffer.concat([header, payload]);
}

/** MCP stdio transport that parses Content-Length framed JSON-RPC messages. */
export class StdioJsonRpcTransport {
  private static readonly maxContentLength = 1_000_000;
  private buffer = Buffer.alloc(0);
  private draining = false;

  public constructor(private readonly handler: JsonRpcHandler) {}

  /** Starts reading framed messages from stdin and writing responses to stdout. */
  public start(): void {
    process.stdin.on("data", (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.draining) {
      return;
    }
    this.draining = true;
    try {
      while (true) {
        const separator = this.buffer.indexOf("\r\n\r\n");
        if (separator === -1) {
          return;
        }
        const header = this.buffer.subarray(0, separator).toString("utf8");
        const match = /Content-Length:\s*(\d+)/i.exec(header);
        if (!match) {
          this.buffer = this.buffer.subarray(separator + 4);
          continue;
        }
        const length = Number(match[1]);
        if (
          !Number.isInteger(length) ||
          length < 0 ||
          length > StdioJsonRpcTransport.maxContentLength
        ) {
          this.buffer = this.buffer.subarray(separator + 4);
          process.stdout.write(
            encodeMessage({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32600, message: "Invalid Content-Length" }
            })
          );
          continue;
        }
        const start = separator + 4;
        const end = start + length;
        if (this.buffer.byteLength < end) {
          return;
        }
        const payload = this.buffer.subarray(start, end).toString("utf8");
        this.buffer = this.buffer.subarray(end);
        let request: JsonRpcRequest;
        try {
          request = JSON.parse(payload) as JsonRpcRequest;
        } catch {
          process.stdout.write(
            encodeMessage({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32700, message: "Parse error" }
            })
          );
          continue;
        }
        const response = await this.safeHandle(request);
        if (response) {
          process.stdout.write(encodeMessage(response));
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private async safeHandle(request: JsonRpcRequest): Promise<JsonRpcResponse | undefined> {
    try {
      return await this.handler(request);
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : "Internal MCP error"
        }
      };
    }
  }
}
