import "server-only";
import { collections } from "@/lib/db";
import { deleteBlobs } from "@/lib/storage";

/**
 * Permanently removes a chat and everything attached to it.
 *
 * The chat document goes first: every access path requires a live chat, so
 * the moment it is gone nothing else is reachable, even if a later step fails.
 * Any leftovers are orphans that the cron sweep removes.
 */
export async function purgeChat(chatId: string): Promise<void> {
  const { chats, messages, participants } = collections();
  // Deleting the chat also destroys its wrapped data key: from here on, every
  // message and image ciphertext belonging to it is unreadable.
  await chats.deleteOne({ _id: chatId });
  const fileIds = await imageFileIds({ chatId });
  await Promise.all([messages.deleteMany({ chatId }), participants.deleteMany({ chatId })]);
  await deleteBlobs(fileIds);
}

async function imageFileIds(filter: { chatId: string | { $in: string[] } }): Promise<string[]> {
  const docs = await collections()
    .messages.find({ ...filter, image: { $exists: true } }, { projection: { "image.fileId": 1 } })
    .toArray();
  return docs.flatMap((d) => (d.image ? [d.image.fileId] : []));
}

/**
 * Sweeps expired chats that the TTL monitor hasn't reached yet, then removes
 * messages and participants whose chat no longer exists.
 */
export async function purgeExpired(now = new Date()): Promise<{ chats: number; orphans: number }> {
  const { chats, messages, participants } = collections();

  const expired = await chats.find({ expiresAt: { $lte: now } }, { projection: { _id: 1 } }).toArray();
  for (const { _id } of expired) await purgeChat(_id);

  const referenced = new Set<string>([
    ...(await messages.distinct("chatId")),
    ...(await participants.distinct("chatId")),
  ]);
  let orphans = 0;
  if (referenced.size) {
    const ids = [...referenced];
    const live = new Set(
      (await chats.find({ _id: { $in: ids } }, { projection: { _id: 1 } }).toArray()).map((c) => c._id),
    );
    const dead = ids.filter((id) => !live.has(id));
    if (dead.length) {
      const fileIds = await imageFileIds({ chatId: { $in: dead } });
      const [m, p] = await Promise.all([
        messages.deleteMany({ chatId: { $in: dead } }),
        participants.deleteMany({ chatId: { $in: dead } }),
      ]);
      orphans = m.deletedCount + p.deletedCount;
      await deleteBlobs(fileIds);
    }
  }
  return { chats: expired.length, orphans };
}
