import Link from "next/link";
import { Blobatar } from "@blobatar/react";
import { cn } from "@/lib/utils";

/** The mark is itself a blobatar — seeded with the product name, so it never changes. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Blobatar
      name="datblob"
      hue={292}
      tone={0.35}
      animate="hover"
      aria-hidden="true"
      className={cn("size-7 shrink-0", className)}
    />
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 rounded-md font-mono text-[0.95rem] font-semibold tracking-tight text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      aria-label="datblob home"
    >
      <LogoMark />
      <span>
        dat<span className="text-brand">blob</span>
      </span>
    </Link>
  );
}
