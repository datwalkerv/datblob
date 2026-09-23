"use client";

import { UserMinus } from "lucide-react";
import { OwnerBadge } from "@/components/chat/owner-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PresenceAvatar } from "@/components/ui/presence-avatar";
import { avatarSeed } from "@/lib/avatar";
import type { ParticipantView } from "@/lib/types";

const ORDER = { online: 0, away: 1, offline: 2 } as const;

export function ParticipantList({
  chatId,
  meId,
  participants,
  canManage,
  onRemove,
}: {
  chatId: string;
  meId: string;
  participants: ParticipantView[];
  canManage: boolean;
  onRemove: (p: ParticipantView) => void;
}) {
  const active = participants
    .filter((p) => !p.removed)
    .sort((a, b) =>
      a.role !== b.role ? (a.role === "owner" ? -1 : 1) : ORDER[a.presence] - ORDER[b.presence] || a.name.localeCompare(b.name),
    );
  const online = active.filter((p) => p.presence === "online").length;

  return (
    <section aria-labelledby="people-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 id="people-heading" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          People
        </h2>
        <span className="font-mono text-[0.7rem] text-muted-foreground tabular-nums">
          {online} online · {active.length}
        </span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {active.map((p) => (
          <li key={p.id} className="group flex items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted/50">
            <PresenceAvatar
              name={avatarSeed(chatId, p.name)}
              label={p.name}
              state={p.presence}
              className="size-8"
            />
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="truncate text-sm">{p.name}</span>
              {p.id === meId && <span className="text-xs text-muted-foreground">(you)</span>}
              {p.role === "owner" && <OwnerBadge />}
            </div>
            {canManage && p.role === "guest" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="opacity-100 text-muted-foreground hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    aria-label={`Remove ${p.name}`}
                  >
                    <UserMinus />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove {p.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      They&apos;ll lose access immediately and can&apos;t rejoin under this name. Their earlier messages stay until the chat pops.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={() => onRemove(p)}>
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
