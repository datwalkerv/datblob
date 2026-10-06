/**
 * Image rules shared by the browser (pre-flight checks, re-encoding) and the
 * server (the actual enforcement).
 *
 * Raster formats only. SVG is deliberately excluded: it is a document that
 * can carry script, not just pixels.
 */

export const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type ImageMime = (typeof IMAGE_MIME_TYPES)[number];

/**
 * Largest plaintext image we accept. The encrypted blob (+28 bytes) must fit
 * datupload's 4 MB direct-upload limit, and the multipart request must fit
 * Vercel's 4.5 MB function body limit.
 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024 - 4 * 1024;

/** Longest edge after client-side downscaling. */
export const MAX_IMAGE_EDGE = 2048;

/**
 * Identify an image by its magic bytes. The declared type and file extension
 * are never trusted.
 */
export function sniffImage(bytes: Uint8Array): ImageMime | null {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a)
    return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61)
    return "image/gif";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return "image/webp";
  return null;
}

/**
 * HEIC/HEIF (iPhone photos) is accepted as *input* only: datclean converts it
 * to JPEG while stripping metadata. It is never stored or served as HEIC.
 */
export const HEIC_MIME = "image/heic";
export const ACCEPTED_INPUT_TYPES = [...IMAGE_MIME_TYPES, "image/heic", "image/heif"] as const;

const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

export function isHeif(b: Uint8Array): boolean {
  if (b.length < 12) return false;
  const box = String.fromCharCode(b[4], b[5], b[6], b[7]);
  const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
  return box === "ftyp" && HEIF_BRANDS.has(brand);
}

export function isImageMime(value: string): value is ImageMime {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(value);
}
