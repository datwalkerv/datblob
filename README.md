# datblob

Temporary, privacy-focused chat. Sign in, start a chat, and share its link or QR code. Anyone with the link
joins with just a name. When the owner closes the chat, or after 5 days without activity, the chat and
everything in it are permanently deleted.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Blobatar · Better Auth · MongoDB

## Setup

```bash
pnpm install
cp .env.example .env.local   # then fill it in
pnpm db:indexes              # optional: the app also creates indexes on cold start
pnpm dev
```

### Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGODB_URI` | ✓ | MongoDB Atlas connection string. The free M0 tier is enough. |
| `MONGODB_DB` | | Defaults to `datblob` |
| `BETTER_AUTH_SECRET` | ✓ | At least 32 characters. Generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | ✓ in prod | Public origin, e.g. `https://datblob.app` |
| `DATA_ENCRYPTION_KEY` | ✓ | Master key for encrypting messages at rest. 32 bytes, base64: `openssl rand -base64 32` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | | Turns on "Continue with GitHub". The button is hidden when these are unset. |
| `CRON_SECRET` | ✓ in prod | Protects `/api/cron/purge`. Vercel sends it automatically. |
| `RATE_LIMIT_SECRET` | | HMAC key for rate-limit counters. Falls back to `BETTER_AUTH_SECRET`. |

**Atlas:**
1. Create a free cluster and a database user.
2. Under Network Access, allow `0.0.0.0/0`, because Vercel functions don't have fixed IPs.
3. Copy the `mongodb+srv://…` driver string.

**GitHub OAuth:**
1. Create an OAuth App under GitHub → Settings → Developer settings.
2. Set the callback URL to `<BETTER_AUTH_URL>/api/auth/callback/github`.

### Deploy to Vercel

1. Import the repo and set the environment variables above.
2. Deploy. `vercel.json` registers a daily cron (`/api/cron/purge`), which runs on the Hobby plan.

## How it works

### Sync without WebSockets

Clients short-poll `GET /api/chats/:id/sync?after=<seq>`:
- Every 2 s while the tab is visible and every 15 s while it's hidden.
- Backs off exponentially after errors, up to 30 s.
- Polls again immediately after you send a message or come back to the tab.

Each message gets a sequence number per chat, allocated atomically with `$inc`. The cursor never skips a
number that's still being written, so messages sent at the same moment can't get lost. Presence comes from
`lastSeenAt`, and that write is throttled so most polls don't write anything.

### Expiry and deletion

1. **Access guard.** Every read and write goes through `getLiveChat()`, which treats a chat past its
   `expiresAt` as gone and deletes it immediately.
2. **Activity.** Messages, joins and an owner keeping the chat open push `expiresAt` to 5 days from now.
3. **TTL index.** A TTL index on `chats.expiresAt` makes MongoDB drop expired chats within about a minute.
4. **Daily cron.** A daily sweep deletes any expired chats and orphaned messages or participants that are left.

**Close chat** deletes the chat document first, so access is cut off right away, then its messages and
participants. Nothing is soft-deleted or archived.

### Encryption at rest

Message bodies and chat titles are stored encrypted with AES-256-GCM, using envelope encryption:

- Each chat gets its own random 256-bit data key.
- That key is stored on the chat, wrapped (encrypted) with `DATA_ENCRYPTION_KEY`. The master key never goes
  into the database.
- Each ciphertext is authenticated together with its chat id, and for messages its sequence number too. A
  value that is edited, or copied into another chat or another slot, fails to decrypt.
- Deleting a chat deletes its wrapped key. Any messages left behind, including ones in backups that lack
  the chat document, can no longer be decrypted.

So a leaked database dump or backup shows ciphertext, not conversations. This is server-side encryption, not
end-to-end: the app server decrypts to serve messages, so anyone holding both the database and
`DATA_ENCRYPTION_KEY` can read live chats. Display names stay in plaintext, because the database uses them
to keep names unique within a chat.

### Identity and authorization

- **Owners** are Better Auth users. Every owner action checks `chat.ownerId === session.user.id` on the
  server. If you don't own a chat, the API answers `404`, as if the chat didn't exist.
- **Guests** get a random 256-bit token in an httpOnly cookie scoped to that one chat. The server stores
  only its SHA-256 hash.
- **Chat ids** are 128-bit random values encoded as base64url, and the server checks their format before
  querying.
- **Mutations** require a same-origin request and SameSite cookies.
- **Rate limits** use one Mongo fixed-window limiter with HMAC'd keys, shared by auth and chat.
  - Create: 10 per hour
  - Join: 10 per minute per IP
  - Messages: 20 per 10 s
  - Sync: 120 per minute

### Privacy

- There are no analytics or third-party scripts, and fonts are self-hosted.
- Headers send `Referrer-Policy: no-referrer` and a strict CSP, and chat pages are marked `noindex`.
- Sessions don't store IP addresses or user agents. Rate-limit records contain only hashed keys and expire
  on their own.
- Avatars are generated per chat (`chatId + name`), so a person's avatar can't be matched across chats.
- Messages are encrypted at rest (see above) but not end-to-end, and the landing page says so.

## Scripts

```bash
pnpm dev          # dev server
pnpm build        # production build
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest (integration tests run against an in-memory MongoDB replica set)
pnpm db:indexes   # create indexes, including the TTL indexes
```

## Layout

```
app/                  routes: landing, (auth), dashboard, c/[chatId], api/*
components/chat/      chat room, message list, composer, share/close dialogs, join form
components/ui/        shadcn primitives and Blobatar registry components
hooks/use-chat-sync   polling engine (reducer + backoff + optimistic sends)
lib/chats/            domain logic: access, service, delete, expiry, views
lib/{auth,db,env,rate-limit,validation}.ts
proxy.ts              optimistic auth redirect for /dashboard
```
