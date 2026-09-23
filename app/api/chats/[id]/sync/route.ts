import { accessFromRequest } from "@/lib/chats/caller";
import { handleError } from "@/lib/chats/errors";
import { syncChat } from "@/lib/chats/service";
import { fail, invalid, limited, ok } from "@/lib/http";
import { RULES, consume } from "@/lib/rate-limit";
import { syncQuery } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const query = syncQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!query.success) return invalid(query.error);

    const access = await accessFromRequest(req, id);
    if (access.status === "gone") return fail("gone", "This chat has ended.");
    if (access.status === "removed") return fail("forbidden", "You were removed from this chat.");
    if (access.status === "visitor") return fail("unauthorized", "Join the chat first.");

    const verdict = await consume(`sync:${access.participant._id}`, RULES.sync);
    if (!verdict.allowed) return limited(verdict);

    return ok(await syncChat(access.chat, access.participant, query.data.after));
  } catch (err) {
    return handleError(err);
  }
}
