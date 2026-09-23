import "server-only";
import { collections } from "@/lib/db";
import { env } from "@/lib/env";
import { hmac } from "@/lib/ids";

export type Rule = { window: number; max: number };
export type Verdict = { allowed: boolean; retryAfter: number | null };

export const RULES = {
  createChat: { window: 60 * 60, max: 10 },
  join: { window: 60, max: 10 },
  message: { window: 10, max: 20 },
  sync: { window: 60, max: 120 },
  mutate: { window: 60, max: 30 },
} satisfies Record<string, Rule>;

function secret(): string {
  const e = env();
  return e.RATE_LIMIT_SECRET ?? e.BETTER_AUTH_SECRET;
}

/**
 * Fixed-window counter in Mongo. One atomic upsert per request; windows clean
 * themselves up through a TTL index. Keys are HMAC'd so no raw IPs or user ids
 * are ever written — the collection only holds opaque counters.
 */
export async function consume(key: string, rule: Rule, now = Date.now()): Promise<Verdict> {
  const windowMs = rule.window * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const windowEnd = windowStart + windowMs;
  const id = `${hmac(secret(), key)}:${windowStart}`;

  const doc = await collections().rateLimits.findOneAndUpdate(
    { _id: id },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowEnd + 60_000) } },
    { upsert: true, returnDocument: "after" },
  );
  const count = doc?.count ?? 1;
  if (count <= rule.max) return { allowed: true, retryAfter: null };
  return { allowed: false, retryAfter: Math.max(1, Math.ceil((windowEnd - now) / 1000)) };
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}
