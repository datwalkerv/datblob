"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { LIMITS } from "@/lib/validation";
import { cn } from "@/lib/utils";

export function Composer({
  onSend,
  disabled,
  placeholder = "Write a message…",
}: {
  onSend: (body: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const max = LIMITS.message.max;
  const trimmed = value.trim();
  const over = value.length > max;

  // Auto-grow up to ~8 lines.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  function submit() {
    if (!trimmed || over || disabled) return;
    const body = value;
    setValue("");
    ref.current?.focus();
    onSend(body).catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 429) toast.error("You're sending messages too quickly.");
      else if (err instanceof ApiError && err.status === 400) toast.error(err.message);
    });
  }

  return (
    <div className="border-t border-border/70 bg-background/80 backdrop-blur-xl pb-safe">
      <form
        className="mx-auto flex w-full max-w-3xl items-end gap-2 px-3 pt-3 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div
          className={cn(
            "flex min-h-11 flex-1 items-end rounded-2xl border border-input bg-card px-3.5 py-2.5 transition-colors focus-within:border-brand/40 focus-within:ring-3 focus-within:ring-ring/25",
            over && "border-destructive/50",
          )}
        >
          <label htmlFor="composer" className="sr-only">
            Message
          </label>
          <textarea
            id="composer"
            ref={ref}
            rows={1}
            value={value}
            disabled={disabled}
            placeholder={disabled ? "This chat is no longer live" : placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            className="max-h-[200px] flex-1 resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            autoComplete="off"
            enterKeyHint="send"
          />
          {value.length > max * 0.8 && (
            <span className={cn("ml-2 shrink-0 self-end font-mono text-[0.65rem] tabular-nums", over ? "text-destructive" : "text-muted-foreground")}>
              {max - value.length}
            </span>
          )}
        </div>
        <Button
          type="submit"
          size="icon-lg"
          className="size-11 shrink-0 rounded-2xl"
          disabled={!trimmed || over || disabled}
          aria-label="Send message"
        >
          <ArrowUp className="size-5" />
        </Button>
      </form>
      <p className="mx-auto hidden w-full max-w-3xl px-6 pt-1.5 text-[0.7rem] text-muted-foreground sm:block">
        <kbd className="font-mono">Enter</kbd> to send · <kbd className="font-mono">Shift+Enter</kbd> for a new line · nothing here is kept after the chat ends
      </p>
    </div>
  );
}
