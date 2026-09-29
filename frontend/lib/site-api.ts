const configuredApiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");

export const API_BASE_URL = configuredApiUrl.endsWith("/api/v1") ? configuredApiUrl : `${configuredApiUrl}/api/v1`;

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    let message = "We could not complete that request. Please try again.";
    try {
      const problem = (await response.json()) as { detail?: string };
      if (problem.detail) message = problem.detail;
    } catch {
      message = "The service returned an unexpected response.";
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}