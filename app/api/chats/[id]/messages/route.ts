import { accessFromRequest } from "@/lib/chats/caller";
import { handleError } from "@/lib/chats/errors";
import { sendMessage } from "@/lib/chats/service";
import { fail, invalid, limited, ok, readJson, sameOrigin } from "@/lib/http";
import { RULES, consume } from "@/lib/rate-limit";
import { sendMessageInput } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!sameOrigin(req)) return fail("forbidden", "Cross-origin request blocked.");
  try {
    const access = await accessFromRequest(req, id);
    if (access.status === "gone") return fail("gone", "This chat has ended.");
    if (access.status === "removed") return fail("forbidden", "You were removed from this chat.");
    if (access.status === "visitor") return fail("unauthorized", "Join the chat first.");

    const verdict = await consume(`msg:${access.participant._id}`, RULES.message);
    if (!verdict.allowed) return limited(verdict);

    const parsed = sendMessageInput.safeParse(await readJson(req));
    if (!parsed.success) return invalid(parsed.error);

    const message = await sendMessage(access.chat, access.participant, parsed.data.body, parsed.data.clientId);
    return ok({ message }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
