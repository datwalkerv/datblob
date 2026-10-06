import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Encryption at rest, envelope-style.
 *
 *   master key (env, never in the DB)
 *     └─ wraps → per-chat data key (random, stored wrapped on the chat document)
 *                  └─ encrypts → chat title, every message body
 *
 * Everything is AES-256-GCM with a fresh 96-bit IV per value, and each
 * ciphertext is bound to where it lives via associated data (chat id, and the
 * message's sequence number), so a ciphertext copied into another chat or
 * another slot fails authentication instead of decrypting.
 *
 * Deleting a chat deletes its wrapped key, which crypto-shreds anything left
 * behind: orphaned messages, or copies in a backup that lacks the chat doc.
 *
 * Serialised form: `v1.<iv>.<ciphertext>.<tag>` (base64url). The version
 * prefix leaves room for key rotation later.
 */

const VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

let masterKey: Buffer | undefined;

function master(): Buffer {
  if (!masterKey) {
    const key = Buffer.from(env().DATA_ENCRYPTION_KEY, "base64");
    if (key.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
    masterKey = key;
  }
  return masterKey;
}

function seal(key: Buffer, plaintext: Buffer, aad: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), ct.toString("base64url"), tag.toString("base64url")].join(".");
}

function open(key: Buffer, sealed: string, aad: string): Buffer {
  const [version, iv, ct, tag] = sealed.split(".");
  if (version !== VERSION || !iv || ct === undefined || !tag) throw new Error("Unrecognised ciphertext");
  const decipher = createDecipheriv(ALGO, key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]);
}

/** A fresh data key for a new chat, returned both raw (to use now) and wrapped (to store). */
export function newChatKey(chatId: string): { key: Buffer; wrapped: string } {
  const key = randomBytes(32);
  return { key, wrapped: seal(master(), key, `key:${chatId}`) };
}

export type ChatCipher = {
  encryptTitle(title: string): string;
  decryptTitle(sealed: string): string;
  encryptBody(seq: number, body: string): string;
  decryptBody(seq: number, sealed: string): string;
  /** Binary form for image bytes: iv(12) | ciphertext | tag(16). Bound to the chat and the image id. */
  /** Generic small secrets (e.g. push subscriptions), bound to the chat and a label. */
  encryptField(label: string, value: string): string;
  decryptField(label: string, sealed: string): string;
  encryptImage(imageId: string, bytes: Buffer): Buffer;
  decryptImage(imageId: string, sealed: Buffer): Buffer;
};

const TAG_BYTES = 16;

function sealBytes(key: Buffer, plaintext: Buffer, aad: string): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, ct, cipher.getAuthTag()]);
}

function openBytes(key: Buffer, sealed: Buffer, aad: string): Buffer {
  if (sealed.length < IV_BYTES + TAG_BYTES) throw new Error("Ciphertext too short");
  const decipher = createDecipheriv(ALGO, key, sealed.subarray(0, IV_BYTES));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(sealed.subarray(sealed.length - TAG_BYTES));
  return Buffer.concat([decipher.update(sealed.subarray(IV_BYTES, sealed.length - TAG_BYTES)), decipher.final()]);
}

/** Bytes added by encryptImage (IV + auth tag). */
export const IMAGE_OVERHEAD_BYTES = IV_BYTES + TAG_BYTES;

export function chatCipher(chat: { _id: string; wrappedKey: string }, rawKey?: Buffer): ChatCipher {
  const key = rawKey ?? open(master(), chat.wrappedKey, `key:${chat._id}`);
  const id = chat._id;
  return {
    encryptTitle: (title) => seal(key, Buffer.from(title, "utf8"), `title:${id}`),
    decryptTitle: (sealed) => open(key, sealed, `title:${id}`).toString("utf8"),
    encryptBody: (seq, body) => seal(key, Buffer.from(body, "utf8"), `msg:${id}:${seq}`),
    decryptBody: (seq, sealed) => open(key, sealed, `msg:${id}:${seq}`).toString("utf8"),
    encryptField: (label, value) => seal(key, Buffer.from(value, "utf8"), `field:${label}:${id}`),
    decryptField: (label, sealed) => open(key, sealed, `field:${label}:${id}`).toString("utf8"),
    encryptImage: (imageId, bytes) => sealBytes(key, bytes, `img:${id}:${imageId}`),
    decryptImage: (imageId, sealed) => openBytes(key, sealed, `img:${id}:${imageId}`),
  };
}
