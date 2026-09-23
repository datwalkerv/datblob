import { describe, expect, it } from "vitest";
import { CHAT_TTL_MS, expiryFrom, isExpired, presenceOf } from "@/lib/chats/expiry";
import { formatRemaining, expiryTone } from "@/lib/format";
import { isChatId, randomId, sha256 } from "@/lib/ids";
import { safeNext } from "@/lib/redirect";
import { displayNameSchema, messageBodySchema, titleSchema } from "@/lib/validation";

describe("ids", () => {
  it("chat ids are 22 url-safe chars with 128 bits of entropy", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => randomId(16)));
    expect(ids.size).toBe(2000);
    for (const id of ids) expect(isChatId(id)).toBe(true);
  });
  it("rejects malformed chat ids", () => {
    for (const bad of ["", "short", "a".repeat(23), "../../etc/passwd....", "{$gt: ''}aaaaaaaaaaaa", 42, null])
      expect(isChatId(bad)).toBe(false);
  });
  it("hashes deterministically", () => {
    expect(sha256("x")).toBe(sha256("x"));
    expect(sha256("x")).not.toBe(sha256("y"));
  });
});

describe("validation", () => {
  it("cleans display names", () => {
    expect(displayNameSchema.parse("  Sam   Lee ")).toBe("Sam Lee");
    expect(displayNameSchema.parse("Zoë")).toBe("Zoë");
  });
  it("strips invisible characters", () => {
    expect(displayNameSchema.parse("Sam​‮")).toBe("Sam");
  });
  it("rejects bad display names", () => {
    for (const bad of ["a", "x".repeat(25), "<script>", "  ", "-dash"])
      expect(displayNameSchema.safeParse(bad).success).toBe(false);
  });
  it("keeps newlines in messages but trims and caps", () => {
    expect(messageBodySchema.parse("  hi\nthere  ")).toBe("hi\nthere");
    expect(messageBodySchema.parse("a\n\n\n\n\n\nb")).toBe("a\n\n\nb");
    expect(messageBodySchema.safeParse("   ").success).toBe(false);
    expect(messageBodySchema.safeParse("x".repeat(2001)).success).toBe(false);
  });
  it("limits titles", () => {
    expect(titleSchema.safeParse("x".repeat(61)).success).toBe(false);
  });
});

describe("expiry", () => {
  it("expires exactly 5 days after last activity", () => {
    const t = new Date("2026-01-01T00:00:00Z");
    expect(expiryFrom(t).getTime() - t.getTime()).toBe(CHAT_TTL_MS);
    expect(isExpired(expiryFrom(t), new Date(t.getTime() + CHAT_TTL_MS - 1))).toBe(false);
    expect(isExpired(expiryFrom(t), new Date(t.getTime() + CHAT_TTL_MS))).toBe(true);
  });
  it("derives presence", () => {
    const now = new Date();
    expect(presenceOf(new Date(now.getTime() - 5_000), now)).toBe("online");
    expect(presenceOf(new Date(now.getTime() - 120_000), now)).toBe("away");
    expect(presenceOf(new Date(now.getTime() - 3_600_000), now)).toBe("offline");
  });
  it("formats remaining time", () => {
    expect(formatRemaining(4 * 86_400_000 + 23 * 3_600_000)).toBe("4d 23h");
    expect(formatRemaining(90 * 60_000)).toBe("1h 30m");
    expect(formatRemaining(30_000)).toBe("<1m");
    expect(expiryTone(3_600_000)).toBe("urgent");
  });
});

describe("safeNext", () => {
  it("only allows local paths", () => {
    expect(safeNext("/c/abc")).toBe("/c/abc");
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "/api/auth/x", undefined])
      expect(safeNext(bad)).toBe("/dashboard");
  });
});
