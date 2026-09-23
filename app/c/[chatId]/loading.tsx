import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-dvh flex-col">
      <div className="flex h-14 items-center gap-3 border-b border-border/70 px-4">
        <Skeleton className="size-8 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-end gap-4 px-6 py-6">
        {[56, 72, 40].map((w, i) => (
          <div key={i} className={`flex gap-3 ${i === 1 ? "justify-end" : ""}`}>
            {i !== 1 && <Skeleton className="size-8 rounded-full" />}
            <Skeleton className="h-10 rounded-2xl" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
      <div className="border-t border-border/70 p-3">
        <Skeleton className="mx-auto h-11 max-w-3xl rounded-2xl" />
      </div>
    </div>
  );
}
