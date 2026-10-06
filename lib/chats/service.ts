import "server-only";
import { MongoServerError, ObjectId } from "mongodb";
import { collections } from "@/lib/db";
import {
  MAX_LIVE_CHATS_PER_OWNER,
  MAX_PARTICIPANTS,
  OWNER_KEEPALIVE_MS,
  PRESENCE_WRITE_MS,
  expiryFrom,
} from "@/lib/chats/expiry";
import { getOwnedChat } from "@/lib/chats/access";
import { imageFileIds, purgeChat } from "@/lib/chats/delete";
import { deleteBlobs } from "@/lib/storage";
import { accountAvatarSeed } from "@/lib/account";
import { summarize, toChatSummary, toMessageView, toParticipantView } from "@/lib/chats/views";
import { chatCipher, newChatKey } from "@/lib/crypto";
import { randomId, sha256 } from "@/lib/ids";
import { LIMITS, displayNameSchema } from "@/lib/validation";
import type {
  ChatDoc,
  ChatSummary,
  ImageAttachment,
  MessageDoc,
  MessageView,
  OwnedChatListItem,
  ParticipantDoc,
  SyncPayload,
} from "@/lib/types";

export class ChatError extends Error {
  constructor(
    public code: "bad_request" | "not_found" | "gone" | "forbidden" | "conflict" | "limit_reached",
    message: string,
  ) {
    super(message);
  }
}

const DEFAULT_TITLE = "Untitled blob";
const PAGE = 200;

function isDuplicateKey(err: unknown): boolean {
  return err instanceof MongoServerError && err.code === 11000;
}

/** Account names come from GitHub or sign-up; coerce them into something that fits a chat. */
export function ownerDisplayName(name: string | null | undefined): string {
  const parsed = displayNameSchema.safeParse((name ?? "").slice(0, LIMITS.displayName.max));
  return parsed.success ? parsed.data : "Owner";
}

/* ------------------------------------------------------------------ create */

export async function createChat(input: {
  ownerId: string;
  ownerName: string;
  title?: string;
}): Promise<ChatDoc> {
  const { chats, participants } = collections();
  const now = new Date();

  const live = await chats.countDocuments({ ownerId: input.ownerId, expiresAt: { $gt: now } });
  if (live >= MAX_LIVE_CHATS_PER_OWNER) {
    throw new ChatError(
      "limit_reached",
      `You can have up to ${MAX_LIVE_CHATS_PER_OWNER} live chats. Close one to start another.`,
    );
  }

  const id = randomId(16);
  const { key, wrapped } = newChatKey(id);
  const chat: ChatDoc = {
    _id: id,
    ownerId: input.ownerId,
    wrappedKey: wrapped,
    titleEnc: chatCipher({ _id: id, wrappedKey: wrapped }, key).encryptTitle(input.title || DEFAULT_TITLE),
    locked: false,
    messageSeq: 0,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: expiryFrom(now),
  };
  await chats.insertOne(chat);

  const displayName = ownerDisplayName(input.ownerName);
  try {
    await participants.insertOne({
      _id: randomId(12),
      chatId: chat._id,
      role: "owner",
      userId: input.ownerId,
      avatarSeed: accountAvatarSeed(input.ownerId),
      displayName,
      displayNameLower: displayName.toLowerCase(),
      joinedAt: now,
      lastSeenAt: now,
      removed: false,
    });
  } catch (err) {
    await purgeChat(chat._id);
    throw err;
  }
  return chat;
}

/* -------------------------------------------------------------------- join */

