import type { NextRequest } from "next/server";
import { proxyApiRequest, requestJson } from "../../../proxy";

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  return proxyApiRequest(request, `/returns/${encodeURIComponent(context.params.id)}/track`, {
    method: "POST",
    body: await requestJson(request)
  });
}
