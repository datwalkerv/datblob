import "server-only";
import { env } from "@/lib/env";

/**
 * Metadata stripping via datclean (https://datclean.vercel.app/api/exif):
 * removes EXIF, XMP and IPTC — GPS position, camera serials, timestamps —
 * keeping format and resolution (HEIC comes back as JPEG).
 *
 * Fails closed: if datclean can't process an image, the upload is rejected
 * rather than stored with its metadata intact.
 *
 * Note: datclean drops the EXIF orientation tag without rotating pixels, so
 * the browser bakes orientation in before upload (see lib/image-prep.ts).
 */

const TIMEOUT_MS = 25_000;

export class MetadataStripError extends Error {}

export async function stripMetadata(bytes: Buffer, mime: string): Promise<Buffer> {
  const base = env().DATCLEAN_API_URL.replace(/\/$/, "");
  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(bytes)], { type: mime }), "image");

  let res: Response;
  try {
    res = await fetch(`${base}/api/exif`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    throw new MetadataStripError(`datclean unreachable: ${(err as Error).message}`);
  }
  if (!res.ok) throw new MetadataStripError(`datclean responded ${res.status}`);
  const out = Buffer.from(await res.arrayBuffer());
  if (!out.length) throw new MetadataStripError("datclean returned an empty image");
  return out;
}
