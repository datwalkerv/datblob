import "server-only";
import { ChatError } from "@/lib/chats/service";
import { fail } from "@/lib/http";
import { MetadataStripError } from "@/lib/datclean";
import { StorageError } from "@/lib/storage";

export function handleError(err: unknown) {
  if (err instanceof ChatError) return fail(err.code, err.message);
  if (err instanceof MetadataStripError) {
    console.error("[datblob] metadata strip failed", err.message);
    return fail("unavailable", "We couldn't remove the image's metadata, so it wasn't sent. Please try again.");
  }
  if (err instanceof StorageError) {
    console.error("[datblob] storage error", err.status, err.code);
    if (err.status === 413) return fail("too_large", "That image is too large.");
    return fail("unavailable", "Image storage is unavailable right now. Please try again.");
  }
  console.error("[datblob] unexpected error", err instanceof Error ? err.message : err);
  return fail("internal", "Something went wrong. Please try again.");
}
