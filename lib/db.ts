import "server-only";
import { MongoClient, type Collection, type Db } from "mongodb";
import { env } from "@/lib/env";
import type { ChatDoc, MessageDoc, ParticipantDoc, RateLimitDoc } from "@/lib/types";

type Cache = { client?: MongoClient; indexes?: Promise<void> };

// Reused across hot reloads in dev and across invocations of a warm serverless instance.
const g = globalThis as typeof globalThis & { __datblobMongo?: Cache };
const cache: Cache = (g.__datblobMongo ??= {});

export function mongoClient(): MongoClient {
  if (!cache.client) {
    cache.client = new MongoClient(env().MONGODB_URI, {
      appName: "datblob",
      maxPoolSize: 10,
      // Serverless: don't hold idle sockets forever.
      maxIdleTimeMS: 60_000,
      serverSelectionTimeoutMS: 8_000,
    });
  }
  return cache.client;
}

export function database(): Db {
  return mongoClient().db(env().MONGODB_DB);
}

export function collections() {
  const db = database();
  return {
    chats: db.collection<ChatDoc>("chats"),
    participants: db.collection<ParticipantDoc>("participants"),
    messages: db.collection<MessageDoc>("messages"),
    rateLimits: db.collection<RateLimitDoc>("rateLimits"),
  };
}

export type Collections = ReturnType<typeof collections>;

export async function ensureIndexes(db: Db = database()): Promise<void> {
  const chats: Collection<ChatDoc> = db.collection("chats");
  const participants: Collection<ParticipantDoc> = db.collection("participants");
  const messages: Collection<MessageDoc> = db.collection("messages");
  const rateLimits: Collection<RateLimitDoc> = db.collection("rateLimits");

  await Promise.all([
    // TTL: Mongo removes the chat document itself once expiresAt passes.
    chats.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "ttl_expiresAt" }),
    chats.createIndex({ ownerId: 1, lastActivityAt: -1 }, { name: "owner_recent" }),
    participants.createIndex({ chatId: 1, joinedAt: 1 }, { name: "chat_joined" }),
    participants.createIndex(
      { chatId: 1, displayNameLower: 1 },
      { unique: true, name: "chat_unique_name" },
    ),
    participants.createIndex(
      { tokenHash: 1 },
      { unique: true, partialFilterExpression: { tokenHash: { $type: "string" } }, name: "token" },
    ),
    messages.createIndex({ chatId: 1, seq: 1 }, { unique: true, name: "chat_seq" }),
    messages.createIndex(
      { chatId: 1, participantId: 1, clientId: 1 },
      { partialFilterExpression: { clientId: { $type: "string" } }, name: "chat_client_dedupe" },
    ),
    rateLimits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "ttl_expiresAt" }),
  ]);
}

/** Idempotent; runs once per cold start so a fresh deployment is self-provisioning. */
export function ready(): Promise<void> {
  cache.indexes ??= ensureIndexes().catch((err) => {
    // Don't let one failed cold-start connection poison this instance: drop the client so the next request reconnects.
    const broken = cache.client;
    cache.client = undefined;
    cache.indexes = undefined;
    void broken?.close().catch(() => {});
    throw err;
  });
  return cache.indexes;
}