export async function joinChat(
  chat: ChatDoc,
  displayName: string,
): Promise<{ participant: ParticipantDoc; token: string }> {
  const { chats, participants } = collections();
  if (chat.locked) throw new ChatError("forbidden", "The owner has locked this chat to new people.");

  const count = await participants.countDocuments({ chatId: chat._id, removed: false });
  if (count >= MAX_PARTICIPANTS) throw new ChatError("limit_reached", "This chat is full.");

  const now = new Date();
  const token = randomId(32);
  const participant: ParticipantDoc = {
    _id: randomId(12),
    chatId: chat._id,
    role: "guest",
    displayName,
    displayNameLower: displayName.toLowerCase(),
    tokenHash: sha256(token),
    joinedAt: now,
    lastSeenAt: now,
    removed: false,
  };

  try {
    await participants.insertOne(participant);
  } catch (err) {
    if (isDuplicateKey(err)) throw new ChatError("conflict", "That name is taken in this chat.");
    throw err;
  }

  // Joining counts as activity. If the chat vanished in the meantime, undo.
  const bumped = await chats.updateOne(
    { _id: chat._id, expiresAt: { $gt: now } },
    { $set: { lastActivityAt: now, expiresAt: expiryFrom(now) } },
  );
  if (bumped.matchedCount === 0) {
    await participants.deleteOne({ _id: participant._id });
    throw new ChatError("gone", "This chat has ended.");
  }
  return { participant, token };
}

/**
 * Join as a signed-in user: no name prompt, no cookie. The account name is
 * used (with a numeric suffix if someone in the chat already has it) and the
 * account's blob. Idempotent, including under concurrent requests.
 */
export async function joinChatAsUser(
  chat: ChatDoc,
  user: { id: string; name: string | null | undefined },
): Promise<ParticipantDoc> {
  const { chats, participants } = collections();
  const existing = await participants.findOne({ chatId: chat._id, userId: user.id });
  if (existing?.removed) throw new ChatError("forbidden", "You were removed from this chat.");
  if (existing) return existing;
  if (chat.locked) throw new ChatError("forbidden", "The owner has locked this chat to new people.");

  const count = await participants.countDocuments({ chatId: chat._id, removed: false });
  if (count >= MAX_PARTICIPANTS) throw new ChatError("limit_reached", "This chat is full.");

  const base = ownerDisplayName(user.name);
  const now = new Date();
  for (let n = 1; n <= 9; n++) {
    const displayName = n === 1 ? base : `${base.slice(0, LIMITS.displayName.max - 2)} ${n}`;
    const participant: ParticipantDoc = {
      _id: randomId(12),
      chatId: chat._id,
      role: "guest",
      userId: user.id,
      avatarSeed: accountAvatarSeed(user.id),
      displayName,
      displayNameLower: displayName.toLowerCase(),
      joinedAt: now,
      lastSeenAt: now,
      removed: false,
    };
    try {
      await participants.insertOne(participant);
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      // Same account joined concurrently (e.g. two tabs): use that membership.
      if ((err as MongoServerError).keyPattern?.userId) {
        const raced = await participants.findOne({ chatId: chat._id, userId: user.id });
        if (raced) return raced;
      }
      continue; // name taken: try the next suffix
    }
    await chats.updateOne(
      { _id: chat._id, expiresAt: { $gt: now } },
      { $set: { lastActivityAt: now, expiresAt: expiryFrom(now) } },
    );
    return participant;
  }
  throw new ChatError("conflict", "Couldn't find a free name in this chat. Join with a different name.");
}

/* ---------------------------------------------------------------- messages */

export async function sendMessage(
  chat: ChatDoc,
  participant: ParticipantDoc,
  body: string,
  clientId?: string,
  image?: ImageAttachment,
): Promise<MessageView> {
  const { chats, messages } = collections();
  const cipher = chatCipher(chat);

  if (clientId) {
    const dupe = await messages.findOne({ chatId: chat._id, participantId: participant._id, clientId });
    if (dupe) return toMessageView(dupe, cipher);
  }

  const now = new Date();
  // Allocating the sequence number and extending the chat's life is a single write.
  const updated = await chats.findOneAndUpdate(
    { _id: chat._id, expiresAt: { $gt: now } },
    { $inc: { messageSeq: 1 }, $set: { lastActivityAt: now, expiresAt: expiryFrom(now) } },
    { returnDocument: "after", projection: { messageSeq: 1 } },
  );
  if (!updated) throw new ChatError("gone", "This chat has ended.");

  const message: MessageDoc = {
    _id: new ObjectId(),
    chatId: chat._id,
    seq: updated.messageSeq,
    participantId: participant._id,
    bodyEnc: cipher.encryptBody(updated.messageSeq, body),
    ...(image ? { image } : {}),
    ...(clientId ? { clientId } : {}),
    createdAt: now,
  };
  await messages.insertOne(message);
  return toMessageView(message, cipher);
}

