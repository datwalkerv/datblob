"use client";

import { Hourglass } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNow } from "@/hooks/use-now";
import { expiryTone, formatAgo, formatFull, formatRemaining } from "@/lib/format";
import { cn } from "@/lib/utils";

const TONE = {
  calm: "border-border bg-muted/60 text-muted-foreground",
  soon: "border-warning/25 bg-warning/10 text-warning",
  urgent: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function ExpiryBadge({
  expiresAt,
  lastActivityAt,
  skew = 0,
  className,
  compact = false,
}: {
  expiresAt: string;
  lastActivityAt: string;
  skew?: number;
  className?: string;
  compact?: boolean;
}) {
  const now = useNow(30_000) + skew;
  const remaining = new Date(expiresAt).getTime() - now;
  const tone = expiryTone(remaining);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[0.7rem] tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            TONE[tone],
            className,
          )}
          suppressHydrationWarning
        >
          <Hourglass className="size-3" aria-hidden="true" />
          <span suppressHydrationWarning>
            {compact ? formatRemaining(remaining) : `pops in ${formatRemaining(remaining)}`}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-center leading-relaxed">
        Permanently deleted after 5 days without activity — around{" "}
        <span suppressHydrationWarning>{formatFull(new Date(expiresAt))}</span>. Last activity{" "}
        <span suppressHydrationWarning>{formatAgo(now - new Date(lastActivityAt).getTime())}</span>.
      </TooltipContent>
    </Tooltip>
  );
}
