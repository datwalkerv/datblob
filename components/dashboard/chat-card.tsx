"use client";

import { Blobatar } from "@blobatar/react";
import { Copy, Lock, MoreHorizontal, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CloseChatDialog } from "@/components/chat/close-chat-dialog";
import { ExpiryBadge } from "@/components/common/expiry-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCopy } from "@/hooks/use-copy";
import { useNow } from "@/hooks/use-now";
import { api } from "@/lib/api-client";
import { formatAgo } from "@/lib/format";
import type { OwnedChatListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ChatCard({ chat, origin, index }: { chat: OwnedChatListItem; origin: string; index: number }) {
  const router = useRouter();
  const [closeOpen, setCloseOpen] = useState(false);
  const [popping, setPopping] = useState(false);
  const { copy } = useCopy();
  const now = useNow(30_000);
  const url = `${origin}/c/${chat.id}`;

  async function close() {
    try {
      await api(`/api/chats/${chat.id}`, { method: "DELETE" });
      setCloseOpen(false);
      setPopping(true);
      toast.success(`“${chat.title}” was closed and deleted`);
      setTimeout(() => router.refresh(), 450);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't close the chat");
    }
  }

  return (
    <li
      className={cn("relative animate-fade-up list-none", popping && "animate-pop")}
      style={{ animationDelay: popping ? undefined : `${index * 40}ms` }}
    >
      <div className="group relative flex h-full flex-col rounded-2xl border border-border bg-card/60 p-4 transition-all hover:border-brand/25 hover:bg-card focus-within:border-brand/30">
        <div className="flex items-start gap-3">
          <Blobatar name={`chat:${chat.id}`} animate="hover" aria-hidden="true" className="size-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <Link
              href={`/c/${chat.id}`}
              className="block truncate font-medium tracking-tight outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
            >
              {chat.title}
            </Link>
            <p className="mt-0.5 text-xs text-muted-foreground" suppressHydrationWarning>
              Active {formatAgo(now - new Date(chat.lastActivityAt).getTime())}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="relative z-10 -mr-1 -mt-1" aria-label={`Options for ${chat.title}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => copy(url, "Invite link copied")}>
                <Copy /> Copy invite link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setCloseOpen(true)}>
                <Trash2 /> Close &amp; delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 text-[0.7rem] text-muted-foreground">
            <Users className="size-3" aria-hidden="true" />
            {chat.participants}
            {chat.online > 0 && (
              <>
                <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                <span className="text-success">{chat.online} online</span>
              </>
            )}
          </span>
          {chat.locked && (
            <span className="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 text-[0.7rem] text-muted-foreground">
              <Lock className="size-3" aria-hidden="true" /> locked
            </span>
          )}
          <ExpiryBadge expiresAt={chat.expiresAt} lastActivityAt={chat.lastActivityAt} className="relative z-10 ml-auto" />
        </div>
      </div>

      <CloseChatDialog open={closeOpen} onOpenChange={setCloseOpen} onConfirm={close} title={chat.title} participantCount={chat.participants} />
    </li>
  );
}
