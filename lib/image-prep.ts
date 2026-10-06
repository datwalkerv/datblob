import { ACCEPTED_INPUT_TYPES, MAX_IMAGE_BYTES, MAX_IMAGE_EDGE } from "@/lib/images";

/**
 * Browser-side preparation before an image is uploaded.
 *
 * The server always strips metadata (via datclean), so this step isn't the
 * privacy guarantee. It exists to:
 *   - bake EXIF orientation into the pixels (datclean drops the orientation
 *     tag without rotating, which would leave phone photos sideways),
 *   - downscale big photos so they fit the 4 MB upload limit,
 *   - produce an instant local preview.
 */

export type PreparedImage = {
  blob: Blob;
  /** Local object URL for the optimistic preview; null when the browser can't decode the format (e.g. HEIC on Chrome). */
  previewUrl: string | null;
  width: number | null;
  height: number | null;
};

export class ImagePrepError extends Error {}

const HEIF_EXT = /\.(heic|heif)$/i;

export function isAcceptedImage(file: File): boolean {
  return (ACCEPTED_INPUT_TYPES as readonly string[]).includes(file.type) || HEIF_EXT.test(file.name);
}

export const ACCEPT_ATTR = [...ACCEPTED_INPUT_TYPES, ".heic", ".heif"].join(",");

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!isAcceptedImage(file)) throw new ImagePrepError("Only PNG, JPEG, WebP, GIF and HEIC images can be shared.");

  // GIFs are passed through untouched so animation survives; the server still strips them.
  if (file.type === "image/gif") {
    if (file.size > MAX_IMAGE_BYTES) throw new ImagePrepError("GIFs are limited to 4 MB.");
    const dims = await measure(file);
    return { blob: file, previewUrl: URL.createObjectURL(file), ...dims };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Not decodable here (typically HEIC outside Safari). The server converts it.
    if (file.size > MAX_IMAGE_BYTES) {
      throw new ImagePrepError("This photo is over 4 MB and your browser can't shrink it. Try a JPEG instead.");
    }
    return { blob: file, previewUrl: null, width: null, height: null };
  }

  try {
    const fitsAsIs =
      (file.type === "image/png" || file.type === "image/webp") &&
      file.size <= MAX_IMAGE_BYTES &&
      Math.max(bitmap.width, bitmap.height) <= MAX_IMAGE_EDGE;
    if (fitsAsIs) {
      return { blob: file, previewUrl: URL.createObjectURL(file), width: bitmap.width, height: bitmap.height };
    }

    // JPEG/HEIC/oversized: re-encode with orientation applied, shrinking until it fits.
    let edge = Math.min(MAX_IMAGE_EDGE, Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 5; attempt++) {
      const out = await encode(bitmap, edge, attempt === 0 ? 0.9 : 0.82);
      if (out.blob.size <= MAX_IMAGE_BYTES) {
        return { blob: out.blob, previewUrl: URL.createObjectURL(out.blob), width: out.width, height: out.height };
      }
      edge = Math.round(edge * 0.8);
    }
    throw new ImagePrepError("This image is too large to send.");
  } finally {
    bitmap.close();
  }
}

async function encode(bitmap: ImageBitmap, maxEdge: number, quality: number) {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImagePrepError("Your browser couldn't process this image.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);

  // WebP keeps transparency and is small; fall back to JPEG where WebP encoding isn't supported.
  let blob = await toBlob(canvas, "image/webp", quality);
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);
  if (!blob) throw new ImagePrepError("Your browser couldn't process this image.");
  return { blob, width, height };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function measure(file: Blob): Promise<{ width: number | null; height: number | null }> {
  try {
    const b = await createImageBitmap(file);
    const dims = { width: b.width, height: b.height };
    b.close();
    return dims;
  } catch {
    return { width: null, height: null };
  }
}
