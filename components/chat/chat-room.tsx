"use client";

import {
  ArrowLeft,
  Link2,
  Lock,
  LockOpen,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserPlus,
  Users,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { ChatEnded } from "@/components/chat/chat-ended";
import { CloseChatDialog } from "@/components/chat/close-chat-dialog";
import { Composer } from "@/components/chat/composer";
import { MessageList } from "@/components/chat/message-list";
import { ParticipantList } from "@/components/chat/participant-list";
import { RenameDialog } from "@/components/chat/rename-dialog";
import { ShareDialog } from "@/components/chat/share-dialog";
import { ExpiryBadge } from "@/components/common/expiry-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useChatSync } from "@/hooks/use-chat-sync";
import { useCopy } from "@/hooks/use-copy";
import { ApiError, api } from "@/lib/api-client";
import type { ChatSummary, ParticipantView, SyncPayload } from "@/lib/types";

export function ChatRoom({
  initial,
  origin,
  openShare = false,
}: {
  initial: SyncPayload;
  origin: string;
  openShare?: boolean;
}) {
  const router = useRouter();
  const chatId = initial.chat.id;
  const sync = useChatSync(chatId, initial);
  const { chat, me, participants, messages, pending, status, skew } = sync;
  const isOwner = me.role === "owner";
  const url = `${origin}/c/${chatId}`;

  const [shareOpen, setShareOpen] = useState(openShare);
  const [closeOpen, setCloseOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [closedByMe, setClosedByMe] = useState(false);
  const { copy } = useCopy();

  // Drop ?share=1 from the address bar so a refresh doesn't reopen the dialog.
  useEffect(() => {
    if (openShare) window.history.replaceState(null, "", `/c/${chatId}`);
  }, [openShare, chatId]);

  const activeCount = participants.filter((p) => !p.removed).length;
  const onlineCount = participants.filter((p) => !p.removed && p.presence === "online").length;

  async function closeChat() {
    try {
      await api(`/api/chats/${chatId}`, { method: "DELETE" });
      setClosedByMe(true);
      setCloseOpen(false);
      sync.markGone();
      toast.success("Chat closed. Everything in it has been deleted.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        sync.markGone();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Couldn't close the chat");
    }
  }

  async function patch(body: { title?: string; locked?: boolean }) {
    try {
      const { chat: next } = await api<{ chat: ChatSummary }>(`/api/chats/${chatId}`, { method: "PATCH", json: body });
      sync.setChat(next);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the chat");
      return false;
    }
  }

  async function removeParticipant(p: ParticipantView) {
    try {
      await api(`/api/chats/${chatId}/participants/${p.id}`, { method: "DELETE" });
      sync.markRemoved(p.id);
      toast.success(`${p.name} was removed`);
      sync.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove participant");
    }
  }

  if (status === "gone" || status === "removed") {
    return <ChatEnded reason={status === "removed" ? "removed" : closedByMe ? "closed-by-me" : "gone"} isOwner={isOwner} />;
  }

  const people = (
    <ParticipantList chatId={chatId} meId={me.id} participants={participants} canManage={isOwner} onRemove={removeParticipant} />
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* ------------------------------------------------------------ header */}
      <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-background/80 px-2 backdrop-blur-xl sm:px-4">
        {isOwner ? (
          <Button asChild variant="ghost" size="icon" aria-label="Back to dashboard">
            <Link href="/dashboard">
              <ArrowLeft />
            </Link>
          </Button>
        ) : (
          <Logo className="mr-1 hidden sm:inline-flex [&>span]:hidden" />
        )}

        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-semibold tracking-tight">{chat.title}</h1>
              {chat.locked && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Locked to new people" />
                  </TooltipTrigger>
                  <TooltipContent>Locked — no one new can join</TooltipContent>
                </Tooltip>
              )}
            </div>
            <p className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
              <span className="inline-block size-1.5 rounded-full bg-success" aria-hidden="true" />
              {onlineCount} online · {activeCount} {activeCount === 1 ? "person" : "people"}
            </p>
          </div>
          <ExpiryBadge
            expiresAt={chat.expiresAt}
            lastActivityAt={chat.lastActivityAt}
            skew={skew}
            compact
            className="ml-1 hidden sm:inline-flex"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setPeopleOpen(true)} aria-label="Show people">
            <Users />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShareOpen(true)} className="hidden sm:inline-flex">
            <UserPlus /> Invite
          </Button>
          <Button variant="ghost" size="icon" onClick={() => copy(url, "Invite link copied")} aria-label="Copy invite link" className="hidden sm:inline-flex">
            <Link2 />
          </Button>
          {isOwner && (
            <Button variant="destructive" size="sm" onClick={() => setCloseOpen(true)} className="hidden md:inline-flex">
              <Trash2 /> Close chat
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Chat options">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => setShareOpen(true)}>
                <UserPlus /> Invite people
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => copy(url, "Invite link copied")}>
                <Link2 /> Copy invite link
              </DropdownMenuItem>
              {isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
                    <Pencil /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={async () => {
                      if (await patch({ locked: !chat.locked }))
                        toast.success(chat.locked ? "Chat unlocked — the link works again" : "Chat locked — no one new can join");
                    }}
                  >
                    {chat.locked ? <LockOpen /> : <Lock />} {chat.locked ? "Unlock joining" : "Lock joining"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setCloseOpen(true)}>
                    <Trash2 /> Close &amp; delete chat
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {status === "reconnecting" && (
        <div role="status" className="flex items-center justify-center gap-2 border-b border-warning/20 bg-warning/10 py-1.5 text-xs text-warning">
          <WifiOff className="size-3.5" aria-hidden="true" /> Connection hiccup — retrying…
        </div>
      )}

      {/* -------------------------------------------------------------- body */}
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex justify-center border-b border-border/50 bg-muted/20 px-4 py-1.5 sm:hidden">
            <ExpiryBadge expiresAt={chat.expiresAt} lastActivityAt={chat.lastActivityAt} skew={skew} />
          </div>
          <MessageList
            chatId={chatId}
            meId={me.id}
            messages={messages}
            pending={pending}
            participants={participants}
            onRetry={(id) => void sync.retry(id)?.catch(() => {})}
            onDiscard={sync.discard}
            emptyHint={
              isOwner && activeCount <= 1 ? (
                <>
                  Nobody else is here yet.{" "}
                  <button type="button" onClick={() => setShareOpen(true)} className="font-medium text-foreground underline-offset-4 hover:underline">
                    Share the invite link
                  </button>{" "}
                  to bring people in.
                </>
              ) : undefined
            }
          />
          <Composer onSend={sync.send} />
        </main>

        <aside className="hidden w-72 shrink-0 flex-col gap-6 overflow-y-auto border-l border-border/70 bg-card/30 p-4 lg:flex" aria-label="Chat details">
          {people}
          <div className="rounded-xl border border-border bg-card/60 p-3.5">
            <p className="text-xs font-medium">Ephemeral by design</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {isOwner
                ? "This chat is deleted when you close it, or after 5 days without activity. There is no archive."
                : "This chat disappears when the owner closes it, or after 5 days without activity. Nothing is archived."}
            </p>
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setShareOpen(true)}>
              <UserPlus /> Invite people
            </Button>
          </div>
        </aside>
      </div>

      <Sheet open={peopleOpen} onOpenChange={setPeopleOpen}>
        <SheetContent side="right" className="w-[88vw] max-w-sm gap-0 p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle>{chat.title}</SheetTitle>
            <SheetDescription>
              {onlineCount} online · {activeCount} in this chat
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-6 overflow-y-auto p-4">
            {people}
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => { setPeopleOpen(false); setShareOpen(true); }}>
                <UserPlus /> Invite people
              </Button>
              {isOwner && (
                <Button variant="destructive" onClick={() => { setPeopleOpen(false); setCloseOpen(true); }}>
                  <Trash2 /> Close &amp; delete chat
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} url={url} title={chat.title} fresh={openShare} />
      {isOwner && (
        <>
          <CloseChatDialog
            open={closeOpen}
            onOpenChange={setCloseOpen}
            onConfirm={closeChat}
            title={chat.title}
            messageCount={messages.length}
            participantCount={activeCount}
          />
          <RenameDialog
            open={renameOpen}
            onOpenChange={setRenameOpen}
            current={chat.title}
            onSave={async (title) => {
              if (await patch({ title })) {
                toast.success("Chat renamed");
                router.refresh();
                return true;
              }
              return false;
            }}
          />
        </>
      )}
    </div>
  );
}
