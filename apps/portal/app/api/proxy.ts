import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiBaseUrl } from "../../lib/api";

export async function proxyApiRequest(
  request: NextRequest,
  path: string,
  options: { method?: string; body?: unknown } = {}
) {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? request.method,
      headers: {
        accept: "application/json",
        ...(options.body ? { "content-type": "application/json" } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    const payload = (await response.json()) as unknown;
    return NextResponse.json(payload, { status: response.status });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "OpenReturn API is unavailable";
    return NextResponse.json(
      { error: { code: "api_unavailable", message } },
      { status: 502 }
    );
  }
}

export async function requestJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
