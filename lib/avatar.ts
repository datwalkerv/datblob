/**
 * Faces are seeded per chat, so the same display name in two different chats
 * produces two unrelated blobs — nobody can be recognised across chats by
 * their avatar. Names are unique within a chat, so the seed is too.
 */
export function avatarSeed(chatId: string, name: string): string {
  return `${chatId}:${name.trim().toLowerCase()}`;
}
