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
  /** Bumped whenever messages are deleted (someone left), so clients know to reload instead of append. */
  rev?: number;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
};

export type ParticipantRole = "owner" | "guest";

export type ParticipantDoc = {
  _id: string;
  chatId: string;
  role: ParticipantRole;
  /** Set for the owner and for signed-in guests: membership follows the account, not a cookie. */
  userId?: string;
  /** Account blob seed (see lib/account.ts). Anonymous guests get a per-chat seed instead. */
  avatarSeed?: string;
  displayName: string;
  displayNameLower: string;
  /** sha256 of the guest's bearer token; the raw token only ever lives in their cookie. */
  tokenHash?: string;
  joinedAt: Date;
  lastSeenAt: Date;
  /** Last poll while the chat tab was visible and focused. Used to skip pushes to people already looking. */
  lastFocusedAt?: Date;
  removed: boolean;
};

export type PushSubscriptionDoc = {
  /** sha256(chatId + endpoint): one row per chat per browser. */
  _id: string;
  chatId: string;
  participantId: string;
  /** The browser's push subscription JSON, encrypted with the chat key (endpoints identify devices). */
  subscriptionEnc: string;
  createdAt: Date;
  lastPushedAt?: Date;
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
  rev: number;
  locked: boolean;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
};

export type ParticipantView = {
  id: string;
  name: string;
  /** Blobatar seed to render this person with. */
  avatar: string;
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
  /** True when the client's copy is stale (messages were deleted): replace, don't merge. */
  reset: boolean;
  serverTime: string;
};

export type OwnedChatListItem = ChatSummary & { participants: number; online: number };

export type JoinedChatListItem = OwnedChatListItem & { ownerName: string; ownerAvatar: string };
