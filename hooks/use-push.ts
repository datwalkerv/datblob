"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/api-client";

export type PushState =
  | "loading"
  | "unsupported"
  /** iPhone/iPad in a browser tab: web push only works once added to the Home Screen. */
  | "needs-install"
  | "denied"
  | "off"
  | "on"
  | "busy";

const flagKey = (chatId: string) => `datblob:push:${chatId}`;

function readFlag(chatId: string): boolean {
  try {
    return localStorage.getItem(flagKey(chatId)) === "on";
  } catch {
    return false;
  }
}
function writeFlag(chatId: string, on: boolean) {
  try {
    if (on) localStorage.setItem(flagKey(chatId), "on");
    else localStorage.removeItem(flagKey(chatId));
  } catch {}
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
function supported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Per-chat push notification toggle for this browser. */
export function usePush(chatId: string, publicKey: string | null) {
  const [state, setState] = useState<PushState>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: PushState;
      if (!publicKey) next = "unsupported";
      else if (isIos() && !isStandalone()) next = "needs-install";
      else if (!supported()) next = "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else next = readFlag(chatId) && (await currentSubscription()) ? "on" : "off";
      if (!cancelled) setState(next);
    })().catch(() => !cancelled && setState("unsupported"));
    return () => {
      cancelled = true;
    };
  }, [chatId, publicKey]);

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setState("busy");
    try {
      // Must be called from the click handler: browsers require a user gesture.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));

      await api(`/api/chats/${chatId}/push`, { method: "POST", json: { subscription: sub.toJSON() } });
      writeFlag(chatId, true);
      setState("on");
      toast.success("Notifications on for this chat");
    } catch (err) {
      setState("off");
      toast.error(err instanceof ApiError ? err.message : "Couldn't turn on notifications in this browser.");
    }
  }, [chatId, publicKey]);

  const disable = useCallback(async () => {
    setState("busy");
    try {
      const sub = await currentSubscription();
      // Only this chat is unsubscribed; the browser-wide subscription may serve other chats.
      if (sub) await api(`/api/chats/${chatId}/push`, { method: "DELETE", json: { endpoint: sub.endpoint } });
      writeFlag(chatId, false);
      setState("off");
      toast.success("Notifications off for this chat");
    } catch {
      setState("on");
      toast.error("Couldn't turn off notifications. Try again.");
    }
  }, [chatId]);

  return { state, enable, disable };
}
