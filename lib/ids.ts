import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** URL-safe random identifier. 16 bytes = 128 bits of entropy → 22 chars. */
export function randomId(bytes = 16): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function hmac(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Chat ids are exactly 22 base64url characters; anything else is rejected before touching the DB. */
export const CHAT_ID_RE = /^[A-Za-z0-9_-]{22}$/;
export const PARTICIPANT_ID_RE = /^[A-Za-z0-9_-]{16}$/;

export function isChatId(value: unknown): value is string {
  return typeof value === "string" && CHAT_ID_RE.test(value);
}
