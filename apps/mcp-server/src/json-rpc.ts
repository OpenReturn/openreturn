import { Buffer } from "node:buffer";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

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

export type JsonRpcHandler = (request: JsonRpcRequest) => Promise<JsonRpcResponse | undefined>;

export function encodeMessage(message: unknown): Buffer {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.from(`Content-Length: ${payload.byteLength}\r\n\r\n`, "utf8");
  return Buffer.concat([header, payload]);
}

export class StdioJsonRpcTransport {
  private buffer = Buffer.alloc(0);

  public constructor(private readonly handler: JsonRpcHandler) {}

  public start(): void {
    process.stdin.on("data", (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
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
      const start = separator + 4;
      const end = start + length;
      if (this.buffer.byteLength < end) {
        return;
      }
      const payload = this.buffer.subarray(start, end).toString("utf8");
      this.buffer = this.buffer.subarray(end);
      const request = JSON.parse(payload) as JsonRpcRequest;
      const response = await this.handler(request);
      if (response) {
        process.stdout.write(encodeMessage(response));
      }
    }
  }
}
