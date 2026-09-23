import { cn } from "@/lib/utils";

/**
 * Soft, slowly drifting colour blobs used as ambient background. Pure CSS,
 * aria-hidden, and frozen under prefers-reduced-motion.
 */
export function BlobField({ className, intensity = 1 }: { className?: string; intensity?: number }) {
  const o = (v: number) => Math.min(1, v * intensity);
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div
        className="animate-blob-float absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: `radial-gradient(closest-side, oklch(0.78 0.12 292 / ${o(0.16)}), transparent)` }}
      />
      <div
        className="animate-blob-float absolute top-40 -left-40 size-[28rem] rounded-full blur-3xl [animation-delay:-5s]"
        style={{ background: `radial-gradient(closest-side, oklch(0.72 0.1 220 / ${o(0.1)}), transparent)` }}
      />
      <div
        className="animate-blob-float absolute -right-32 top-72 size-[26rem] rounded-full blur-3xl [animation-delay:-9s]"
        style={{ background: `radial-gradient(closest-side, oklch(0.76 0.12 340 / ${o(0.08)}), transparent)` }}
      />
    </div>
  );
}
