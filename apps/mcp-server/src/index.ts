import { OpenReturnApiClient } from "./api-client";
import { StdioJsonRpcTransport } from "./json-rpc";
import { createMcpHandler, startHttpMcpServer } from "./server";

const apiBaseUrl = process.env.OPENRETURN_API_BASE_URL ?? "http://localhost:4000";
const clientId = process.env.OPENRETURN_MCP_CLIENT_ID ?? "openreturn-mcp-agent";
const subjectToken = process.env.OPENRETURN_AGENT_SUBJECT_TOKEN;
const client = new OpenReturnApiClient(apiBaseUrl, clientId, subjectToken);
const handler = createMcpHandler(client);

const httpPort = process.env.MCP_HTTP_PORT ? Number(process.env.MCP_HTTP_PORT) : undefined;
if (httpPort) {
  startHttpMcpServer(handler, httpPort);
} else {
  new StdioJsonRpcTransport(handler).start();
}
