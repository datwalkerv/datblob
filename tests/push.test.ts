import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type Sent = { endpoint: string; payload: string };
const sent: Sent[] = [];
const goneEndpoints = new Set<string>();

vi.mock("web-push", () => {
  class WebPushError extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message);
    }
  }
  return {
    WebPushError,
    default: {
      setVapidDetails: vi.fn(),
      sendNotification: vi.fn(async (sub: { endpoint: string }, payload: string) => {
        if (goneEndpoints.has(sub.endpoint)) throw new WebPushError("gone", 410);
        sent.push({ endpoint: sub.endpoint, payload });
      }),
    },
  };
});

let replSet: MongoMemoryReplSet;
let db: typeof import("@/lib/db");
let service: typeof import("@/lib/chats/service");
let push: typeof import("@/lib/push");

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replSet.getUri();
  process.env.MONGODB_DB = "datblob_push_test";
  process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-123";
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
  process.env.VAPID_PUBLIC_KEY = "BPublicKeyPlaceholderForTestsOnly";
  process.env.VAPID_PRIVATE_KEY = "privateKeyPlaceholder";
  db = await import("@/lib/db");
  service = await import("@/lib/chats/service");
  push = await import("@/lib/push");
  await db.ensureIndexes();
});
afterAll(async () => {
  await db?.mongoClient().close();
  await replSet?.stop();
});
beforeEach(async () => {
  sent.length = 0;
  goneEndpoints.clear();
  await db.collections().pushSubscriptions.deleteMany({});
});

const sub = (n: number, host = "fcm.googleapis.com") => ({
  endpoint: `https://${host}/fcm/send/device-${n}-${Math.random().toString(36).slice(2)}`,
  keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) },
});

async function room() {
  const chat = await service.createChat({ ownerId: "push-owner", ownerName: "Alice", title: "Weekend" });
  const owner = (await db.collections().participants.findOne({ chatId: chat._id, role: "owner" }))!;
  const { participant: bob } = await service.joinChat(chat, "Bob");
  const { participant: cleo } = await service.joinChat(chat, "Cleo");
  return { chat, owner, bob, cleo };
}

describe("subscription validation", () => {
  it("accepts real push services only (no SSRF to arbitrary URLs)", () => {
    for (const host of ["fcm.googleapis.com", "web.push.apple.com", "updates.push.services.mozilla.com", "wns2-db5p.notify.windows.com"])
      expect(push.subscriptionSchema.safeParse(sub(1, host)).success).toBe(true);
    for (const endpoint of [
      "https://evil.example.com/hook",
      "http://fcm.googleapis.com/fcm/send/x",
      "https://169.254.169.254/latest/meta-data",
      "https://fcm.googleapis.com.evil.com/x",
      "https://localhost:3000/api",
    ])
      expect(push.subscriptionSchema.safeParse({ ...sub(1), endpoint }).success).toBe(false);
  });
});

describe("notifications", () => {
  it("stores subscriptions encrypted", async () => {
    const { chat, bob } = await room();
    const s = sub(1);
    await push.saveSubscription(chat, bob, s);
    const raw = JSON.stringify(await db.collections().pushSubscriptions.find({}).toArray());
    expect(raw).not.toContain("fcm.googleapis.com");
    expect(raw).not.toContain(s.keys.auth);
  });

  it("notifies everyone except the sender, and never includes the message text", async () => {
    const { chat, owner, bob, cleo } = await room();
    const [sOwner, sBob, sCleo] = [sub(1), sub(2), sub(3)];
    await push.saveSubscription(chat, owner, sOwner);
    await push.saveSubscription(chat, bob, sBob);
    await push.saveSubscription(chat, cleo, sCleo);

    await service.sendMessage(chat, bob, "the secret door code is 4471");
    await push.notifyChat(chat._id, bob._id, "message");

    expect(sent.map((s) => s.endpoint).sort()).toEqual([sOwner.endpoint, sCleo.endpoint].sort());
    const payload = JSON.parse(sent[0].payload);
    expect(payload).toMatchObject({ title: "Weekend", body: "Bob sent a message", url: `/c/${chat._id}` });
    expect(sent[0].payload).not.toContain("4471");
  });

  it("skips people currently looking at the chat", async () => {
    const { chat, bob, cleo } = await room();
    await push.saveSubscription(chat, cleo, sub(3));
    await db.collections().participants.updateOne({ _id: cleo._id }, { $set: { lastFocusedAt: new Date() } });
    await push.notifyChat(chat._id, bob._id, "message");
    expect(sent).toHaveLength(0);
  });

  it("coalesces bursts per device", async () => {
    const { chat, bob, cleo } = await room();
    await push.saveSubscription(chat, cleo, sub(3));
    await push.notifyChat(chat._id, bob._id, "message");
    await push.notifyChat(chat._id, bob._id, "image");
    expect(sent).toHaveLength(1);
  });

  it("drops subscriptions the push service reports as gone", async () => {
    const { chat, bob, cleo } = await room();
    const s = sub(3);
    goneEndpoints.add(s.endpoint);
    await push.saveSubscription(chat, cleo, s);
    await push.notifyChat(chat._id, bob._id, "message");
    expect(await db.collections().pushSubscriptions.countDocuments({ chatId: chat._id })).toBe(0);
  });

  it("removing a participant or closing the chat deletes subscriptions", async () => {
    const { chat, owner, bob, cleo } = await room();
    await push.saveSubscription(chat, bob, sub(2));
    await push.saveSubscription(chat, cleo, sub(3));
    await service.removeParticipant(chat._id, "push-owner", cleo._id);
    const left = await db.collections().pushSubscriptions.find({ chatId: chat._id }).toArray();
    expect(left.map((l) => l.participantId)).toEqual([bob._id]);

    await push.notifyChat(chat._id, owner._id, "message");
    expect(sent).toHaveLength(1);

    await service.closeChat(chat._id, "push-owner");
    expect(await db.collections().pushSubscriptions.countDocuments({ chatId: chat._id })).toBe(0);
  });

  it("does nothing for a closed chat", async () => {
    const { chat, bob, cleo } = await room();
    await push.saveSubscription(chat, cleo, sub(3));
    await db.collections().chats.deleteOne({ _id: chat._id });
    await push.notifyChat(chat._id, bob._id, "message");
    expect(sent).toHaveLength(0);
  });
});
