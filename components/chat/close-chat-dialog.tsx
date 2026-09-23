"use client";

import { Blobatar } from "@blobatar/react";
import { scared } from "blobatar/expression";
import { Loader2 } from "lucide-react";
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

export function CloseChatDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  messageCount,
  participantCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  title: string;
  messageCount?: number;
  participantCount?: number;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader className="items-center text-center sm:items-center sm:text-center">
          <Blobatar name={`close:${title}`} expression={scared} animate="always" aria-hidden="true" className="mb-2 size-16" />
          <AlertDialogTitle>Pop “{title}”?</AlertDialogTitle>
          <AlertDialogDescription className="text-balance">
            This ends the chat for everyone and permanently deletes
            {messageCount !== undefined ? ` all ${messageCount} ${messageCount === 1 ? "message" : "messages"}` : " every message"}
            {participantCount ? ` and ${participantCount} ${participantCount === 1 ? "participant" : "participants"}` : ""}.
            There is no archive and no undo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
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
            Close &amp; delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
