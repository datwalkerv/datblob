"use client";

import { Check, Copy, Share2, ShieldAlert } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCopy } from "@/hooks/use-copy";

const noopSubscribe = () => () => {};

export function ShareDialog({
  open,
  onOpenChange,
  url,
  title,
  fresh = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title: string;
  fresh?: boolean;
}) {
  const { copied, copy } = useCopy();
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => "share" in navigator,
    () => false,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{fresh ? "Your blob is live" : "Invite people"}</DialogTitle>
          <DialogDescription>
            Anyone with this link can join with just a name — no account needed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-2">
          <div className="rounded-2xl bg-white p-3 shadow-[0_0_0_1px_var(--border),0_20px_60px_-20px_oklch(0.78_0.12_292/40%)]">
            <QRCodeSVG value={url} size={176} level="M" marginSize={1} bgColor="#ffffff" fgColor="#141417" title="QR code for the invite link" />
          </div>

          <div className="flex w-full gap-2">
            <label htmlFor="invite-url" className="sr-only">
              Invite link
            </label>
            <Input
              id="invite-url"
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="h-9 font-mono text-xs"
            />
            <Button onClick={() => copy(url, "Invite link copied")} className="h-9 shrink-0" aria-label="Copy invite link">
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          {canShare && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigator.share({ title: `Join “${title}” on datblob`, url }).catch(() => {})}
            >
              <Share2 /> Share via…
            </Button>
          )}

          <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
            The link is the key. Share it only with people you want in the room — you can remove anyone or lock
            the chat at any time.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
