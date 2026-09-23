import "server-only";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { database, mongoClient } from "@/lib/db";
import { env } from "@/lib/env";
import { consume } from "@/lib/rate-limit";

function createAuth() {
  const e = env();
  const github =
    e.GITHUB_CLIENT_ID && e.GITHUB_CLIENT_SECRET
      ? { github: { clientId: e.GITHUB_CLIENT_ID, clientSecret: e.GITHUB_CLIENT_SECRET } }
      : {};

  return betterAuth({
    appName: "datblob",
    baseURL: e.BETTER_AUTH_URL,
    secret: e.BETTER_AUTH_SECRET,
    database: mongodbAdapter(database(), { client: mongoClient() }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
    },
    socialProviders: github,
    session: {
      expiresIn: 60 * 60 * 24 * 14,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },
    rateLimit: {
      enabled: process.env.NODE_ENV === "production",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60 * 10, max: 5 },
        "/get-session": false,
      },
      // Same Mongo limiter as the chat API: HMAC'd keys, TTL cleanup, no raw IPs at rest.
      customStorage: { consume: (key, rule) => consume(`auth:${key}`, rule) },
    },
    databaseHooks: {
      session: {
        create: {
          // Privacy: we don't need to know where or on what device people sign in from.
          before: async (session) => ({ data: { ...session, ipAddress: null, userAgent: null } }),
        },
      },
    },
    telemetry: { enabled: false },
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;

const g = globalThis as typeof globalThis & { __datblobAuth?: Auth };

/** Constructed on first use so builds don't require a configured environment. */
export function auth(): Auth {
  g.__datblobAuth ??= createAuth();
  return g.__datblobAuth;
}

export type Session = Auth["$Infer"]["Session"];
