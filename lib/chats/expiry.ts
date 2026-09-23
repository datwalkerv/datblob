export const CHAT_TTL_MS = 5 * 24 * 60 * 60 * 1000;
/** Owner presence keeps a chat alive, but we only write it at most this often. */
export const OWNER_KEEPALIVE_MS = 60 * 1000;
export const PRESENCE_WRITE_MS = 15 * 1000;
export const ONLINE_MS = 30 * 1000;
export const AWAY_MS = 5 * 60 * 1000;

export const MAX_LIVE_CHATS_PER_OWNER = 10;
export const MAX_PARTICIPANTS = 50;

export function expiryFrom(lastActivity: Date): Date {
  return new Date(lastActivity.getTime() + CHAT_TTL_MS);
}

export function isExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export type Presence = "online" | "away" | "offline";

export function presenceOf(lastSeenAt: Date, now = new Date()): Presence {
  const age = now.getTime() - lastSeenAt.getTime();
  if (age <= ONLINE_MS) return "online";
  if (age <= AWAY_MS) return "away";
  return "offline";
}
