/** Server-side API base URL used by portal server components. */
export const apiBaseUrl =
  process.env.OPENRETURN_API_BASE_URL ??
  process.env.NEXT_PUBLIC_OPENRETURN_API_BASE_URL ??
  "http://localhost:4000";

/** Fetches JSON from the OpenReturn API and raises readable structured errors. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });
  const payload = await readResponseBody(response);
  if (!response.ok) {
    throw new Error(formatApiError(payload));
  }
  return payload as T;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { error: { code: "non_json_response", message: text } };
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: { code: "invalid_json_response", message: text } };
  }
}

function formatApiError(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error
  ) {
    return String(payload.error.message);
  }
  return JSON.stringify(payload);
}
