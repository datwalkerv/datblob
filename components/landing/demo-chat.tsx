"use client";

import { Hourglass, Lock, UserPlus } from "lucide-react";
import { GroupChat } from "@/components/ui/group-chat";

const MESSAGES = [
  { name: "demo:mira", title: "Mira", text: "sending the door code here so it doesn't live in our group chat forever", time: "21:04" },
  { name: "demo:mira", title: "Mira", text: "4471 — valid till sunday", time: "21:04" },
  { name: "demo:jon", title: "Jon", text: "got it. pop this once everyone's in?", time: "21:06" },
  { name: "demo:ada", title: "Ada", text: "in 👍 closing it now", time: "21:07" },
];

export function DemoChat() {
  return (
    <div className="relative">
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-brand/30 via-border to-transparent" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-2xl bg-card shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium">weekend keys</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 font-mono text-[0.7rem] text-muted-foreground">
              <Hourglass className="size-3" aria-hidden="true" /> pops in 4d 23h
            </span>
            <span className="hidden h-6 items-center gap-1 rounded-full border border-border px-2.5 text-[0.7rem] text-muted-foreground sm:inline-flex">
              <UserPlus className="size-3" aria-hidden="true" /> invite
            </span>
          </div>
        </div>
        <GroupChat messages={MESSAGES} className="rounded-none border-0 bg-transparent" />
      </div>
    </div>
  );
}
