"use client";

import { Bell, BellOff, BellRing, Loader2, Share, SquarePlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePush } from "@/hooks/use-push";

export function NotificationButton({ chatId, publicKey }: { chatId: string; publicKey: string | null }) {
  const { state, enable, disable } = usePush(chatId, publicKey);
  const [installOpen, setInstallOpen] = useState(false);

  if (state === "unsupported" || state === "loading") return null;

  const on = state === "on";
  const label =
    state === "needs-install"
      ? "Get notifications on iPhone"
      : state === "denied"
        ? "Notifications are blocked"
        : on
          ? "Turn off notifications"
          : "Notify me about new messages";

  function onClick() {
    if (state === "needs-install") return setInstallOpen(true);
    if (state === "denied") {
      toast.error("Notifications are blocked for this site. Allow them in your browser's site settings, then try again.");
      return;
    }
    if (on) void disable();
    else void enable();
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClick}
            disabled={state === "busy"}
            aria-label={label}
            aria-pressed={on}
            className={on ? "text-brand hover:text-brand" : undefined}
          >
            {state === "busy" ? (
              <Loader2 className="animate-spin" />
            ) : on ? (
              <BellRing />
            ) : state === "denied" ? (
              <BellOff />
            ) : (
              <Bell />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>

      <Dialog open={installOpen} onOpenChange={setInstallOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Notifications on iPhone</DialogTitle>
            <DialogDescription>
              Apple only delivers web notifications to sites added to the Home Screen. It takes a few seconds:
            </DialogDescription>
          </DialogHeader>
          <ol className="flex flex-col gap-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted font-mono text-xs">1</span>
              <span>
                Tap <Share className="inline size-4 align-text-bottom text-brand" aria-label="Share" /> Share in Safari&apos;s toolbar.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted font-mono text-xs">2</span>
              <span>
                Choose <SquarePlus className="inline size-4 align-text-bottom text-brand" aria-hidden="true" />{" "}
                <span className="font-medium">Add to Home Screen</span>.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted font-mono text-xs">3</span>
              <span>Open datblob from your Home Screen, come back to this chat, and tap the bell.</span>
            </li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Notifications only say who wrote, never what they wrote. Requires iOS 16.4 or later.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
