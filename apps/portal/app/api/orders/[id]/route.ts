import type { NextRequest } from "next/server";
import { proxyApiRequest } from "../../proxy";

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  const email = request.nextUrl.searchParams.get("email");
  const suffix = email ? `?email=${encodeURIComponent(email)}` : "";
  return proxyApiRequest(request, `/orders/${encodeURIComponent(context.params.id)}${suffix}`);
}
