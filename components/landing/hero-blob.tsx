"use client";

import { Blobatar } from "@blobatar/react";
import { useGaze } from "@blobatar/react/gaze";

/** The big hero face watches your pointer. Respects prefers-reduced-motion via the library. */
export function HeroBlob({ className }: { className?: string }) {
  const { ref } = useGaze({ travel: 5 });
  return (
    <Blobatar ref={ref} name="datblob" hue={292} tone={0.35} animate="always" aria-hidden="true" className={className} />
  );
}
