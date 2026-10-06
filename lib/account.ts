import "server-only";
import { env } from "@/lib/env";
import { hmac } from "@/lib/ids";

/**
 * The seed for a signed-in user's blob. Derived from their account id with a
 * server-side secret, so it's stable across every chat and device, but reveals
 * nothing: unlike seeding with the email, other people never learn the
 * address, and the seed can't be reversed or guessed from it.
 */
export function accountAvatarSeed(userId: string): string {
  return `u:${hmac(env().BETTER_AUTH_SECRET, `avatar:${userId}`).slice(0, 22)}`;
}
