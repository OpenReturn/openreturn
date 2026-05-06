import { describe, expect, it, vi } from "vitest";
import { ProtocolValidationError } from "@openreturn/types";
import type { OpenReturnApiClient } from "../src/api-client";
import { callTool, tools } from "../src/tools";

describe("MCP tools", () => {
  it("registers the required OpenReturn tools", () => {
    expect(tools.map((tool) => tool.name)).toEqual([
      "discover_openreturn",
      "lookup_order",
      "list_returns",
      "initiate_return",
      "get_return_status",
      "update_return",
      "select_exchange",
      "select_carrier",
      "get_label",
      "track_return",
      "get_return_events",
      "receive_webhook"
    ]);
  });

  it("validates tool arguments before calling the REST client", async () => {
    await expect(
      callTool({} as OpenReturnApiClient, "track_return", { id: "ret_1", status: "lost" })
    ).rejects.toThrow(ProtocolValidationError);
  });

  it("dispatches typed tool calls to the REST client", async () => {
    const client = {
      getReturnStatus: vi.fn().mockResolvedValue({ return: { id: "ret_1" } })
    };

    await expect(callTool(client as unknown as OpenReturnApiClient, "get_return_status", { id: "ret_1" })).resolves.toEqual({
      return: { id: "ret_1" }
    });
    expect(client.getReturnStatus).toHaveBeenCalledWith("ret_1");
  });
});
