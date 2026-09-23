"use client";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { sick } from "blobatar/expression";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      seed="datblob:error"
      expression={sick}
      title="We couldn't load your chats"
      action={<Button onClick={reset}>Try again</Button>}
    >
      Something went wrong on our side. Your chats are unaffected.
    </EmptyState>
  );
}
