"use client";

import { Blobatar } from "@blobatar/react";
import { happy } from "blobatar/expression";
import { ArrowRight, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState, useTransition } from "react";
import { ExpiryBadge } from "@/components/common/expiry-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api } from "@/lib/api-client";
import { avatarSeed } from "@/lib/avatar";
import type { ChatSummary } from "@/lib/types";
import { LIMITS, displayNameSchema } from "@/lib/validation";

export function JoinForm({
  chat,
  members,
  memberCount,
  suggestedName,
}: {
  chat: ChatSummary;
  members: string[];
  memberCount: number;
  suggestedName?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(suggestedName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [joined, setJoined] = useState(false);
  const preview = useDeferredValue(name.trim());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Pick another name");
    start(async () => {
      try {
        await api(`/api/chats/${chat.id}/join`, { method: "POST", json: { displayName: parsed.data } });
        setJoined(true);
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError && err.status === 410) return router.refresh();
        setError(err instanceof Error ? err.message : "Couldn't join the chat");
      }
    });
  }

  return (
    <div className="w-full max-w-md animate-fade-up rounded-2xl border border-border bg-card/70 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center" aria-hidden="true">
          {members.slice(0, 5).map((m) => (
            <Blobatar key={m} name={avatarSeed(chat.id, m)} background="circle" className="-ml-2 size-8 rounded-full ring-2 ring-card first:ml-0" />
          ))}
          {memberCount > 5 && (
            <span className="-ml-2 grid size-8 place-items-center rounded-full bg-muted font-mono text-[0.65rem] text-muted-foreground ring-2 ring-card">
              +{memberCount - 5}
            </span>
          )}
        </div>
        <ExpiryBadge expiresAt={chat.expiresAt} lastActivityAt={chat.lastActivityAt} />
      </div>

      <p className="mt-6 text-xs font-medium tracking-wide text-muted-foreground uppercase">You&apos;re invited to</p>
      <h1 className="mt-1 text-xl font-semibold tracking-tight break-words">{chat.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {memberCount} {memberCount === 1 ? "person is" : "people are"} here. No account needed — just pick a name for this chat.
      </p>

      {chat.locked ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-muted-foreground">
            The owner has locked this chat. New people can&apos;t join right now — ask them to unlock it.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
          <div className="flex items-end gap-4">
            <div className="relative shrink-0">
              <div className="absolute inset-0 -z-10 scale-125 rounded-full bg-brand-soft blur-xl" aria-hidden="true" />
              <Blobatar
                name={avatarSeed(chat.id, preview || "?")}
                expression={joined ? happy : undefined}
                animate="always"
                aria-hidden="true"
                className="size-14 transition-all"
              />
            </div>
            <div className="grid flex-1 gap-2">
              <Label htmlFor="display-name">Your name in this chat</Label>
              <Input
                id="display-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sam"
                maxLength={LIMITS.displayName.max}
                autoComplete="nickname"
                autoFocus
                className="h-10"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "join-error" : "join-hint"}
              />
            </div>
          </div>
          {error ? (
            <p id="join-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : (
            <p id="join-hint" className="text-xs text-muted-foreground">
              Your blob is unique to this chat, so you can&apos;t be recognised across conversations.
            </p>
          )}
          <Button type="submit" size="lg" className="h-10" disabled={pending || joined}>
            {pending || joined ? <Loader2 className="animate-spin" /> : null}
            Join chat
            {!pending && !joined && <ArrowRight />}
          </Button>
        </form>
      )}
    </div>
  );
}
