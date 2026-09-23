import { NextResponse } from "next/server";
import { GUEST_COOKIE_MAX_AGE, guestCookieName } from "@/lib/chats/access";
import { accessFromRequest } from "@/lib/chats/caller";
import { handleError } from "@/lib/chats/errors";
import { joinChat } from "@/lib/chats/service";
import { fail, invalid, limited, readJson, sameOrigin } from "@/lib/http";
import { RULES, clientIp, consume } from "@/lib/rate-limit";
import { joinChatInput } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!sameOrigin(req)) return fail("forbidden", "Cross-origin request blocked.");
  try {
    const verdict = await consume(`join:${clientIp(req.headers)}`, RULES.join);
    if (!verdict.allowed) return limited(verdict);

    const access = await accessFromRequest(req, id);
    if (access.status === "gone") return fail("gone", "This chat has ended.");
    if (access.status === "removed") return fail("forbidden", "You were removed from this chat.");
    if (access.status === "member") return NextResponse.json({ participantId: access.participant._id });

    const parsed = joinChatInput.safeParse(await readJson(req));
    if (!parsed.success) return invalid(parsed.error);

    const { participant, token } = await joinChat(access.chat, parsed.data.displayName);
    const res = NextResponse.json(
      { participantId: participant._id },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
    res.cookies.set(guestCookieName(id), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: GUEST_COOKIE_MAX_AGE,
    });
    return res;
  } catch (err) {
    return handleError(err);
  }
}
