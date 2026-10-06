import type { ObjectId } from "mongodb";
import type { ImageMime } from "@/lib/images";

export type ChatDoc = {
  _id: string;
  ownerId: string;
  /** Per-chat AES-256 data key, wrapped with the master key. Deleting it crypto-shreds the chat. */
  wrappedKey: string;
  /** Encrypted with the chat key. */
  titleEnc: string;
  locked: boolean;
  messageSeq: number;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
};

export type ParticipantRole = "owner" | "guest";

export type ParticipantDoc = {
  _id: string;
  chatId: string;
  role: ParticipantRole;
  userId?: string;
  displayName: string;
  displayNameLower: string;
  /** sha256 of the guest's bearer token; the raw token only ever lives in their cookie. */
  tokenHash?: string;
  joinedAt: Date;
  lastSeenAt: Date;
  removed: boolean;
};

export type MessageDoc = {
  _id: ObjectId;
  chatId: string;
  seq: number;
  participantId: string;
  /** Encrypted with the chat key, bound to (chatId, seq). For image messages this is the caption. */
  bodyEnc: string;
  image?: ImageAttachment;
  clientId?: string;
  createdAt: Date;
};

export type ImageAttachment = {
  /** Our id; part of the encryption AAD and the image URL. */
  id: string;
  /** datupload file id. Holds ciphertext only. */
  fileId: string;
  mime: ImageMime;
  size: number;
  width: number;
  height: number;
};

export type RateLimitDoc = {
  _id: string;
  count: number;
  expiresAt: Date;
};

/* ---------- wire types (what the client sees) ---------- */

export type ChatSummary = {
  id: string;
  title: string;
  locked: boolean;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
};

export type ParticipantView = {
  id: string;
  name: string;
  role: ParticipantRole;
  presence: "online" | "away" | "offline";
  removed: boolean;
};

export type MessageView = {
  id: string;
  seq: number;
  participantId: string;
  body: string;
  image?: { url: string; width: number; height: number };
  createdAt: string;
  clientId?: string;
};

export type SyncPayload = {
  chat: ChatSummary;
  me: { id: string; role: ParticipantRole; name: string };
  participants: ParticipantView[];
  messages: MessageView[];
  cursor: number;
  serverTime: string;
};

export type OwnedChatListItem = ChatSummary & { participants: number; online: number };