/* -------------------------------------------------------------------- sync */

/**
 * How long an allocated-but-missing sequence number is treated as "in flight".
 * Two senders can allocate seq 5 and 6 and commit in the opposite order; the
 * cursor must not jump past 5 until it either lands or clearly never will.
 */
const GAP_GRACE_MS = 5_000;
const FOCUS_WRITE_MS = 8_000;

export async function syncChat(
  chat: ChatDoc,
  participant: ParticipantDoc,
  requestedAfter: number,
  focused = false,
  knownRev?: number,
): Promise<SyncPayload> {
  const { chats, messages, participants } = collections();
  const now = new Date();

  // Presence + keepalive: conditional writes, so most polls cost zero writes.
  const writes: Promise<unknown>[] = [
    participants.updateOne(
      { _id: participant._id, lastSeenAt: { $lt: new Date(now.getTime() - PRESENCE_WRITE_MS) } },
      { $set: { lastSeenAt: now } },
    ),
  ];
  if (focused) {
    // Someone actively looking at the chat doesn't need a push notification.
    writes.push(
      participants.updateOne(
        {
          _id: participant._id,
          $or: [
            { lastFocusedAt: { $exists: false } },
            { lastFocusedAt: { $lt: new Date(now.getTime() - FOCUS_WRITE_MS) } },
          ],
        },
        { $set: { lastFocusedAt: now } },
      ),
    );
  }
  if (participant.role === "owner") {
    // An owner with the chat open keeps it alive.
    writes.push(
      chats.updateOne(
        {
          _id: chat._id,
          expiresAt: { $gt: now },
          lastActivityAt: { $lt: new Date(now.getTime() - OWNER_KEEPALIVE_MS) },
        },
        { $set: { lastActivityAt: now, expiresAt: expiryFrom(now) } },
      ),
    );
  }

  // Re-read the chat (after our own keepalive, so the expiry is current) *before* querying
  // messages: the reset decision and the revision we report must come from the same read,
  // or a leave landing mid-request could hand the client a new revision without the reset.
  const [people, fresh] = await Promise.all([
    participants.find({ chatId: chat._id }).sort({ joinedAt: 1 }).toArray(),
    Promise.all(writes).then(() => chats.findOne({ _id: chat._id })),
  ]);
  if (!fresh) throw new ChatError("gone", "This chat has ended.");

  // Messages were deleted since the client last synced: send a fresh snapshot instead of a delta.
  const reset = knownRev !== undefined && knownRev !== (fresh.rev ?? 0);
  const after = reset ? 0 : requestedAfter;
  const docs =
    after === 0
      ? (await messages.find({ chatId: chat._id }).sort({ seq: -1 }).limit(PAGE).toArray()).reverse()
      : await messages.find({ chatId: chat._id, seq: { $gt: after } }).sort({ seq: 1 }).limit(PAGE).toArray();

  const cipher = chatCipher(fresh);

  let cursor = after;
  if (after === 0) {
    cursor = docs.at(-1)?.seq ?? 0;
  } else {
    for (const m of docs) {
      if (m.seq === cursor + 1) cursor = m.seq;
      else break;
    }
    const last = docs.at(-1)?.seq ?? cursor;
    const settled = now.getTime() - fresh.lastActivityAt.getTime() > GAP_GRACE_MS;
    if (cursor < last && settled) cursor = last;
  }

  return {
    chat: toChatSummary(fresh, cipher),
    me: { id: participant._id, role: participant.role, name: participant.displayName },
    participants: people.map((p) =>
      toParticipantView(p._id === participant._id ? { ...p, lastSeenAt: now } : p, now),
    ),
    messages: docs.map((d) => toMessageView(d, cipher)),
    cursor,
    reset,
    serverTime: now.toISOString(),
  };
}

