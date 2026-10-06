import { accessFromRequest } from "@/lib/chats/caller";
import { handleError } from "@/lib/chats/errors";
import { sendImage } from "@/lib/chats/images";
import { imagesEnabled } from "@/lib/env";
import { fail, invalid, limited, ok, sameOrigin } from "@/lib/http";
import { MAX_IMAGE_BYTES } from "@/lib/images";
import { RULES, consume } from "@/lib/rate-limit";
import { imageUploadInput } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// Leaves room for multipart framing and the caption on top of the image itself.
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

/** Upload an image into a chat. The storage API key is used only from here, server-side. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!sameOrigin(req)) return fail("forbidden", "Cross-origin request blocked.");
  if (!imagesEnabled()) return fail("unavailable", "Image sharing isn't enabled on this server.");

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_REQUEST_BYTES) return fail("too_large", "Images are limited to 4 MB.");

  try {
    const access = await accessFromRequest(req, id);
    if (access.status === "gone") return fail("gone", "This chat has ended.");
    if (access.status === "removed") return fail("forbidden", "You were removed from this chat.");
    if (access.status === "visitor") return fail("unauthorized", "Join the chat first.");

    const verdict = await consume(`img:${access.participant._id}`, RULES.image);
    if (!verdict.allowed) return limited(verdict);

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File)) return fail("bad_request", "Attach an image.");
    if (file.size > MAX_IMAGE_BYTES) return fail("too_large", "Images are limited to 4 MB.");

    const parsed = imageUploadInput.safeParse({
      caption: form.get("caption") ?? undefined,
      clientId: form.get("clientId") ?? undefined,
    });
    if (!parsed.success) return invalid(parsed.error);

    const message = await sendImage(access.chat, access.participant, {
      bytes: Buffer.from(await file.arrayBuffer()),
      ...parsed.data,
    });
    return ok({ message }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
