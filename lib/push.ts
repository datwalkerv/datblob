import "server-only";
import webpush, { WebPushError } from "web-push";
import { z } from "zod";
import { getLiveChat } from "@/lib/chats/access";
import { chatCipher } from "@/lib/crypto";
import { collections } from "@/lib/db";
import { env, pushPublicKey } from "@/lib/env";
import { sha256 } from "@/lib/ids";
import type { ChatDoc, ParticipantDoc } from "@/lib/types";

/**
 * Web Push for new messages, so people hear about a chat even when it isn't
 * open (on iPhone: once datblob is added to the Home Screen).
 *
 * Privacy:
 *   - Payloads are end-to-end encrypted to the browser by the Web Push
 *     protocol; the push service (Google, Apple, Mozilla, Microsoft) can't
 *     read them. Even so, they only say *who* wrote — never the message text.
 *   - Subscriptions are stored encrypted with the chat key and are deleted
 *     with the chat, or when the participant is removed.
 */

/** People focused on the chat within this window don't get a push: they're already looking. */
const FOCUS_WINDOW_MS = 25_000;
/** One notification per subscription per window; later ones replace it (same tag) anyway. */
const PUSH_GAP_MS = 10_000;
const MAX_SUBSCRIPTIONS_PER_CHAT = 100;
const TTL_SECONDS = 6 * 60 * 60;

/**
 * Only real browser push services. Without this, a forged "subscription"
 * would make our server POST to any URL it names (SSRF).
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
];

export const subscriptionSchema = z.object({
  endpoint: z
    .url()
    .max(1024)
    .refine((u) => {
      const url = new URL(u);
      return url.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(url.hostname));
    }, "Unsupported push service"),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(16).max(256),
    auth: z.string().min(8).max(64),
  }),
});
export type BrowserSubscription = z.infer<typeof subscriptionSchema>;

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const publicKey = pushPublicKey();
  const e = env();
  if (!publicKey || !e.VAPID_PRIVATE_KEY) return false;
  const subject =
    e.VAPID_SUBJECT ||
    (e.BETTER_AUTH_URL?.startsWith("https://") ? e.BETTER_AUTH_URL : "mailto:push@datblob.invalid");
  webpush.setVapidDetails(subject, publicKey, e.VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

function subscriptionId(chatId: string, endpoint: string): string {
  return sha256(`${chatId}\n${endpoint}`);
}

export class PushLimitError extends Error {}

export async function saveSubscription(chat: ChatDoc, participant: ParticipantDoc, sub: BrowserSubscription) {
  const { pushSubscriptions } = collections();
  const _id = subscriptionId(chat._id, sub.endpoint);
  const existing = await pushSubscriptions.countDocuments({ chatId: chat._id, _id: { $ne: _id } });
  if (existing >= MAX_SUBSCRIPTIONS_PER_CHAT) throw new PushLimitError("Too many devices subscribed to this chat.");

  const subscriptionEnc = chatCipher(chat).encryptField("push", JSON.stringify(sub));
  // Upsert: the same browser re-subscribing (or switching identity in this chat) replaces its row.
  await pushSubscriptions.updateOne(
    { _id },
    {
      $set: { chatId: chat._id, participantId: participant._id, subscriptionEnc },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
}

export async function removeSubscription(chat: ChatDoc, participant: ParticipantDoc, endpoint: string) {
  await collections().pushSubscriptions.deleteOne({
    _id: subscriptionId(chat._id, endpoint),
    participantId: participant._id,
  });
}

/**
 * Notify everyone in the chat except the sender. Runs after the response is
 * sent (via `after()`), so it never slows down sending. Never throws.
 */
export async function notifyChat(chatId: string, senderId: string, kind: "message" | "image"): Promise<void> {
  try {
    if (!configure()) return;
    const chat = await getLiveChat(chatId);
    if (!chat) return;
    const { participants, pushSubscriptions } = collections();
    const now = Date.now();

    const subs = await pushSubscriptions
      .find({
        chatId,
        participantId: { $ne: senderId },
        $or: [{ lastPushedAt: { $exists: false } }, { lastPushedAt: { $lt: new Date(now - PUSH_GAP_MS) } }],
      })
      .toArray();
    if (!subs.length) return;

    const people = await participants
      .find({ chatId, _id: { $in: [...new Set([senderId, ...subs.map((s) => s.participantId)])] } })
      .toArray();
    const byId = new Map(people.map((p) => [p._id, p]));
    const sender = byId.get(senderId);
    const cipher = chatCipher(chat);

    const payload = JSON.stringify({
      title: cipher.decryptTitle(chat.titleEnc),
      body: `${sender?.displayName ?? "Someone"} ${kind === "image" ? "sent a photo" : "sent a message"}`,
      url: `/c/${chatId}`,
      tag: `chat-${chatId}`,
    });

    await Promise.allSettled(
      subs.map(async (row) => {
        const recipient = byId.get(row.participantId);
        if (!recipient || recipient.removed) {
          await pushSubscriptions.deleteOne({ _id: row._id });
          return;
        }
        if (recipient.lastFocusedAt && now - recipient.lastFocusedAt.getTime() < FOCUS_WINDOW_MS) return;

        let sub: BrowserSubscription;
        try {
          sub = subscriptionSchema.parse(JSON.parse(cipher.decryptField("push", row.subscriptionEnc)));
        } catch {
          await pushSubscriptions.deleteOne({ _id: row._id });
          return;
        }
        try {
          await webpush.sendNotification(sub, payload, { TTL: TTL_SECONDS, urgency: "high", timeout: 10_000 });
          await pushSubscriptions.updateOne({ _id: row._id }, { $set: { lastPushedAt: new Date() } });
        } catch (err) {
          // 404/410: the browser unsubscribed or the subscription expired.
          if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
            await pushSubscriptions.deleteOne({ _id: row._id });
          } else {
            console.warn("[datblob] push failed", err instanceof WebPushError ? err.statusCode : (err as Error).message);
          }
        }
      }),
    );
  } catch (err) {
    console.error("[datblob] notifyChat failed", (err as Error).message);
  }
}
