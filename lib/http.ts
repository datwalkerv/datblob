import "server-only";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import type { Verdict } from "@/lib/rate-limit";

export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "gone"
  | "conflict"
  | "rate_limited"
  | "limit_reached"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  gone: 410,
  conflict: 409,
  rate_limited: 429,
  limit_reached: 422,
  internal: 500,
};

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export function ok<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, { ...init, headers: { ...NO_STORE, ...init?.headers } });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}

export function fail(code: ErrorCode, message: string, headers?: HeadersInit): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { status: STATUS[code], headers: { ...NO_STORE, ...headers } },
  );
}

export function invalid(error: ZodError): NextResponse {
  return fail("bad_request", error.issues[0]?.message ?? "Invalid input");
}

export function limited(v: Verdict): NextResponse {
  return fail("rate_limited", "Slow down a little and try again.", {
    "Retry-After": String(v.retryAfter ?? 5),
  });
}

/** Cheap CSRF defence on top of SameSite cookies: mutations must come from our own origin. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    const text = await req.text();
    if (text.length > 16_384) return null;
    return text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}
