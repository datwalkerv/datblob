"use client";

import { ArrowRight, ClipboardPaste, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extractChatId } from "@/lib/invite";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/**
 * "Join with link": paste an invite link (or chat id) to open the room here.
 * Essential for the installed iOS app, where scanning a QR code with the
 * camera opens Safari rather than the Home Screen app.
 */
export function JoinLinkButton({ size = "lg", className }: { size?: "sm" | "lg" | "default"; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canReadClipboard = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.clipboard?.readText === "function",
    () => false,
  );

  function go(input: string) {
    const id = extractChatId(input);
    if (!id) {
      setError("That doesn't look like a datblob invite link.");
      return;
    }
    setError(null);
    start(() => router.push(`/c/${id}`));
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      setValue(text);
      go(text);
    } catch {
      setError("Couldn't read the clipboard. Paste the link into the field instead.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        setOpen(o);
        if (!o) {
          setValue("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size={size} className={cn(size === "lg" && "h-10 px-4", className)}>
          <Link2 /> Join with link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            go(value);
          }}
        >
          <DialogHeader>
            <DialogTitle>Join with a link</DialogTitle>
            <DialogDescription>Paste an invite link someone shared with you to open the chat right here.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="invite-link">Invite link</Label>
            <Input
              id="invite-link"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (extractChatId(text)) {
                  e.preventDefault();
                  setValue(text.trim());
                  go(text);
                }
              }}
              placeholder="https://…/c/…"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="url"
              enterKeyHint="go"
              autoFocus
              className="h-10 font-mono text-base sm:text-xs md:text-xs"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "invite-error" : undefined}
            />
            {error && (
              <p id="invite-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {canReadClipboard ? (
              <Button type="button" variant="ghost" onClick={pasteFromClipboard} disabled={pending}>
                <ClipboardPaste /> Paste from clipboard
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={pending || !value.trim()}>
              Open chat <ArrowRight />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
