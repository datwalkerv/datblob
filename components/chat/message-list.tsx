"use client";

import { Blobatar } from "@blobatar/react";
import { happy } from "blobatar/expression";
import { AlertCircle, ArrowDown, Loader2, RotateCw, X } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Linkified } from "@/components/chat/linkified";
import { OwnerBadge } from "@/components/chat/owner-badge";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import type { PendingMessage } from "@/hooks/use-chat-sync";
import { avatarSeed } from "@/lib/avatar";
import { formatClock, formatDay, formatFull } from "@/lib/format";
import type { MessageView, ParticipantView } from "@/lib/types";
import { cn } from "@/lib/utils";

const GROUP_WINDOW_MS = 5 * 60 * 1000;

type Item =
  | { kind: "day"; key: string; label: string }
  | { kind: "group"; key: string; authorId: string; at: Date; messages: MessageView[] };

function build(messages: MessageView[]): Item[] {
  const items: Item[] = [];
  let lastDay = "";
  let group: Extract<Item, { kind: "group" }> | null = null;

  for (const m of messages) {
    const at = new Date(m.createdAt);
    const dayKey = at.toDateString();
    if (dayKey !== lastDay) {
      items.push({ kind: "day", key: `d-${dayKey}`, label: formatDay(at) });
      lastDay = dayKey;
      group = null;
    }
    const prev = group?.messages.at(-1);
    if (group && group.authorId === m.participantId && prev && at.getTime() - new Date(prev.createdAt).getTime() < GROUP_WINDOW_MS) {
      group.messages.push(m);
    } else {
      group = { kind: "group", key: `g-${m.id}`, authorId: m.participantId, at, messages: [m] };
      items.push(group);
    }
  }
  return items;
}

export function MessageList({
  chatId,
  meId,
  messages,
  pending,
  participants,
  onRetry,
  onDiscard,
  emptyHint,
}: {
  chatId: string;
  meId: string;
  messages: MessageView[];
  pending: PendingMessage[];
  participants: ParticipantView[];
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
  emptyHint?: React.ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [unseen, setUnseen] = useState(0);
  const seenCount = useRef(messages.length);

  const people = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants]);
  const items = useMemo(() => build(messages), [messages]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  };

  useLayoutEffect(() => scrollToBottom("instant"), []);

  useEffect(() => {
    const added = messages.slice(seenCount.current);
    seenCount.current = messages.length;
    const mineAdded = added.some((m) => m.participantId === meId);
    if (atBottom.current || mineAdded) {
      scrollToBottom();
      setUnseen(0);
    } else if (added.length) {
      setUnseen((n) => n + added.length);
    }
  }, [messages, meId]);

  useEffect(() => {
    if (pending.length) scrollToBottom();
  }, [pending.length]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    if (atBottom.current) setUnseen(0);
  };

  const empty = messages.length === 0 && pending.length === 0;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="h-full overflow-y-auto overscroll-contain scroll-smooth"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Messages"
      >
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end gap-1 px-3 py-6 sm:px-6">
          {empty ? (
            <EmptyState seed={`${chatId}:empty`} expression={happy} title="It's quiet in here">
              {emptyHint ?? "Say hello. Everything in this chat disappears for good when it closes."}
            </EmptyState>
          ) : (
            items.map((item) =>
              item.kind === "day" ? (
                <div key={item.key} className="my-4 flex items-center gap-3 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
                  <span className="h-px flex-1 bg-border" />
                  {item.label}
                  <span className="h-px flex-1 bg-border" />
                </div>
              ) : (
                <MessageGroup
                  key={item.key}
                  chatId={chatId}
                  author={people.get(item.authorId)}
                  mine={item.authorId === meId}
                  at={item.at}
                  messages={item.messages}
                />
              ),
            )
          )}

          {pending.length > 0 && (
            <div className="mt-1 flex flex-col items-end gap-1">
              {pending.map((p) => (
                <div key={p.clientId} className="flex max-w-[85%] items-center gap-2 sm:max-w-[75%]">
                  {p.state === "failed" && (
                    <div className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="size-3.5" aria-hidden="true" />
                      <span className="sr-only sm:not-sr-only">Not sent</span>
                      <Button size="icon-xs" variant="ghost" onClick={() => onRetry(p.clientId)} aria-label="Retry sending">
                        <RotateCw />
                      </Button>
                      <Button size="icon-xs" variant="ghost" onClick={() => onDiscard(p.clientId)} aria-label="Discard message">
                        <X />
                      </Button>
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl rounded-br-md border px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap",
                      p.state === "failed"
                        ? "border-destructive/30 bg-destructive/10"
                        : "border-brand/15 bg-brand/10 opacity-70",
                    )}
                  >
                    {p.body}
                  </div>
                  {p.state === "sending" && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-label="Sending" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {unseen > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <Button
            size="sm"
            variant="secondary"
            className="pointer-events-auto animate-message-in rounded-full border border-border shadow-lg shadow-black/30"
            onClick={() => scrollToBottom()}
          >
            <ArrowDown /> {unseen} new {unseen === 1 ? "message" : "messages"}
          </Button>
        </div>
      )}
    </div>
  );
}

function MessageGroup({
  chatId,
  author,
  mine,
  at,
  messages,
}: {
  chatId: string;
  author?: ParticipantView;
  mine: boolean;
  at: Date;
  messages: MessageView[];
}) {
  const name = author?.name ?? "Someone";
  const isOwner = author?.role === "owner";

  if (mine) {
    return (
      <div className="mt-3 flex flex-col items-end gap-1 first:mt-0">
        <time dateTime={at.toISOString()} title={formatFull(at)} className="px-1 font-mono text-[0.65rem] text-muted-foreground" suppressHydrationWarning>
          {formatClock(at)}
        </time>
        {messages.map((m, i) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[85%] animate-message-in rounded-2xl border border-brand/20 bg-brand/15 px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground sm:max-w-[75%]",
              i === messages.length - 1 && "rounded-br-md",
            )}
            title={formatFull(new Date(m.createdAt))}
          >
            <Linkified text={m.body} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="group mt-3 flex gap-2.5 first:mt-0">
      <div className="w-8 shrink-0 pt-5">
        <Blobatar
          name={avatarSeed(chatId, name)}
          animate="hover"
          aria-hidden="true"
          className={cn("size-8 transition-opacity", author?.removed && "opacity-40 grayscale")}
        />
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1">
        <div className="flex items-center gap-1.5 px-1">
          <span className={cn("text-xs font-medium", author?.removed ? "text-muted-foreground line-through" : "text-foreground/90")}>
            {name}
          </span>
          {isOwner && <OwnerBadge />}
          <time dateTime={at.toISOString()} title={formatFull(at)} className="font-mono text-[0.65rem] text-muted-foreground" suppressHydrationWarning>
            {formatClock(at)}
          </time>
        </div>
        {messages.map((m, i) => (
          <Fragment key={m.id}>
            <div
              className={cn(
                "max-w-[85vw] animate-message-in rounded-2xl border px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap sm:max-w-xl",
                isOwner ? "border-brand/25 bg-card" : "border-border bg-card",
                i === messages.length - 1 && "rounded-bl-md",
              )}
              title={formatFull(new Date(m.createdAt))}
            >
              <Linkified text={m.body} />
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
