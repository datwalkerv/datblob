import type { Metadata } from "next";
import { BlobField } from "@/components/brand/blob-field";
import { Logo } from "@/components/brand/logo";
import { ChatEnded } from "@/components/chat/chat-ended";
import { ChatRoom } from "@/components/chat/chat-room";
import { JoinForm } from "@/components/chat/join-form";
import { accessFromContext } from "@/lib/chats/caller";
import { collections } from "@/lib/db";
import { syncChat, ownerDisplayName } from "@/lib/chats/service";
import { summarize } from "@/lib/chats/views";
import { requestOrigin } from "@/lib/origin";
import { getSession } from "@/lib/session";

// Deliberately generic: link unfurlers and browser history shouldn't learn anything about the chat.
export const metadata: Metadata = {
  title: "Private chat",
  description: "You've been invited to a temporary datblob chat.",
  robots: { index: false, follow: false },
  openGraph: { title: "You're invited to a datblob", description: "A temporary, private chat. Join with just a name." },
};

export default async function ChatPage({ params, searchParams }: PageProps<"/c/[chatId]">) {
  const [{ chatId }, { share }] = await Promise.all([params, searchParams]);
  const access = await accessFromContext(chatId);

  if (access.status === "gone") return <ChatEnded reason="gone" />;
  if (access.status === "removed") return <ChatEnded reason="removed" />;

  if (access.status === "visitor") {
    const [people, session] = await Promise.all([
      collections()
        .participants.find({ chatId: access.chat._id, removed: false }, { projection: { displayName: 1, role: 1 } })
        .sort({ role: -1, joinedAt: 1 })
        .limit(50)
        .toArray(),
      getSession(),
    ]);
    return (
      <div className="relative flex min-h-dvh flex-col">
        <BlobField intensity={0.7} />
        <header className="relative z-10 mx-auto flex h-14 w-full max-w-6xl items-center px-4 sm:px-6">
          <Logo />
        </header>
        <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16">
          <JoinForm
            chat={summarize(access.chat)}
            members={people.map((p) => p.displayName)}
            memberCount={people.length}
            suggestedName={session ? ownerDisplayName(session.user.name) : undefined}
          />
        </main>
      </div>
    );
  }

  const [initial, origin] = await Promise.all([
    syncChat(access.chat, access.participant, 0),
    requestOrigin(),
  ]);
  return <ChatRoom initial={initial} origin={origin} openShare={share === "1" && access.isOwner} />;
}
