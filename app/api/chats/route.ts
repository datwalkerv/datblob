import { ready } from "@/lib/db";
import { handleError } from "@/lib/chats/errors";
import { createChat } from "@/lib/chats/service";
import { fail, invalid, limited, ok, readJson, sameOrigin } from "@/lib/http";
import { RULES, consume } from "@/lib/rate-limit";
import { sessionFrom } from "@/lib/session";
import { createChatInput } from "@/lib/validation";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("forbidden", "Cross-origin request blocked.");
  try {
    await ready();
    const session = await sessionFrom(req);
    if (!session) return fail("unauthorized", "Sign in to create a chat.");

    const verdict = await consume(`create:${session.user.id}`, RULES.createChat);
    if (!verdict.allowed) return limited(verdict);

    const parsed = createChatInput.safeParse((await readJson(req)) ?? {});
    if (!parsed.success) return invalid(parsed.error);

    const chat = await createChat({
      ownerId: session.user.id,
      ownerName: session.user.name,
      title: parsed.data.title,
    });
    return ok({ id: chat._id }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
