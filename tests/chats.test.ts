import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let replSet: MongoMemoryReplSet;
type Mods = {
  db: typeof import("@/lib/db");
  access: typeof import("@/lib/chats/access");
  service: typeof import("@/lib/chats/service");
  del: typeof import("@/lib/chats/delete");
  rl: typeof import("@/lib/rate-limit");
  crypto: typeof import("@/lib/crypto");
};
let m: Mods;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replSet.getUri();
  process.env.MONGODB_DB = "datblob_test";
  process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-123";
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  m = {
    db: await import("@/lib/db"),
    access: await import("@/lib/chats/access"),
    service: await import("@/lib/chats/service"),
    del: await import("@/lib/chats/delete"),
    rl: await import("@/lib/rate-limit"),
    crypto: await import("@/lib/crypto"),
  };
  await m.db.ensureIndexes();
});

afterAll(async () => {
  await m?.db.mongoClient().close();
  await replSet?.stop();
});

beforeEach(async () => {
  const c = m.db.collections();
  await Promise.all([c.chats.deleteMany({}), c.participants.deleteMany({}), c.messages.deleteMany({}), c.rateLimits.deleteMany({})]);
});

async function setup() {
  const chat = await m.service.createChat({ ownerId: "owner-1", ownerName: "Alice", title: "Plans" });
  const { participant: guest, token } = await m.service.joinChat(chat, "Bob");
  return { chat, guest, token };
}

