"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * An image inside a message. The src is datblob's own authenticated endpoint
 * (members only, decrypted on the fly, never cached), or a local blob: URL
 * while the upload is still in flight.
 */
export function ChatImage({
  src,
  width,
  height,
  alt,
  pending = false,
  className,
}: {
  src: string;
  width?: number | null;
  height?: number | null;
  alt: string;
  pending?: boolean;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const ratio = width && height ? width / height : 4 / 3;

  if (failed) {
    return (
      <div className={cn("flex h-28 w-56 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-muted/50 text-xs text-muted-foreground", className)}>
        <ImageOff className="size-4" aria-hidden="true" />
        Image unavailable
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => !pending && setOpen(true)}
        disabled={pending}
        className={cn(
          "group/img relative block overflow-hidden rounded-2xl border border-border bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          !loaded && "animate-pulse",
          className,
        )}
        style={{ aspectRatio: String(ratio), width: `min(18rem, 70vw, ${Math.round(20 * Math.max(ratio, 0.5))}rem)` }}
        aria-label={pending ? "Image uploading" : "Open image"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated, uncached, same-origin endpoint */}
        <img
          src={src}
          alt={alt}
          width={width ?? undefined}
          height={height ?? undefined}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "size-full object-cover transition-[opacity,transform] duration-300 group-hover/img:scale-[1.02]",
            loaded ? "opacity-100" : "opacity-0",
            pending && "opacity-60",
          )}
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] w-auto max-w-[94vw] border-border/60 bg-background/95 p-2 sm:max-w-[90vw]">
          <DialogTitle className="sr-only">Image</DialogTitle>
          <DialogDescription className="sr-only">{alt}</DialogDescription>
          {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
          <img src={src} alt={alt} className="max-h-[86dvh] max-w-full rounded-lg object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
}
