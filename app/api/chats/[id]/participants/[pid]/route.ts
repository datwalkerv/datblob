import { ready } from "@/lib/db";
import { handleError } from "@/lib/chats/errors";
import { removeParticipant } from "@/lib/chats/service";
import { fail, limited, noContent, sameOrigin } from "@/lib/http";
import { PARTICIPANT_ID_RE, isChatId } from "@/lib/ids";
import { RULES, consume } from "@/lib/rate-limit";
import { sessionFrom } from "@/lib/session";

type Ctx = { params: Promise<{ id: string; pid: string }> };

export async function DELETE(req: Request, { params }: Ctx) {
  const { id, pid } = await params;
  if (!sameOrigin(req)) return fail("forbidden", "Cross-origin request blocked.");
  if (!isChatId(id) || !PARTICIPANT_ID_RE.test(pid)) return fail("not_found", "Not found.");
  try {
    await ready();
    const session = await sessionFrom(req);
    if (!session) return fail("unauthorized", "Sign in to manage this chat.");
    const verdict = await consume(`mutate:${session.user.id}`, RULES.mutate);
    if (!verdict.allowed) return limited(verdict);

    const removed = await removeParticipant(id, session.user.id, pid);
    return removed ? noContent() : fail("not_found", "Not found.");
  } catch (err) {
    return handleError(err);
  }
}
