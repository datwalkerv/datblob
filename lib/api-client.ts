"use client";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    cache: "no-store",
    credentials: "same-origin",
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: undefined })
    | { error: { code: string; message: string } }
    | null;
  if (!res.ok || !data || (data as { error?: unknown }).error) {
    const err = (data as { error?: { code: string; message: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "internal", err?.message ?? "Request failed");
  }
  return data as T;
}

export function clientId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
