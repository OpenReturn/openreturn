import type { NextRequest } from "next/server";
import { proxyApiRequest } from "../../../proxy";

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  return proxyApiRequest(request, `/returns/${encodeURIComponent(context.params.id)}/label`);
}
