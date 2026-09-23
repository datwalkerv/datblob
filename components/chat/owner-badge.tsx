import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

export function OwnerBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-4.5 items-center gap-1 rounded-full border border-brand/25 bg-brand-soft px-1.5 text-[0.65rem] font-medium tracking-wide text-brand uppercase",
        className,
      )}
    >
      <Crown className="size-2.5" aria-hidden="true" />
      owner
    </span>
  );
}
