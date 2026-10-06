import { guestCookieName } from "@/lib/chats/access";
import { accessFromRequest } from "@/lib/chats/caller";
import { handleError } from "@/lib/chats/errors";
import { leaveChat } from "@/lib/chats/service";
import { fail, limited, ok, sameOrigin } from "@/lib/http";
import { RULES, consume } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** Leave the chat and permanently delete everything you sent in it. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!sameOrigin(req)) return fail("forbidden", "Cross-origin request blocked.");
  try {
    const access = await accessFromRequest(req, id);
    if (access.status === "gone") return fail("gone", "This chat has ended.");
    if (access.status !== "member") return fail("unauthorized", "You're not in this chat.");

    const verdict = await consume(`leave:${access.participant._id}`, RULES.mutate);
    if (!verdict.allowed) return limited(verdict);

    const result = await leaveChat(access.chat, access.participant);
    const res = ok(result);
    res.cookies.delete({ name: guestCookieName(id), path: "/" });
    return res;
  } catch (err) {
    return handleError(err);
  }
}
