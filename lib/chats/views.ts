import "server-only";
import { presenceOf } from "@/lib/chats/expiry";
import { chatCipher, type ChatCipher } from "@/lib/crypto";
import type {
  ChatDoc,
  ChatSummary,
  MessageDoc,
  MessageView,
  ParticipantDoc,
  ParticipantView,
} from "@/lib/types";

export function toChatSummary(chat: ChatDoc, cipher: ChatCipher): ChatSummary {
  return {
    id: chat._id,
    title: cipher.decryptTitle(chat.titleEnc),
    locked: chat.locked,
    createdAt: chat.createdAt.toISOString(),
    lastActivityAt: chat.lastActivityAt.toISOString(),
    expiresAt: chat.expiresAt.toISOString(),
  };
}

/** Summary for a chat when no cipher is at hand yet (unwraps the chat key). */
export function summarize(chat: ChatDoc): ChatSummary {
  return toChatSummary(chat, chatCipher(chat));
}

export function toParticipantView(p: ParticipantDoc, now = new Date()): ParticipantView {
  return {
    id: p._id,
    name: p.displayName,
    role: p.role,
    presence: p.removed ? "offline" : presenceOf(p.lastSeenAt, now),
    removed: p.removed,
  };
}

export function toMessageView(m: MessageDoc, cipher: ChatCipher): MessageView {
  return {
    id: m._id.toHexString(),
    seq: m.seq,
    participantId: m.participantId,
    body: cipher.decryptBody(m.seq, m.bodyEnc),
    createdAt: m.createdAt.toISOString(),
    ...(m.clientId ? { clientId: m.clientId } : {}),
  };
}
