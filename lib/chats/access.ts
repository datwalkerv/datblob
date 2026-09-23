import "server-only";
import { collections } from "@/lib/db";
import { isExpired } from "@/lib/chats/expiry";
import { purgeChat } from "@/lib/chats/delete";
import { isChatId, sha256 } from "@/lib/ids";
import type { ChatDoc, ParticipantDoc } from "@/lib/types";

export const GUEST_COOKIE_PREFIX = "db_p_";
export const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function guestCookieName(chatId: string): string {
  return `${GUEST_COOKIE_PREFIX}${chatId}`;
}

/**
 * The single gate every chat read and write goes through. An expired chat is
 * treated exactly like a missing one — and deleted on the spot, so nothing
 * lingers between TTL sweeps.
 */
export async function getLiveChat(chatId: string): Promise<ChatDoc | null> {
  if (!isChatId(chatId)) return null;
  const chat = await collections().chats.findOne({ _id: chatId });
  if (!chat) return null;
  if (isExpired(chat.expiresAt)) {
    await purgeChat(chat._id);
    return null;
  }
  return chat;
}

export type Caller = { userId?: string | null; guestToken?: string | null };

export type Access =
  | { status: "gone" }
  | { status: "visitor"; chat: ChatDoc }
  | { status: "removed"; chat: ChatDoc }
  | { status: "member"; chat: ChatDoc; participant: ParticipantDoc; isOwner: boolean };

export async function resolveAccess(chatId: string, caller: Caller): Promise<Access> {
  const chat = await getLiveChat(chatId);
  if (!chat) return { status: "gone" };
  const { participants } = collections();

  if (caller.userId && caller.userId === chat.ownerId) {
    const owner = await participants.findOne({ chatId: chat._id, role: "owner", userId: caller.userId });
    if (owner) return { status: "member", chat, participant: owner, isOwner: true };
  }

  if (caller.guestToken && caller.guestToken.length >= 32 && caller.guestToken.length <= 64) {
    const guest = await participants.findOne({
      chatId: chat._id,
      role: "guest",
      tokenHash: sha256(caller.guestToken),
    });
    if (guest && !guest.removed) return { status: "member", chat, participant: guest, isOwner: false };
    if (guest?.removed) return { status: "removed", chat };
  }

  return { status: "visitor", chat };
}

/** Owner-only operations: a chat that isn't yours is indistinguishable from one that doesn't exist. */
export async function getOwnedChat(chatId: string, userId: string): Promise<ChatDoc | null> {
  const chat = await getLiveChat(chatId);
  if (!chat || chat.ownerId !== userId) return null;
  return chat;
}
