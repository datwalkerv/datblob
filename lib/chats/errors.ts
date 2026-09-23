import "server-only";
import { ChatError } from "@/lib/chats/service";
import { fail } from "@/lib/http";

export function handleError(err: unknown) {
  if (err instanceof ChatError) return fail(err.code, err.message);
  console.error("[datblob] unexpected error", err instanceof Error ? err.message : err);
  return fail("internal", "Something went wrong. Please try again.");
}
