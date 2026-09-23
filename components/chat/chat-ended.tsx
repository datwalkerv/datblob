"use client";

import { Blobatar } from "@blobatar/react";
import { sad, shy, sleepy } from "blobatar/expression";
import Link from "next/link";
import { BlobField } from "@/components/brand/blob-field";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

type Reason = "gone" | "removed" | "closed-by-me";

const COPY: Record<Reason, { title: string; body: string }> = {
  gone: {
    title: "This blob has popped",
    body: "The chat was closed by its owner or expired after 5 days without activity. Its messages and participants have been permanently deleted.",
  },
  removed: {
    title: "You're no longer in this chat",
    body: "The owner removed you from this conversation. Your access has been revoked on this device.",
  },
  "closed-by-me": {
    title: "Popped. Gone for good.",
    body: "The chat, its messages and its participant list were permanently deleted. Nobody can open the link anymore.",
  },
};

export function ChatEnded({ reason, isOwner = false }: { reason: Reason; isOwner?: boolean }) {
  const copy = COPY[reason];
  const expression = reason === "removed" ? shy : reason === "closed-by-me" ? sleepy : sad;
  return (
    <div className="relative flex min-h-dvh flex-col">
      <BlobField intensity={0.5} />
      <header className="relative z-10 mx-auto flex h-14 w-full max-w-6xl items-center px-4 sm:px-6">
        <Logo />
      </header>
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-20 text-center">
        <div className="relative mb-8">
          {/* The "pop": a ring that bursts outward once, behind the blob. */}
          <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full border border-brand/40 [animation-iteration-count:1]" />
          <Blobatar name="datblob:popped" expression={expression} animate="always" aria-hidden="true" className="relative size-24 animate-fade-up" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{copy.title}</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground text-balance">{copy.body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {isOwner || reason === "closed-by-me" ? (
            <Button asChild>
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild>
                <Link href="/sign-up">Start your own blob</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/">What is datblob?</Link>
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
