export const apiBaseUrl =
  process.env.OPENRETURN_API_BASE_URL ??
  process.env.NEXT_PUBLIC_OPENRETURN_API_BASE_URL ??
  "http://localhost:4000";

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers
    },
    cache: "no-store"
  });
  const payload = (await response.json()) as T;
  if (!response.ok) {
    throw new Error(JSON.stringify(payload));
  }
  return payload;
}
