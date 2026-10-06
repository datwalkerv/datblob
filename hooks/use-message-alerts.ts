"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playMessageSound, unlockAudio } from "@/lib/sound";
import type { MessageView } from "@/lib/types";

const STORAGE_KEY = "datblob:sound";
const MIN_GAP_MS = 1200;

function readPref(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

/**
 * Alerts for messages from other people:
 *   - a short sound (unless muted; the choice is remembered on this device),
 *   - an unread count in the tab title while the tab is in the background.
 * Messages already on screen when the chat opens never trigger an alert.
 */
export function useMessageAlerts(messages: MessageView[], meId: string, active: boolean) {
  // Only affects the menu label, which isn't rendered until opened, so no hydration mismatch.
  const [soundOn, setSoundOn] = useState(() => (typeof window === "undefined" ? true : readPref()));
  const seen = useRef<Set<string> | null>(null);
  const unread = useRef(0);
  const baseTitle = useRef<string | null>(null);
  const lastSound = useRef(0);

  // Audio may only start after a user gesture; unlock on the first one.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    baseTitle.current = document.title;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      unread.current = 0;
      if (baseTitle.current) document.title = baseTitle.current;
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (baseTitle.current) document.title = baseTitle.current;
    };
  }, []);

  useEffect(() => {
    if (!seen.current) {
      seen.current = new Set(messages.map((m) => m.id));
      return;
    }
    const fresh = messages.filter((m) => !seen.current!.has(m.id));
    for (const m of fresh) seen.current.add(m.id);
    const incoming = fresh.filter((m) => m.participantId !== meId);
    if (!active || incoming.length === 0) return;

    const now = Date.now();
    if (soundOn && now - lastSound.current > MIN_GAP_MS) {
      lastSound.current = now;
      playMessageSound();
    }
    if (document.visibilityState === "hidden" && baseTitle.current) {
      unread.current += incoming.length;
      document.title = `(${unread.current}) ${baseTitle.current}`;
    }
  }, [messages, meId, active, soundOn]);

  const toggleSound = useCallback(() => {
    const next = !soundOn;
    setSoundOn(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {}
    if (next) {
      unlockAudio();
      playMessageSound(); // a preview, so you know what it sounds like
    }
  }, [soundOn]);

  return { soundOn, toggleSound };
}
