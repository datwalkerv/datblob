"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LIMITS } from "@/lib/validation";

export function RenameDialog({
  open,
  onOpenChange,
  current,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: string;
  onSave: (title: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setValue(current);
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <form
          className="contents"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const ok = await onSave(value.trim());
            setBusy(false);
            if (ok) onOpenChange(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="chat-title">Title</Label>
            <Input id="chat-title" value={value} maxLength={LIMITS.title.max} onChange={(e) => setValue(e.target.value)} autoFocus />
            <p className="text-xs text-muted-foreground">Everyone in the chat can see this.</p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
