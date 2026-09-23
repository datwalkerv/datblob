import { ready } from "@/lib/db";
import { handleError } from "@/lib/chats/errors";
import { closeChat, updateChat } from "@/lib/chats/service";
import { fail, invalid, limited, noContent, ok, readJson, sameOrigin } from "@/lib/http";
import { isChatId } from "@/lib/ids";
import { RULES, consume } from "@/lib/rate-limit";
import { sessionFrom } from "@/lib/session";
import { updateChatInput } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

async function owner(req: Request, id: string) {
  if (!sameOrigin(req)) return { error: fail("forbidden", "Cross-origin request blocked.") };
  if (!isChatId(id)) return { error: fail("not_found", "Chat not found.") };
  await ready();
  const session = await sessionFrom(req);
  if (!session) return { error: fail("unauthorized", "Sign in to manage this chat.") };
  const verdict = await consume(`mutate:${session.user.id}`, RULES.mutate);
  if (!verdict.allowed) return { error: limited(verdict) };
  return { userId: session.user.id };
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const who = await owner(req, id);
    if ("error" in who) return who.error;
    const parsed = updateChatInput.safeParse(await readJson(req));
    if (!parsed.success) return invalid(parsed.error);
    const chat = await updateChat(id, who.userId, parsed.data);
    return chat ? ok({ chat }) : fail("not_found", "Chat not found.");
  } catch (err) {
    return handleError(err);
  }
}

/** Close = permanent deletion of the chat, its messages and its participants. */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const who = await owner(req, id);
    if ("error" in who) return who.error;
    const closed = await closeChat(id, who.userId);
    return closed ? noContent() : fail("not_found", "Chat not found.");
  } catch (err) {
    return handleError(err);
  }
}
