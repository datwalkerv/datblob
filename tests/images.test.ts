import { MongoMemoryReplSet } from "mongodb-memory-server";
import { deflateSync } from "node:zlib";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { imageDimensions } from "@/lib/image-meta";
import { isHeif, sniffImage } from "@/lib/images";

/* ---------- fakes for the two external services ---------- */

const store = new Map<string, Buffer>();
const deleted: string[] = [];
let stripImpl: (b: Buffer) => Promise<Buffer> = async (b) => b;

vi.mock("@/lib/storage", async (orig) => {
  const actual = await orig<typeof import("@/lib/storage")>();
  return {
    ...actual,
    uploadBlob: vi.fn(async (bytes: Buffer) => {
      const id = `f${store.size + 1}`.padEnd(24, "0");
      store.set(id, Buffer.from(bytes));
      return id;
    }),
    downloadBlob: vi.fn(async (id: string) => store.get(id)!),
    deleteBlobs: vi.fn(async (ids: string[]) => {
      deleted.push(...ids);
    }),
  };
});
vi.mock("@/lib/datclean", async (orig) => {
  const actual = await orig<typeof import("@/lib/datclean")>();
  return { ...actual, stripMetadata: vi.fn((b: Buffer) => stripImpl(b)) };
});

/* ---------- tiny real image fixtures ---------- */

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function png(w: number, h: number, extra = Buffer.alloc(0)): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const t = Buffer.from(type);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0x7f)])));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    ...(extra.length ? [chunk("tEXt", extra)] : []),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("image format helpers", () => {
  it("sniffs formats by magic bytes, not by claims", () => {
    expect(sniffImage(png(2, 2))).toBe("image/png");
    expect(sniffImage(Buffer.from("GIF89a......"))).toBe("image/gif");
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImage(Buffer.from("RIFF\0\0\0\0WEBPVP8X"))).toBe("image/webp");
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffImage(Buffer.from("%PDF-1.7"))).toBeNull();
    expect(isHeif(Buffer.from("\0\0\0\x18ftypheic\0\0\0\0"))).toBe(true);
  });

  it("reads dimensions from headers", () => {
    expect(imageDimensions(png(37, 21), "image/png")).toEqual({ width: 37, height: 21 });

    const gif = Buffer.from("GIF89a\0\0\0\0");
    gif.writeUInt16LE(320, 6);
    gif.writeUInt16LE(200, 8);
    expect(imageDimensions(gif, "image/gif")).toEqual({ width: 320, height: 200 });

    // SOI, APP0 (len 4), SOF0: len, precision, height=480, width=640
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80, 0x03, 0, 0, 0, 0]);
    expect(imageDimensions(jpeg, "image/jpeg")).toEqual({ width: 640, height: 480 });

    const webp = Buffer.alloc(30);
    webp.write("RIFF", 0);
    webp.write("WEBP", 8);
    webp.write("VP8X", 12);
    webp.writeUIntLE(1919, 24, 3);
    webp.writeUIntLE(1079, 27, 3);
    expect(imageDimensions(webp, "image/webp")).toEqual({ width: 1920, height: 1080 });
  });
});

/* ---------- pipeline against a real (in-memory) MongoDB ---------- */

let replSet: MongoMemoryReplSet;
let db: typeof import("@/lib/db");
let service: typeof import("@/lib/chats/service");
let images: typeof import("@/lib/chats/images");

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replSet.getUri();
  process.env.MONGODB_DB = "datblob_images_test";
  process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-123";
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  process.env.STORAGE_API_KEY = "test-storage-key-1234";
  db = await import("@/lib/db");
  service = await import("@/lib/chats/service");
  images = await import("@/lib/chats/images");
  await db.ensureIndexes();
});
afterAll(async () => {
  await db?.mongoClient().close();
  await replSet?.stop();
});
beforeEach(() => {
  store.clear();
  deleted.length = 0;
  stripImpl = async (b) => b;
});

async function room() {
  const chat = await service.createChat({ ownerId: "owner-img", ownerName: "Alice" });
  const { participant } = await service.joinChat(chat, `Guest ${Math.random().toString(36).slice(2, 7)}`);
  return { chat, guest: participant };
}

