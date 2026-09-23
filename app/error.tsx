"use client";

import { sick } from "blobatar/expression";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <EmptyState
        seed="datblob:error"
        expression={sick}
        title="Something went sideways"
        action={<Button onClick={reset}>Try again</Button>}
      >
        An unexpected error occurred. Nothing was lost. Please try again.
      </EmptyState>
    </main>
  );
}
