import "server-only";
import { env } from "@/lib/env";

/**
 * Thin client for the datupload storage API (https://datupload.vercel.app).
 *
 * Server-only: the API key lives in STORAGE_API_KEY and is only ever sent from
 * here, server to server. Browsers never talk to the storage API directly —
 * uploads and downloads are proxied through datblob's own routes.
 *
 * datblob only ever stores *encrypted* bytes here, as an anonymous
 * `application/octet-stream` blob: the storage service (and Telegram behind it)
 * sees no filename, no image type, and no content.
 */

const TIMEOUT_MS = 20_000;

/** datupload's direct-upload ceiling (DIRECT_UPLOAD_MAX_MB, 4 MB by default). */
export const STORAGE_MAX_BYTES = 4 * 1024 * 1024;

export class StorageError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function config() {
  const { STORAGE_API_KEY, STORAGE_API_URL } = env();
  if (!STORAGE_API_KEY) throw new StorageError(503, "STORAGE_NOT_CONFIGURED", "Image storage is not configured");
  return { key: STORAGE_API_KEY, base: STORAGE_API_URL.replace(/\/$/, "") };
}

async function failure(res: Response): Promise<StorageError> {
  const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  return new StorageError(res.status, body?.error?.code ?? "STORAGE_ERROR", body?.error?.message ?? `Storage responded ${res.status}`);
}

export async function uploadBlob(bytes: Buffer): Promise<string> {
  const { key, base } = config();
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" }), "blob.bin");
  form.append("contentType", "application/octet-stream");
  form.append("folder", "datblob");

  const res = await fetch(`${base}/api/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw await failure(res);
  const data = (await res.json()) as { id?: unknown };
  if (typeof data.id !== "string" || !data.id) throw new StorageError(502, "STORAGE_BAD_RESPONSE", "Storage returned no file id");
  return data.id;
}

export async function downloadBlob(fileId: string): Promise<Buffer> {
  const { key, base } = config();
  const res = await fetch(`${base}/api/files/${encodeURIComponent(fileId)}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw await failure(res);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Best effort. Even when this fails (or Telegram refuses to delete messages
 * older than 48 h), the bytes are ciphertext whose key died with the chat.
 */
export async function deleteBlobs(fileIds: string[]): Promise<void> {
  if (!fileIds.length) return;
  let cfg: ReturnType<typeof config>;
  try {
    cfg = config();
  } catch {
    return;
  }
  const results = await Promise.allSettled(
    fileIds.map((id) =>
      fetch(`${cfg.base}/api/files/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${cfg.key}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }).then((r) => {
        if (!r.ok && r.status !== 404) throw new Error(`delete ${r.status}`);
      }),
    ),
  );
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed) console.warn(`[datblob] ${failed}/${fileIds.length} storage deletes failed (ciphertext is already unreadable)`);
}
