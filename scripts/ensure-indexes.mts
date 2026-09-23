/**
 * Creates every index datblob relies on, including the TTL indexes that make
 * expired chats disappear. The app also does this lazily on cold start; run it
 * explicitly after provisioning a new database:  pnpm db:indexes
 */
import { existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);

const { ensureIndexes, mongoClient } = await import("../lib/db");
await ensureIndexes();
console.log("✓ indexes ensured");
await mongoClient().close();
