import "server-only";
import { z } from "zod";

const schema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB: z.string().min(1).default("datblob"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.url().optional(),
  /** 32 random bytes, base64. Encrypts per-chat data keys. Generate: openssl rand -base64 32 */
  DATA_ENCRYPTION_KEY: z.string().min(40, "DATA_ENCRYPTION_KEY is required (openssl rand -base64 32)"),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  CRON_SECRET: z.string().min(16).optional(),
  RATE_LIMIT_SECRET: z.string().min(16).optional(),
  /** datupload API key. Server-only: never prefix with NEXT_PUBLIC_. Image sharing is off when unset. */
  STORAGE_API_KEY: z.string().min(16).optional(),
  STORAGE_API_URL: z.url().default("https://datupload.vercel.app"),
  /** datclean metadata-stripping service (no key needed). */
  DATCLEAN_API_URL: z.url().default("https://datclean.vercel.app"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/**
 * Validated lazily, on first use, so `next build` can import route modules
 * without a database configured. A misconfigured deployment fails loudly on
 * its first request instead of serving half-working pages.
 */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function imagesEnabled(): boolean {
  return Boolean(env().STORAGE_API_KEY);
}

export function githubEnabled(): boolean {
  const e = env();
  return Boolean(e.GITHUB_CLIENT_ID && e.GITHUB_CLIENT_SECRET);
}
