"use client";

import { Blobatar } from "@blobatar/react";
import { sad } from "blobatar/expression";
import { Loader2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function LeaveChatDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  seed,
  messageCount,
  photoCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  title: string;
  /** The leaver's own avatar seed, so the face in the dialog is theirs. */
  seed: string;
  messageCount: number;
  photoCount: number;
}) {
  const [busy, setBusy] = useState(false);
  const textCount = messageCount - photoCount;
  const parts = [
    textCount > 0 && `${textCount} ${textCount === 1 ? "message" : "messages"}`,
    photoCount > 0 && `${photoCount} ${photoCount === 1 ? "photo" : "photos"}`,
  ].filter(Boolean);

  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader className="items-center text-center sm:items-center sm:text-center">
          <Blobatar name={seed} expression={sad} animate="always" aria-hidden="true" className="mb-2 size-16" />
          <AlertDialogTitle>Leave “{title}”?</AlertDialogTitle>
          <AlertDialogDescription className="text-balance">
            You&apos;ll leave the chat, and everything you sent will be deleted for everyone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p className="leading-relaxed text-foreground/90">
            {parts.length ? (
              <>
                Your <span className="font-medium">{parts.join(" and ")}</span> will be permanently deleted.
              </>
            ) : (
              <>Anything you sent will be permanently deleted.</>
            )}{" "}
            They <span className="font-medium">can&apos;t be recovered</span> by you, the owner, or anyone else.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Stay</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            Leave &amp; delete my messages
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
