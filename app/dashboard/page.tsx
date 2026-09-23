import { sleepy } from "blobatar/expression";
import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/common/empty-state";
import { ChatCard } from "@/components/dashboard/chat-card";
import { NewChatButton } from "@/components/dashboard/new-chat-button";
import { MAX_LIVE_CHATS_PER_OWNER } from "@/lib/chats/expiry";
import { listOwnedChats } from "@/lib/chats/service";
import { ready } from "@/lib/db";
import { requestOrigin } from "@/lib/origin";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/dashboard");
  await ready();
  const [chats, origin] = await Promise.all([listOwnedChats(session.user.id), requestOrigin()]);
  const atLimit = chats.length >= MAX_LIVE_CHATS_PER_OWNER;
  const firstName = session.user.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Hey {firstName},</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Your live blobs</h1>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Only chats that still exist are listed. Closed or expired chats are deleted permanently. There&apos;s no
            history to browse, by design.
          </p>
        </div>
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <NewChatButton disabled={atLimit} />
          <span className="font-mono text-[0.7rem] text-muted-foreground tabular-nums">
            {chats.length}/{MAX_LIVE_CHATS_PER_OWNER} live
          </span>
        </div>
      </div>

      {chats.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/30">
          <EmptyState
            seed="datblob:empty-dashboard"
            expression={sleepy}
            title="No blobs floating around"
            action={<NewChatButton />}
          >
            Start a chat, share the link, and it&apos;ll show up here while it&apos;s alive.
          </EmptyState>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {chats.map((chat, i) => (
            <ChatCard key={chat.id} chat={chat} origin={origin} index={i} />
          ))}
        </ul>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/40 p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">How deletion works:</span> closing a chat deletes it, its
          messages and its participants immediately. Chats you leave alone are deleted automatically 5 days after
          their last activity. Keeping the chat open counts as activity.
        </p>
      </div>
    </div>
  );
}
