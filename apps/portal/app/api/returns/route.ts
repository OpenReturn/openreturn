import type { NextRequest } from "next/server";
import { proxyApiRequest, requestJson } from "../proxy";

export async function GET(request: NextRequest) {
  return proxyApiRequest(request, `/returns${request.nextUrl.search}`);
}

export async function POST(request: NextRequest) {
  return proxyApiRequest(request, "/returns", { method: "POST", body: await requestJson(request) });
}
