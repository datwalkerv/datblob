import { z } from "zod";
import { accessFromRequest } from "@/lib/chats/caller";
import { handleError } from "@/lib/chats/errors";
import { pushPublicKey } from "@/lib/env";
import { fail, invalid, limited, noContent, readJson, sameOrigin } from "@/lib/http";
import { PushLimitError, removeSubscription, saveSubscription, subscriptionSchema } from "@/lib/push";
import { RULES, consume } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

async function member(req: Request, id: string) {
  if (!sameOrigin(req)) return { error: fail("forbidden", "Cross-origin request blocked.") };
  if (!pushPublicKey()) return { error: fail("unavailable", "Notifications aren't enabled on this server.") };
  const access = await accessFromRequest(req, id);
  if (access.status === "gone") return { error: fail("gone", "This chat has ended.") };
  if (access.status !== "member") return { error: fail("unauthorized", "Join the chat first.") };
  const verdict = await consume(`push:${access.participant._id}`, RULES.mutate);
  if (!verdict.allowed) return { error: limited(verdict) };
  return { access };
}

/** Subscribe this browser to notifications for this chat. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const m = await member(req, id);
    if ("error" in m) return m.error;
    const parsed = z.object({ subscription: subscriptionSchema }).safeParse(await readJson(req));
    if (!parsed.success) return invalid(parsed.error);
    await saveSubscription(m.access.chat, m.access.participant, parsed.data.subscription);
    return noContent();
  } catch (err) {
    if (err instanceof PushLimitError) return fail("limit_reached", err.message);
    return handleError(err);
  }
}

/** Unsubscribe this browser from this chat (the browser-wide subscription is left alone for other chats). */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const m = await member(req, id);
    if ("error" in m) return m.error;
    const parsed = z.object({ endpoint: z.url().max(1024) }).safeParse(await readJson(req));
    if (!parsed.success) return invalid(parsed.error);
    await removeSubscription(m.access.chat, m.access.participant, parsed.data.endpoint);
    return noContent();
  } catch (err) {
    return handleError(err);
  }
}
