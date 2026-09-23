"use client";

import { Loader2, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { api } from "@/lib/api-client";
import { LIMITS } from "@/lib/validation";
import { cn } from "@/lib/utils";

export function NewChatButton({
  disabled,
  size = "lg",
  className,
}: {
  disabled?: boolean;
  size?: "sm" | "lg" | "default";
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();

  function create(e?: React.FormEvent) {
    e?.preventDefault();
    start(async () => {
      try {
        const { id } = await api<{ id: string }>("/api/chats", {
          method: "POST",
          json: title.trim() ? { title: title.trim() } : {},
        });
        router.push(`/c/${id}?share=1`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't create a chat");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button size={size} disabled={disabled} className={cn(size === "lg" && "h-10 px-4", className)}>
          <Plus /> New chat
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={create} className="contents">
          <DialogHeader>
            <DialogTitle>Blow a new blob</DialogTitle>
            <DialogDescription>
              You&apos;ll get a private link and QR code to share. The chat lives until you close it, or 5 days after the
              last activity.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="new-title">
              Title <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="new-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled blob"
              maxLength={LIMITS.title.max}
              autoFocus
              className="h-10"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Create &amp; get link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