describe("image messages", () => {
  it("strips, encrypts, stores ciphertext only, and serves the cleaned image back", async () => {
    const { chat, guest } = await room();
    const original = png(40, 30, Buffer.from("GPS\0Lat=47.4979;Lon=19.0402"));
    const cleaned = png(40, 30);
    stripImpl = async () => cleaned;

    const msg = await images.sendImage(chat, guest, { bytes: original, caption: "door code view" });
    expect(msg.image).toMatchObject({ width: 40, height: 30 });
    expect(msg.image!.url).toMatch(new RegExp(`^/api/chats/${chat._id}/images/[A-Za-z0-9_-]{16}$`));
    expect(msg.body).toBe("door code view");

    // What reached storage is neither the original nor the cleaned image.
    const [stored] = [...store.values()];
    expect(stored.includes(Buffer.from("GPS"))).toBe(false);
    expect(stored.includes(Buffer.from("IHDR"))).toBe(false);
    expect(sniffImage(stored)).toBeNull();

    const imageId = msg.image!.url.split("/").pop()!;
    const read = await images.readImage(chat, imageId);
    expect(read?.mime).toBe("image/png");
    expect(read!.bytes.equals(cleaned)).toBe(true);
  });

  it("rejects non-images and SVG before anything is uploaded", async () => {
    const { chat, guest } = await room();
    for (const bytes of [Buffer.from("<svg onload=alert(1)>"), Buffer.from("just text"), Buffer.alloc(0)]) {
      await expect(images.sendImage(chat, guest, { bytes, caption: "" })).rejects.toMatchObject({ code: "bad_request" });
    }
    expect(store.size).toBe(0);
  });

  it("fails closed when metadata stripping fails", async () => {
    const { chat, guest } = await room();
    const { MetadataStripError } = await import("@/lib/datclean");
    stripImpl = async () => {
      throw new MetadataStripError("down");
    };
    await expect(images.sendImage(chat, guest, { bytes: png(4, 4), caption: "" })).rejects.toBeInstanceOf(MetadataStripError);
    expect(store.size).toBe(0);
    expect(await db.collections().messages.countDocuments({ chatId: chat._id })).toBe(0);
  });

  it("rejects when the stripper returns something that isn't an image", async () => {
    const { chat, guest } = await room();
    stripImpl = async () => Buffer.from("<html>");
    await expect(images.sendImage(chat, guest, { bytes: png(4, 4), caption: "" })).rejects.toMatchObject({ code: "bad_request" });
    expect(store.size).toBe(0);
  });

  it("a retried upload with the same clientId doesn't store a second copy", async () => {
    const { chat, guest } = await room();
    const a = await images.sendImage(chat, guest, { bytes: png(4, 4), caption: "", clientId: "retry-client-1" });
    const b = await images.sendImage(chat, guest, { bytes: png(4, 4), caption: "", clientId: "retry-client-1" });
    expect(a.id).toBe(b.id);
    expect(store.size).toBe(1);
  });

  it("images are unreadable from another chat and unknown ids return nothing", async () => {
    const { chat, guest } = await room();
    const { chat: other } = await room();
    const msg = await images.sendImage(chat, guest, { bytes: png(4, 4), caption: "" });
    const imageId = msg.image!.url.split("/").pop()!;
    expect(await images.readImage(other, imageId)).toBeNull();
    expect(await images.readImage(chat, "AAAAAAAAAAAAAAAA")).toBeNull();
    expect(await images.readImage(chat, "../../etc/passwd")).toBeNull();
  });

  it("leaving deletes only the leaver's images from storage", async () => {
    const { chat, guest } = await room();
    const { participant: other } = await service.joinChat(chat, "Other Person");
    await images.sendImage(chat, guest, { bytes: png(4, 4), caption: "" });
    const theirs = await images.sendImage(chat, other, { bytes: png(6, 6), caption: "" });
    const keptFileId = (await db.collections().messages.findOne({ "image.id": theirs.image!.url.split("/").pop() }))!.image!.fileId;

    await service.leaveChat(chat, guest);
    expect(deleted).toHaveLength(1);
    expect(deleted).not.toContain(keptFileId);
  });

  it("closing the chat deletes its images from storage", async () => {
    const { chat, guest } = await room();
    await images.sendImage(chat, guest, { bytes: png(4, 4), caption: "" });
    await images.sendImage(chat, guest, { bytes: png(5, 5), caption: "" });
    expect(await service.closeChat(chat._id, "owner-img")).toBe(true);
    expect(deleted.sort()).toEqual([...store.keys()].sort());
  });
});