/* ------------------------------------------------------------------- leave */

/**
 * A guest leaves: their participant record, every message and photo they
 * sent, and their notification subscriptions are permanently deleted.
 * Owners can't leave; they close the chat instead.
 */
export async function leaveChat(chat: ChatDoc, participant: ParticipantDoc): Promise<{ deletedMessages: number }> {
  if (participant.role === "owner") {
    throw new ChatError("forbidden", "Owners can't leave their own chat. Close it instead.");
  }
  const { chats, messages, participants, pushSubscriptions } = collections();
  const filter = { chatId: chat._id, participantId: participant._id };

  // Revoke access first, so nothing else can be sent while the rest is removed.
  await participants.deleteOne({ _id: participant._id, chatId: chat._id });
  const fileIds = await imageFileIds(filter);
  const [deleted] = await Promise.all([messages.deleteMany(filter), pushSubscriptions.deleteMany(filter)]);
  // Tell everyone else's client to reload rather than keep showing the deleted messages.
  await chats.updateOne({ _id: chat._id }, { $inc: { rev: 1 } });
  await deleteBlobs(fileIds);
  return { deletedMessages: deleted.deletedCount };
}

/* ------------------------------------------------------------- owner tools */

export async function closeChat(chatId: string, userId: string): Promise<boolean> {
  const chat = await getOwnedChat(chatId, userId);
  if (!chat) return false;
  await purgeChat(chat._id);
  return true;
}

export async function updateChat(
  chatId: string,
  userId: string,
  patch: { title?: string; locked?: boolean },
): Promise<ChatSummary | null> {
  const chat = await getOwnedChat(chatId, userId);
  if (!chat) return null;
  const set: Partial<ChatDoc> = {};
  if (patch.title !== undefined) set.titleEnc = chatCipher(chat).encryptTitle(patch.title || DEFAULT_TITLE);
  if (patch.locked !== undefined) set.locked = patch.locked;
  const updated = await collections().chats.findOneAndUpdate(
    { _id: chatId, ownerId: userId, expiresAt: { $gt: new Date() } },
    { $set: set },
    { returnDocument: "after" },
  );
  return updated ? summarize(updated) : null;
}

export async function removeParticipant(
  chatId: string,
  userId: string,
  participantId: string,
): Promise<boolean> {
  const chat = await getOwnedChat(chatId, userId);
  if (!chat) return false;
  const res = await collections().participants.updateOne(
    { _id: participantId, chatId: chat._id, role: "guest", removed: false },
    { $set: { removed: true }, $unset: { tokenHash: "" } },
  );
  if (res.matchedCount > 0) {
    await collections().pushSubscriptions.deleteMany({ chatId: chat._id, participantId });
  }
  return res.matchedCount > 0;
}

export async function listOwnedChats(userId: string): Promise<OwnedChatListItem[]> {
  const { chats, participants } = collections();
  const now = new Date();
  const list = await chats
    .find({ ownerId: userId, expiresAt: { $gt: now } })
    .sort({ lastActivityAt: -1 })
    .limit(MAX_LIVE_CHATS_PER_OWNER * 2)
    .toArray();
  if (!list.length) return [];

  const onlineSince = new Date(now.getTime() - 30_000);
  const counts = await participants
    .aggregate<{ _id: string; participants: number; online: number }>([
      { $match: { chatId: { $in: list.map((c) => c._id) }, removed: false } },
      {
        $group: {
          _id: "$chatId",
          participants: { $sum: 1 },
          online: { $sum: { $cond: [{ $gte: ["$lastSeenAt", onlineSince] }, 1, 0] } },
        },
      },
    ])
    .toArray();
  const byId = new Map(counts.map((c) => [c._id, c]));
  return list.map((c) => ({
    ...summarize(c),
    participants: byId.get(c._id)?.participants ?? 0,
    online: byId.get(c._id)?.online ?? 0,
  }));
}
