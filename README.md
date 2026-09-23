<div align="center">

<img src="./app/icon.svg" width="10%" alt="datblob" style="border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);" />

# datblob

**Say it. Then let it pop.**

A temporary, private chat room you can spin up in seconds and delete for good in one click.

</div>

## ✨ Key Features

- **⚡ Instant Chat Rooms**: Sign in, start a chat, and it's ready.
- **🔗 Link & QR Sharing**: Share a chat with a link or a scannable QR code. Guests join with just a name, no account needed.
- **🫧 Blobatar Identities**: Every participant gets a generated blob avatar. Avatars are seeded per chat, so the same person looks different in every room.
- **🟢 Live Presence**: See who's online, away, or gone, and watch new messages arrive with no page refresh.
- **👑 Owner Controls**: Rename a chat, remove participants, and close the chat. Closing it deletes everything at once.
- **⏳ Self-Destructing Chats**: A chat and everything in it is permanently deleted after 5 days without activity. There's no archive and no undo.
- **🔐 Encrypted at Rest**: Message bodies and chat titles are encrypted with AES-256-GCM, and every chat has its own key.
- **🌟 Premium Minimal UI**: A dark neutral interface with a soft violet accent and blobs that react when you hover.


## 🛠️ Technology Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Runtime & View Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with [shadcn/ui](https://ui.shadcn.com/) components
- **Type Safety**: [TypeScript](https://www.typescriptlang.org/) and [Zod](https://zod.dev/)
- **Authentication**: [Better Auth](https://www.better-auth.com/) (email & password, optional GitHub)
- **Database**: [MongoDB](https://www.mongodb.com/)
- **Avatars**: [Blobatar](https://www.npmjs.com/package/blobatar)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Fonts**: [Geist & Geist Mono](https://vercel.com/font), self-hosted

## ⚖️ Privacy & Security

### Encryption at Rest
- Each chat gets its own random 256-bit data key. That key is stored on the chat, wrapped with a master key that never goes into the database.
- Each ciphertext is bound to its chat and its position in the chat. A value that's edited, or copied into another chat, fails to decrypt.
- Deleting a chat deletes its key, so any leftover messages, including copies in backups, can no longer be read.

### Identity & Access
- Owner actions are checked on the server. If you don't own a chat, the API answers `404`, as if the chat didn't exist.
- Guests get a random token in an httpOnly cookie scoped to that one chat. The server stores only its hash.
- Chat ids are random values, so links can't be guessed.
- Creating chats, joining, sending messages, and signing in are all rate-limited.

### Privacy Policy
- datblob collects **nothing beyond what a chat needs to work**. No analytics, no third-party scripts, and essential cookies only.
- Sessions don't store IP addresses or user agents, and rate-limit records hold only hashed keys that expire on their own.
- Chat pages are marked `noindex`, requests send `Referrer-Policy: no-referrer`, and a strict CSP is in place.
- The only data stored is what a live chat needs:
  - Your account (email and name) if you're a chat owner
  - Chat titles and messages, encrypted
  - Participant display names and last-seen times
- When a chat ends, all of it is gone.

<br>

**Made with love for love. 💜**  
*Say it. Then let it pop.*
