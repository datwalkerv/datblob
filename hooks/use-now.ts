"use client";
import { useEffect, useState } from "react";

/** A ticking clock for relative-time labels. Labels using it set suppressHydrationWarning. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
