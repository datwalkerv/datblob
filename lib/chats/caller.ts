import "server-only";
import { cookies } from "next/headers";
import { guestCookieName, resolveAccess, type Access } from "@/lib/chats/access";
import { ready } from "@/lib/db";
import { isChatId } from "@/lib/ids";
import { getSession, sessionFrom } from "@/lib/session";

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** Route handlers: resolve who is calling from the request's session + guest cookie. */
export async function accessFromRequest(req: Request, chatId: string): Promise<Access> {
  if (!isChatId(chatId)) return { status: "gone" };
  await ready();
  const session = await sessionFrom(req);
  return resolveAccess(chatId, {
    userId: session?.user.id,
    guestToken: readCookie(req, guestCookieName(chatId)),
  });
}

/** Server components: same resolution using next/headers. */
export async function accessFromContext(chatId: string): Promise<Access> {
  if (!isChatId(chatId)) return { status: "gone" };
  await ready();
  const [session, jar] = await Promise.all([getSession(), cookies()]);
  return resolveAccess(chatId, {
    userId: session?.user.id,
    guestToken: jar.get(guestCookieName(chatId))?.value,
  });
}
