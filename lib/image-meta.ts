import type { ImageMime } from "@/lib/images";

/**
 * Read pixel dimensions straight from the image header, so the server never
 * has to trust dimensions reported by the client.
 */
export function imageDimensions(b: Uint8Array, mime: ImageMime): { width: number; height: number } | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  try {
    switch (mime) {
      case "image/png":
        // IHDR is always the first chunk: width/height at bytes 16..24.
        return ok(view.getUint32(16), view.getUint32(20));
      case "image/gif":
        return ok(view.getUint16(6, true), view.getUint16(8, true));
      case "image/webp":
        return webp(b, view);
      case "image/jpeg":
        return jpeg(b, view);
    }
  } catch {
    return null;
  }
}

function ok(width: number, height: number) {
  return width > 0 && height > 0 ? { width, height } : null;
}

function webp(b: Uint8Array, v: DataView) {
  const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
  // Canvas width/height minus one, as 24-bit little-endian integers.
  const u24 = (o: number) => {
    if (o + 3 > b.length) throw new RangeError("truncated");
    return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
  };
  if (chunk === "VP8X") return ok(1 + u24(24), 1 + u24(27));
  if (chunk === "VP8 ") return ok(v.getUint16(26, true) & 0x3fff, v.getUint16(28, true) & 0x3fff);
  if (chunk === "VP8L") {
    const bits = v.getUint32(21, true);
    return ok(1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff));
  }
  return null;
}

function jpeg(b: Uint8Array, v: DataView) {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    const length = v.getUint16(i + 2);
    // SOF0..SOF15, excluding DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return ok(v.getUint16(i + 7), v.getUint16(i + 5));
    }
    i += 2 + length;
  }
  return null;
}
