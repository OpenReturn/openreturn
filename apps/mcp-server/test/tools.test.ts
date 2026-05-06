import { describe, expect, it } from "vitest";
import { tools } from "../src/tools";

describe("MCP tools", () => {
  it("registers the required OpenReturn tools", () => {
    expect(tools.map((tool) => tool.name)).toEqual([
      "initiate_return",
      "get_return_status",
      "select_exchange",
      "select_carrier",
      "get_label",
      "track_return"
    ]);
  });
});
