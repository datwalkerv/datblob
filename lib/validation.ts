import { z } from "zod";

export const LIMITS = {
  displayName: { min: 2, max: 24 },
  title: { max: 60 },
  message: { max: 2000 },
} as const;

// Control, zero-width, bidi-override and line/paragraph separator characters.
const INVISIBLE = new RegExp(
  "[\\u0000-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u2028-\\u202F\\u2060-\\u206F\\uFEFF]",
  "g",
);

/** Collapse whitespace and strip control / zero-width characters. */
function clean(value: string): string {
  return value.normalize("NFC").replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
}

export const displayNameSchema = z
  .string()
  .transform(clean)
  .pipe(
    z
      .string()
      .min(LIMITS.displayName.min, `Use at least ${LIMITS.displayName.min} characters`)
      .max(LIMITS.displayName.max, `Keep it under ${LIMITS.displayName.max} characters`)
      .regex(/^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u, "Letters, numbers, spaces and . _ ' - only"),
  );

export const titleSchema = z
  .string()
  .transform(clean)
  .pipe(z.string().max(LIMITS.title.max, `Keep the title under ${LIMITS.title.max} characters`));

export const messageBodySchema = z
  .string()
  .transform((v) =>
    v
      .normalize("NFC")
      // keep newlines and tabs, drop other control chars
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim(),
  )
  .pipe(
    z
      .string()
      .min(1, "Message is empty")
      .max(LIMITS.message.max, `Messages are limited to ${LIMITS.message.max} characters`),
  );

export const createChatInput = z.object({ title: titleSchema.optional() });
export const updateChatInput = z
  .object({ title: titleSchema.optional(), locked: z.boolean().optional() })
  .refine((v) => v.title !== undefined || v.locked !== undefined, "Nothing to update");
export const joinChatInput = z.object({ displayName: displayNameSchema });
export const sendMessageInput = z.object({
  body: messageBodySchema,
  clientId: z.string().regex(/^[A-Za-z0-9_-]{8,40}$/).optional(),
});
export const syncQuery = z.object({
  after: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
});

export const signUpInput = z.object({
  name: displayNameSchema,
  email: z.email("Enter a valid email"),
  password: z.string().min(10, "Use at least 10 characters").max(128),
});
export const signInInput = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
