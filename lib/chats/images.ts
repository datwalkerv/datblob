import "server-only";
import { collections } from "@/lib/db";
import { chatCipher } from "@/lib/crypto";
import { ChatError, sendMessage } from "@/lib/chats/service";
import { toMessageView } from "@/lib/chats/views";
import { randomId } from "@/lib/ids";
import { stripMetadata } from "@/lib/datclean";
import { imageDimensions } from "@/lib/image-meta";
import { HEIC_MIME, MAX_IMAGE_BYTES, isHeif, sniffImage, type ImageMime } from "@/lib/images";
import { deleteBlobs, downloadBlob, uploadBlob } from "@/lib/storage";
import type { ChatDoc, MessageView, ParticipantDoc } from "@/lib/types";

export const IMAGE_ID_RE = /^[A-Za-z0-9_-]{16}$/;

/**
 * The image pipeline:
 *   1. identify the input by its magic bytes (PNG, JPEG, WebP, GIF, HEIC)
 *   2. strip all metadata with datclean — fails closed (HEIC → JPEG here)
 *   3. re-identify the output and read its real dimensions from the header
 *   4. encrypt with the chat's key and park the ciphertext in datupload
 *   5. post it as a message
 * The storage service never sees the plaintext, the image type or a filename.
 */
export async function sendImage(
  chat: ChatDoc,
  participant: ParticipantDoc,
  input: { bytes: Buffer; caption: string; clientId?: string },
): Promise<MessageView> {
  const { messages } = collections();
  const cipher = chatCipher(chat);

  // A retried send must not upload a second blob.
  if (input.clientId) {
    const dupe = await messages.findOne({ chatId: chat._id, participantId: participant._id, clientId: input.clientId });
    if (dupe) return toMessageView(dupe, cipher);
  }

  if (input.bytes.length === 0) throw new ChatError("bad_request", "The image is empty.");
  if (input.bytes.length > MAX_IMAGE_BYTES) throw new ChatError("bad_request", "Images are limited to 4 MB.");
  const inputMime = sniffImage(input.bytes) ?? (isHeif(input.bytes) ? HEIC_MIME : null);
  if (!inputMime) throw new ChatError("bad_request", "Only PNG, JPEG, WebP, GIF and HEIC images are supported.");

  const clean = await stripMetadata(input.bytes, inputMime);
  const mime = sniffImage(clean);
  if (!mime) throw new ChatError("bad_request", "That image couldn't be processed.");
  if (clean.length > MAX_IMAGE_BYTES) throw new ChatError("bad_request", "Images are limited to 4 MB.");
  const dims = imageDimensions(clean, mime);
  if (!dims) throw new ChatError("bad_request", "That image couldn't be read.");

  const imageId = randomId(12);
  const fileId = await uploadBlob(cipher.encryptImage(imageId, clean));

  try {
    return await sendMessage(chat, participant, input.caption, input.clientId, {
      id: imageId,
      fileId,
      mime,
      size: clean.length,
      width: dims.width,
      height: dims.height,
    });
  } catch (err) {
    await deleteBlobs([fileId]);
    throw err;
  }
}

/** Fetch and decrypt an image. Callers must have already checked chat membership. */
export async function readImage(chat: ChatDoc, imageId: string): Promise<{ bytes: Buffer; mime: ImageMime } | null> {
  if (!IMAGE_ID_RE.test(imageId)) return null;
  const message = await collections().messages.findOne(
    { chatId: chat._id, "image.id": imageId },
    { projection: { image: 1 } },
  );
  if (!message?.image) return null;
  const sealed = await downloadBlob(message.image.fileId);
  const bytes = chatCipher(chat).decryptImage(imageId, sealed);
  return { bytes, mime: message.image.mime };
}
