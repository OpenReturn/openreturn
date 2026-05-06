import type { NextRequest } from "next/server";
import { proxyApiRequest, requestJson } from "../../proxy";

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  return proxyApiRequest(request, `/returns/${encodeURIComponent(context.params.id)}`);
}

export async function PUT(request: NextRequest, context: { params: { id: string } }) {
  return proxyApiRequest(request, `/returns/${encodeURIComponent(context.params.id)}`, {
    method: "PUT",
    body: await requestJson(request)
  });
}
