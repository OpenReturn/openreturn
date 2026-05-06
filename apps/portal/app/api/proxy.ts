import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiBaseUrl } from "../../lib/api";

/** Proxies a portal API route to the OpenReturn REST API. */
export async function proxyApiRequest(
  request: NextRequest,
  path: string,
  options: { method?: string; body?: unknown } = {}
) {
  try {
    const headers = new Headers();
    headers.set("accept", "application/json");
    const authorization = request.headers.get("authorization");
    if (authorization) {
      headers.set("authorization", authorization);
    }
    if (options.body !== undefined) {
      headers.set("content-type", "application/json");
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? request.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    const payload = await readResponseBody(response);
    return NextResponse.json(payload, { status: response.status });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "OpenReturn API is unavailable";
    return NextResponse.json({ error: { code: "api_unavailable", message } }, { status: 502 });
  }
}

/** Reads a JSON request body, returning an empty object for absent or malformed bodies. */
export async function requestJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {
      error: {
        code: "non_json_response",
        message: text
      }
    };
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      error: {
        code: "invalid_json_response",
        message: text
      }
    };
  }
}
