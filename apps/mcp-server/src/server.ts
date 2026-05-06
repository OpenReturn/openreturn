import { createServer } from "node:http";
import { OpenReturnApiClient } from "./api-client";
import type { JsonRpcRequest, JsonRpcResponse } from "./json-rpc";
import { callTool, tools } from "./tools";

/** Creates the MCP JSON-RPC handler for initialize, tools/list, and tools/call. */
export function createMcpHandler(client: OpenReturnApiClient) {
  return async function handle(request: JsonRpcRequest): Promise<JsonRpcResponse | undefined> {
    try {
      switch (request.method) {
        case "initialize":
          return ok(request.id, {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: "openreturn-mcp-server",
              version: "0.1.0"
            }
          });
        case "notifications/initialized":
          return undefined;
        case "tools/list":
          return ok(request.id, { tools });
        case "tools/call": {
          const params = request.params ?? {};
          if (!isRecord(params) || typeof params.name !== "string") {
            return error(request.id, -32602, "tools/call requires a string tool name");
          }
          const args = params.arguments === undefined ? {} : params.arguments;
          if (!isRecord(args)) {
            return error(request.id, -32602, "tools/call arguments must be an object");
          }
          const name = params.name;
          const result = await callTool(client, name, args);
          return ok(request.id, {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
          });
        }
        default:
          return error(request.id, -32601, `Method not found: ${request.method}`);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unknown MCP error";
      return error(request.id, -32000, message);
    }
  };
}

/** Starts an HTTP JSON-RPC endpoint for MCP clients that do not use stdio. */
export function startHttpMcpServer(
  handler: (request: JsonRpcRequest) => Promise<JsonRpcResponse | undefined>,
  port: number
): void {
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/healthz") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    if (request.method !== "POST" || request.url !== "/mcp") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "not_found" }));
      return;
    }

    let body = "";
    let bodyTooLarge = false;
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        bodyTooLarge = true;
        request.destroy();
      }
    });
    request.on("error", () => {
      if (!response.headersSent) {
        response.writeHead(bodyTooLarge ? 413 : 400, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: bodyTooLarge ? "payload_too_large" : "bad_request" }));
      }
    });
    request.on("end", () => {
      void (async () => {
        if (response.headersSent) {
          return;
        }
        if (bodyTooLarge) {
          response.writeHead(413, { "content-type": "application/json" });
          response.end(JSON.stringify({ error: "payload_too_large" }));
          return;
        }
        let rpcRequest: JsonRpcRequest;
        try {
          rpcRequest = JSON.parse(body) as JsonRpcRequest;
        } catch {
          response.writeHead(400, { "content-type": "application/json" });
          response.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32700, message: "Parse error" }
            })
          );
          return;
        }
        const rpcResponse = await handler(rpcRequest);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(rpcResponse ?? { ok: true }));
      })().catch((caught) => {
        if (response.headersSent) {
          return;
        }
        const message = caught instanceof Error ? caught.message : "Internal MCP error";
        response.writeHead(500, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: message }));
      });
    });
  });

  server.listen(port, () => {
    console.error(`OpenReturn MCP HTTP server listening on http://localhost:${port}/mcp`);
  });
}

function ok(id: JsonRpcRequest["id"], result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function error(id: JsonRpcRequest["id"], code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