describe("access control", () => {
  it("resolves the owner by session user id", async () => {
    const { chat } = await setup();
    const a = await m.access.resolveAccess(chat._id, { userId: "owner-1" });
    expect(a.status).toBe("member");
    if (a.status === "member") expect(a.isOwner).toBe(true);
  });

  it("resolves a guest by cookie token, never by a guessed hash", async () => {
    const { chat, token, guest } = await setup();
    const a = await m.access.resolveAccess(chat._id, { guestToken: token });
    expect(a.status === "member" && a.participant._id === guest._id && !a.isOwner).toBe(true);
    const b = await m.access.resolveAccess(chat._id, { guestToken: "x".repeat(43) });
    expect(b.status).toBe("visitor");
  });

  it("a token for one chat does not open another", async () => {
    const { token } = await setup();
    const other = await m.service.createChat({ ownerId: "owner-2", ownerName: "Carol" });
    const a = await m.access.resolveAccess(other._id, { guestToken: token });
    expect(a.status).toBe("visitor");
  });

  it("another signed-in user is just a visitor and cannot close or manage the chat", async () => {
    const { chat, guest } = await setup();
    expect((await m.access.resolveAccess(chat._id, { userId: "intruder" })).status).toBe("visitor");
    expect(await m.service.closeChat(chat._id, "intruder")).toBe(false);
    expect(await m.service.updateChat(chat._id, "intruder", { locked: true })).toBeNull();
    expect(await m.service.removeParticipant(chat._id, "intruder", guest._id)).toBe(false);
    expect(await m.db.collections().chats.countDocuments({ _id: chat._id })).toBe(1);
  });

  it("removed guests lose access immediately", async () => {
    const { chat, guest, token } = await setup();
    expect(await m.service.removeParticipant(chat._id, "owner-1", guest._id)).toBe(true);
    const a = await m.access.resolveAccess(chat._id, { guestToken: token });
    expect(a.status).not.toBe("member");
  });

  it("locked chats refuse new joins and names are unique per chat", async () => {
    const { chat } = await setup();
    await expect(m.service.joinChat(chat, "bob")).rejects.toMatchObject({ code: "conflict" });
    await expect(m.service.joinChat(chat, "alice")).rejects.toMatchObject({ code: "conflict" });
    await m.service.updateChat(chat._id, "owner-1", { locked: true });
    const locked = (await m.access.getLiveChat(chat._id))!;
    await expect(m.service.joinChat(locked, "Dave")).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("deletion & expiry", () => {
  it("closing deletes the chat, its messages and participants", async () => {
    const { chat, guest } = await setup();
    await m.service.sendMessage(chat, guest, "secret");
    expect(await m.service.closeChat(chat._id, "owner-1")).toBe(true);
    const c = m.db.collections();
    expect(await c.chats.countDocuments({ _id: chat._id })).toBe(0);
    expect(await c.messages.countDocuments({ chatId: chat._id })).toBe(0);
    expect(await c.participants.countDocuments({ chatId: chat._id })).toBe(0);
  });

  it("an expired chat is inaccessible and purged on first touch, before the TTL monitor runs", async () => {
    const { chat, guest, token } = await setup();
    await m.service.sendMessage(chat, guest, "old news");
    const c = m.db.collections();
    await c.chats.updateOne({ _id: chat._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await m.access.resolveAccess(chat._id, { guestToken: token })).status).toBe("gone");
    expect(await c.messages.countDocuments({ chatId: chat._id })).toBe(0);
    expect(await c.participants.countDocuments({ chatId: chat._id })).toBe(0);
  });

  it("messages extend the chat's life", async () => {
    const { chat, guest } = await setup();
    const c = m.db.collections();
    await c.chats.updateOne({ _id: chat._id }, { $set: { expiresAt: new Date(Date.now() + 60_000) } });
    await m.service.sendMessage(chat, guest, "still here");
    const fresh = await c.chats.findOne({ _id: chat._id });
    expect(fresh!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 4 * 86_400_000);
  });

  it("the cron sweep removes expired chats and orphans", async () => {
    const { chat, guest } = await setup();
    await m.service.sendMessage(chat, guest, "x");
    const c = m.db.collections();
    await c.chats.updateOne({ _id: chat._id }, { $set: { expiresAt: new Date(0) } });
    await c.messages.insertOne({ ...(await c.messages.findOne({}))!, _id: new (await import("mongodb")).ObjectId(), chatId: "orphanorphanorphan0000", seq: 99 });
    const res = await m.del.purgeExpired();
    expect(res.chats).toBe(1);
    expect(await c.messages.countDocuments({})).toBe(0);
    expect(await c.participants.countDocuments({})).toBe(0);
  });

  it("owners are capped on live chats", async () => {
    for (let i = 0; i < 10; i++) await m.service.createChat({ ownerId: "busy", ownerName: "Busy" });
    await expect(m.service.createChat({ ownerId: "busy", ownerName: "Busy" })).rejects.toMatchObject({ code: "limit_reached" });
  });
});

describe("sync", () => {
  it("returns messages after the cursor in order and advances it", async () => {
    const { chat, guest } = await setup();
    const owner = (await m.db.collections().participants.findOne({ chatId: chat._id, role: "owner" }))!;
    const first = await m.service.syncChat(chat, owner, 0);
    expect(first.messages).toHaveLength(0);
    for (const t of ["a", "b", "c"]) await m.service.sendMessage(chat, guest, t);
    const next = await m.service.syncChat(chat, owner, first.cursor);
    expect(next.messages.map((x) => x.body)).toEqual(["a", "b", "c"]);
    expect(next.cursor).toBe(3);
    const again = await m.service.syncChat(chat, owner, next.cursor);
    expect(again.messages).toHaveLength(0);
    expect(next.participants.find((p) => p.id === guest._id)?.presence).toBe("online");
  });

  it("does not skip past an in-flight sequence number", async () => {
    const { chat, guest } = await setup();
    const c = m.db.collections();
    await m.service.sendMessage(chat, guest, "one");
    // Simulate seq 2 allocated but not yet written, seq 3 already written.
    await c.chats.updateOne({ _id: chat._id }, { $inc: { messageSeq: 2 }, $set: { lastActivityAt: new Date() } });
    const m1 = await c.messages.findOne({ chatId: chat._id });
    await c.messages.insertOne({
      ...m1!,
      _id: new (await import("mongodb")).ObjectId(),
      seq: 3,
      bodyEnc: m.crypto.chatCipher(chat).encryptBody(3, "three"),
    });
    const res = await m.service.syncChat(chat, guest, 1);
    expect(res.messages.map((x) => x.seq)).toEqual([3]);
    expect(res.cursor).toBe(1);
  });

  it("dedupes retried sends by clientId", async () => {
    const { chat, guest } = await setup();
    const a = await m.service.sendMessage(chat, guest, "hi", "client-abc-123");
    const b = await m.service.sendMessage(chat, guest, "hi", "client-abc-123");
    expect(a.id).toBe(b.id);
  });
});

describe("encryption at rest", () => {
  it("stores no plaintext message bodies or titles", async () => {
    const { chat, guest } = await setup();
    await m.service.sendMessage(chat, guest, "the door code is 4471");
    const c = m.db.collections();
    const raw = JSON.stringify([await c.chats.find({}).toArray(), await c.messages.find({}).toArray()]);
    expect(raw).not.toContain("4471");
    expect(raw).not.toContain("Plans");
    const owner = (await c.participants.findOne({ chatId: chat._id, role: "owner" }))!;
    const view = await m.service.syncChat(chat, owner, 0);
    expect(view.chat.title).toBe("Plans");
    expect(view.messages[0].body).toBe("the door code is 4471");
  });

  it("uses a fresh IV every time", async () => {
    const { chat } = await setup();
    const cipher = m.crypto.chatCipher(chat);
    expect(cipher.encryptBody(1, "same")).not.toBe(cipher.encryptBody(1, "same"));
  });

  it("rejects ciphertexts that are tampered with, moved to another slot, or moved to another chat", async () => {
    const { chat } = await setup();
    const other = await m.service.createChat({ ownerId: "owner-2", ownerName: "Carol" });
    const cipher = m.crypto.chatCipher(chat);
    const sealed = cipher.encryptBody(1, "hello");
    expect(cipher.decryptBody(1, sealed)).toBe("hello");
    expect(() => cipher.decryptBody(2, sealed)).toThrow();
    expect(() => m.crypto.chatCipher(other).decryptBody(1, sealed)).toThrow();
    const parts = sealed.split(".");
    parts[2] = Buffer.from("jello").toString("base64url");
    expect(() => cipher.decryptBody(1, parts.join("."))).toThrow();
  });

  it("gives every chat its own data key", async () => {
    const a = await m.service.createChat({ ownerId: "o", ownerName: "A" });
    const b = await m.service.createChat({ ownerId: "o", ownerName: "A" });
    expect(a.wrappedKey).not.toBe(b.wrappedKey);
    // A wrapped key can't be transplanted onto another chat either.
    expect(() => m.crypto.chatCipher({ _id: b._id, wrappedKey: a.wrappedKey })).toThrow();
  });
});

describe("rate limiter", () => {
  it("allows up to max per window then blocks with retryAfter", async () => {
    const rule = { window: 60, max: 3 };
    const now = Date.now();
    const verdicts = [];
    for (let i = 0; i < 4; i++) verdicts.push(await m.rl.consume("test:key", rule, now));
    expect(verdicts.map((v) => v.allowed)).toEqual([true, true, true, false]);
    expect(verdicts[3].retryAfter).toBeGreaterThan(0);
    const stored = await m.db.collections().rateLimits.findOne({});
    expect(stored?._id).not.toContain("test:key");
  });
});

describe("leaving", () => {
  it("deletes the guest's messages, record and subscriptions, and frees their name", async () => {
    const { chat, guest } = await setup();
    const owner = (await m.db.collections().participants.findOne({ chatId: chat._id, role: "owner" }))!;
    await m.service.sendMessage(chat, owner, "owner says hi");
    await m.service.sendMessage(chat, guest, "bob secret 1");
    await m.service.sendMessage(chat, guest, "bob secret 2");
    const c = m.db.collections();
    await c.pushSubscriptions.insertOne({ _id: "sub-1", chatId: chat._id, participantId: guest._id, subscriptionEnc: "x", createdAt: new Date() });

    const res = await m.service.leaveChat(chat, guest);
    expect(res.deletedMessages).toBe(2);
    expect(await c.messages.countDocuments({ chatId: chat._id, participantId: guest._id })).toBe(0);
    expect(await c.messages.countDocuments({ chatId: chat._id })).toBe(1);
    expect(await c.participants.countDocuments({ _id: guest._id })).toBe(0);
    expect(await c.pushSubscriptions.countDocuments({ participantId: guest._id })).toBe(0);
    // The name can be used again by someone new.
    const fresh = (await m.access.getLiveChat(chat._id))!;
    await expect(m.service.joinChat(fresh, "Bob")).resolves.toBeTruthy();
  });

  it("the leaver's cookie no longer grants access", async () => {
    const { chat, guest, token } = await setup();
    await m.service.leaveChat(chat, guest);
    expect((await m.access.resolveAccess(chat._id, { guestToken: token })).status).toBe("visitor");
  });

  it("owners can't leave (they close instead)", async () => {
    const { chat } = await setup();
    const owner = (await m.db.collections().participants.findOne({ chatId: chat._id, role: "owner" }))!;
    await expect(m.service.leaveChat(chat, owner)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("other clients get a fresh snapshot without the deleted messages", async () => {
    const { chat, guest } = await setup();
    const owner = (await m.db.collections().participants.findOne({ chatId: chat._id, role: "owner" }))!;
    await m.service.sendMessage(chat, guest, "will vanish");
    await m.service.sendMessage(chat, owner, "stays");
    const before = await m.service.syncChat(chat, owner, 0);
    expect(before.messages.map((x) => x.body)).toEqual(["will vanish", "stays"]);

    await m.service.leaveChat(chat, guest);
    const live = (await m.access.getLiveChat(chat._id))!;
    const after = await m.service.syncChat(live, owner, before.cursor, false, before.chat.rev);
    expect(after.reset).toBe(true);
    expect(after.messages.map((x) => x.body)).toEqual(["stays"]);
    expect(after.participants.some((p) => p.id === guest._id)).toBe(false);

    // Once caught up, it's back to normal deltas.
    const next = await m.service.syncChat(live, owner, after.cursor, false, after.chat.rev);
    expect(next.reset).toBe(false);
    expect(next.messages).toHaveLength(0);
  });
});

describe("joining with an account", () => {
  const user = { id: "user-carol", name: "Carol" };

  it("joins with the account name and blob, recognised by account rather than cookie", async () => {
    const { chat } = await setup();
    const p = await m.service.joinChatAsUser(chat, user);
    expect(p).toMatchObject({ role: "guest", userId: user.id, displayName: "Carol" });
    expect(p.tokenHash).toBeUndefined();
    const { accountAvatarSeed } = await import("@/lib/account");
    expect(p.avatarSeed).toBe(accountAvatarSeed(user.id));
    expect(p.avatarSeed).not.toContain("carol");

    const access = await m.access.resolveAccess(chat._id, { userId: user.id });
    expect(access.status === "member" && access.participant._id === p._id && !access.isOwner).toBe(true);
  });

  it("is idempotent, even for concurrent joins", async () => {
    const { chat } = await setup();
    const [a, b] = await Promise.all([m.service.joinChatAsUser(chat, user), m.service.joinChatAsUser(chat, user)]);
    expect(a._id).toBe(b._id);
    expect(await m.db.collections().participants.countDocuments({ chatId: chat._id, userId: user.id })).toBe(1);
  });

  it("adds a suffix when the name is already taken in the chat", async () => {
    const { chat } = await setup(); // has a guest named "Bob"
    const p = await m.service.joinChatAsUser(chat, { id: "user-bob-2", name: "Bob" });
    expect(p.displayName).toBe("Bob 2");
  });

  it("can't rejoin after being removed, and respects locks", async () => {
    const { chat } = await setup();
    const p = await m.service.joinChatAsUser(chat, user);
    await m.service.removeParticipant(chat._id, "owner-1", p._id);
    expect((await m.access.resolveAccess(chat._id, { userId: user.id })).status).toBe("removed");
    await expect(m.service.joinChatAsUser(chat, user)).rejects.toMatchObject({ code: "forbidden" });

    await m.service.updateChat(chat._id, "owner-1", { locked: true });
    const locked = (await m.access.getLiveChat(chat._id))!;
    await expect(m.service.joinChatAsUser(locked, { id: "user-dan", name: "Dan" })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("shows account blobs to others, and per-chat blobs for anonymous guests", async () => {
    const { chat, guest } = await setup();
    const p = await m.service.joinChatAsUser(chat, user);
    const view = await m.service.syncChat(chat, guest, 0);
    const { avatarSeed } = await import("@/lib/avatar");
    expect(view.participants.find((x) => x.id === p._id)?.avatar).toBe(p.avatarSeed);
    expect(view.participants.find((x) => x.id === guest._id)?.avatar).toBe(avatarSeed(chat._id, "Bob"));
  });
});
