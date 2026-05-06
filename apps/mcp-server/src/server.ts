import { createServer } from "node:http";
import { OpenReturnApiClient } from "./api-client";
import type { JsonRpcRequest, JsonRpcResponse } from "./json-rpc";
import { callTool, tools } from "./tools";

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
          const name = String(params.name);
          const args = (params.arguments ?? {}) as Record<string, unknown>;
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
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      void (async () => {
        const rpcRequest = JSON.parse(body) as JsonRpcRequest;
        const rpcResponse = await handler(rpcRequest);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(rpcResponse ?? { ok: true }));
      })().catch((caught) => {
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
