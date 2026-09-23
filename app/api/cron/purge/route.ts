import { ready } from "@/lib/db";
import { purgeExpired } from "@/lib/chats/delete";
import { env } from "@/lib/env";
import { fail, ok } from "@/lib/http";
import { safeEqual } from "@/lib/ids";

/** Invoked daily by Vercel Cron (see vercel.json). Safety net behind the TTL index. */
export async function GET(req: Request) {
  const secret = env().CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return fail("unauthorized", "Unauthorized.");
  await ready();
  const result = await purgeExpired();
  return ok({ ok: true, ...result });
}
