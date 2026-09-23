import { Blobatar } from "@blobatar/react";
import type { Expression } from "blobatar/expression";
import { cn } from "@/lib/utils";

export function EmptyState({
  seed,
  expression,
  title,
  children,
  action,
  className,
}: {
  seed: string;
  expression?: Expression;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      <div className="relative mb-5">
        <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-brand-soft blur-2xl" aria-hidden="true" />
        <Blobatar name={seed} expression={expression} animate="always" aria-hidden="true" className="size-20" />
      </div>
      <h2 className="text-base font-semibold tracking-tight text-balance">{title}</h2>
      {children && <div className="mt-1.5 max-w-sm text-sm text-muted-foreground text-balance">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
