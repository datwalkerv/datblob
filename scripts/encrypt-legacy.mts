/**
 * One-off migration: encrypts chats and messages written before encryption at
 * rest existed. Idempotent — documents that are already encrypted are skipped.
 *   pnpm db:encrypt-legacy            # apply
 *   pnpm db:encrypt-legacy --dry-run  # just count
 */
import { existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);
const dryRun = process.argv.includes("--dry-run");

const { collections, mongoClient } = await import("../lib/db");
const { chatCipher, newChatKey } = await import("../lib/crypto");

type Legacy = { title?: string; body?: string };
const { chats, messages } = collections();

// 1. Give every legacy chat a data key and encrypt its title.
const legacyChats = await chats.find({ wrappedKey: { $exists: false } }).toArray();
for (const chat of legacyChats) {
  const { key, wrapped } = newChatKey(chat._id);
  const titleEnc = chatCipher({ _id: chat._id, wrappedKey: wrapped }, key).encryptTitle(
    (chat as unknown as Legacy).title ?? "Untitled blob",
  );
  if (!dryRun)
    await chats.updateOne(
      { _id: chat._id, wrappedKey: { $exists: false } },
      { $set: { wrappedKey: wrapped, titleEnc }, $unset: { title: "" } },
    );
}

// 2. Encrypt legacy message bodies with their chat's key.
let encrypted = 0;
let orphaned = 0;
const legacyMessages = await messages.find({ bodyEnc: { $exists: false } }).toArray();
for (const msg of legacyMessages) {
  const chat = await chats.findOne({ _id: msg.chatId });
  if (!chat?.wrappedKey) {
    // Chat is gone (or this is a dry run and it has no key yet): nothing may keep plaintext around.
    if (!chat) {
      orphaned++;
      if (!dryRun) await messages.deleteOne({ _id: msg._id });
    }
    continue;
  }
  const bodyEnc = chatCipher(chat).encryptBody(msg.seq, (msg as unknown as Legacy).body ?? "");
  if (!dryRun) await messages.updateOne({ _id: msg._id }, { $set: { bodyEnc }, $unset: { body: "" } });
  encrypted++;
}

console.log(
  `${dryRun ? "[dry run] " : ""}chats: ${legacyChats.length} keyed, messages: ${dryRun ? legacyMessages.length - orphaned : encrypted} encrypted, ${orphaned} orphaned plaintext messages deleted`,
);
await mongoClient().close();
