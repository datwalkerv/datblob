import { accessFromRequest } from "@/lib/chats/caller";
import { handleError } from "@/lib/chats/errors";
import { readImage } from "@/lib/chats/images";
import { fail, limited } from "@/lib/http";
import { RULES, consume } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string; imageId: string }> };

/**
 * Serves a chat image to members only: fetched from storage with the
 * server-side key, decrypted with the chat key, and never cached anywhere.
 * Once the chat is closed or expires this returns 404 forever.
 */
export async function GET(req: Request, { params }: Ctx) {
  const { id, imageId } = await params;
  try {
    const access = await accessFromRequest(req, id);
    if (access.status !== "member") return fail("not_found", "Not found.");

    const verdict = await consume(`imgv:${access.participant._id}`, RULES.imageView);
    if (!verdict.allowed) return limited(verdict);

    const image = await readImage(access.chat, imageId);
    if (!image) return fail("not_found", "Not found.");

    return new Response(new Uint8Array(image.bytes), {
      headers: {
        "Content-Type": image.mime,
        "Content-Length": String(image.bytes.length),
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        // Belt and braces: even if opened directly, the response can't run anything.
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
