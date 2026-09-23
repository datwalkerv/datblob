"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { ApiError, api, clientId as newClientId } from "@/lib/api-client";
import type { ChatSummary, MessageView, ParticipantView, SyncPayload } from "@/lib/types";

const VISIBLE_MS = 2_000;
const HIDDEN_MS = 15_000;
const MAX_BACKOFF_MS = 30_000;

export type ChatStatus = "live" | "gone" | "removed" | "reconnecting";

export type PendingMessage = {
  clientId: string;
  body: string;
  createdAt: string;
  state: "sending" | "failed";
};

type State = {
  chat: ChatSummary;
  me: SyncPayload["me"];
  participants: ParticipantView[];
  messages: MessageView[];
  pending: PendingMessage[];
  cursor: number;
  status: ChatStatus;
  /** serverTime - clientTime, so countdowns don't depend on the viewer's clock being right. */
  skew: number;
};

type Action =
  | { type: "sync"; payload: SyncPayload }
  | { type: "status"; status: ChatStatus }
  | { type: "queue"; pending: PendingMessage }
  | { type: "sent"; clientId: string; message: MessageView }
  | { type: "failed"; clientId: string }
  | { type: "discard"; clientId: string }
  | { type: "chat"; chat: ChatSummary }
  | { type: "participant-removed"; id: string };

function merge(existing: MessageView[], incoming: MessageView[]): MessageView[] {
  if (!incoming.length) return existing;
  const byId = new Map(existing.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.seq - b.seq);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "sync": {
      const p = action.payload;
      const messages = merge(state.messages, p.messages);
      const landed = new Set(p.messages.map((m) => m.clientId).filter(Boolean));
      return {
        ...state,
        chat: p.chat,
        me: p.me,
        participants: p.participants,
        messages,
        pending: state.pending.filter((m) => !landed.has(m.clientId)),
        cursor: Math.max(state.cursor, p.cursor),
        status: state.status === "reconnecting" ? "live" : state.status,
        skew: new Date(p.serverTime).getTime() - Date.now(),
      };
    }
    case "status":
      return { ...state, status: action.status };
    case "queue":
      return { ...state, pending: [...state.pending, action.pending] };
    case "sent":
      return {
        ...state,
        messages: merge(state.messages, [action.message]),
        pending: state.pending.filter((m) => m.clientId !== action.clientId),
      };
    case "failed":
      return {
        ...state,
        pending: state.pending.map((m) => (m.clientId === action.clientId ? { ...m, state: "failed" } : m)),
      };
    case "discard":
      return { ...state, pending: state.pending.filter((m) => m.clientId !== action.clientId) };
    case "chat":
      return { ...state, chat: action.chat };
    case "participant-removed":
      return {
        ...state,
        participants: state.participants.map((p) =>
          p.id === action.id ? { ...p, removed: true, presence: "offline" } : p,
        ),
      };
  }
}

function init(initial: SyncPayload): State {
  return {
    chat: initial.chat,
    me: initial.me,
    participants: initial.participants,
    messages: initial.messages,
    pending: [],
    cursor: initial.cursor,
    status: "live",
    skew: new Date(initial.serverTime).getTime() - Date.now(),
  };
}

/**
 * Short-polling sync, designed for serverless: no sockets, no long-lived
 * connections. Polls fast while the tab is visible, slowly when hidden,
 * backs off on errors, and stops for good once the chat is gone.
 */
export function useChatSync(chatId: string, initial: SyncPayload) {
  const [state, dispatch] = useReducer(reducer, initial, init);
  const cursor = useRef(state.cursor);
  const status = useRef<ChatStatus>(state.status);
  const pollNow = useRef<() => void>(() => {});

  useEffect(() => {
    cursor.current = state.cursor;
    status.current = state.status;
  }, [state.cursor, state.status]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let failures = 0;
    let stopped = false;

    const stop = (s: ChatStatus) => {
      stopped = true;
      clearTimeout(timer);
      dispatch({ type: "status", status: s });
    };

    const schedule = () => {
      if (stopped) return;
      clearTimeout(timer);
      const delay = failures
        ? Math.min(MAX_BACKOFF_MS, VISIBLE_MS * 2 ** failures)
        : document.visibilityState === "hidden"
          ? HIDDEN_MS
          : VISIBLE_MS;
      timer = setTimeout(tick, delay);
    };

    async function tick() {
      if (stopped) return;
      controller?.abort();
      controller = new AbortController();
      try {
        const payload = await api<SyncPayload>(`/api/chats/${chatId}/sync?after=${cursor.current}`, {
          signal: controller.signal,
        });
        failures = 0;
        dispatch({ type: "sync", payload });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (err instanceof ApiError && (err.status === 410 || err.status === 404)) return stop("gone");
        if (err instanceof ApiError && (err.status === 403 || err.status === 401)) return stop("removed");
        failures++;
        if (failures >= 2) dispatch({ type: "status", status: "reconnecting" });
      }
      schedule();
    }

    pollNow.current = () => {
      if (stopped) return;
      clearTimeout(timer);
      void tick();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") pollNow.current();
    };
    const onOnline = () => pollNow.current();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    schedule();

    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [chatId]);

  const deliver = useCallback(
    async (pending: PendingMessage) => {
      try {
        const { message } = await api<{ message: MessageView }>(`/api/chats/${chatId}/messages`, {
          method: "POST",
          json: { body: pending.body, clientId: pending.clientId },
        });
        dispatch({ type: "sent", clientId: pending.clientId, message });
        pollNow.current();
      } catch (err) {
        if (err instanceof ApiError && (err.status === 410 || err.status === 404)) {
          dispatch({ type: "status", status: "gone" });
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          dispatch({ type: "status", status: "removed" });
          return;
        }
        dispatch({ type: "failed", clientId: pending.clientId });
        throw err;
      }
    },
    [chatId],
  );

  const send = useCallback(
    (body: string) => {
      const pending: PendingMessage = {
        clientId: newClientId(),
        body,
        createdAt: new Date().toISOString(),
        state: "sending",
      };
      dispatch({ type: "queue", pending });
      return deliver(pending);
    },
    [deliver],
  );

  const retry = useCallback(
    (clientId: string) => {
      const p = state.pending.find((m) => m.clientId === clientId);
      if (!p) return;
      dispatch({ type: "discard", clientId });
      dispatch({ type: "queue", pending: { ...p, state: "sending" } });
      return deliver({ ...p, state: "sending" });
    },
    [deliver, state.pending],
  );

  const discard = useCallback((clientId: string) => dispatch({ type: "discard", clientId }), []);
  const setChat = useCallback((chat: ChatSummary) => dispatch({ type: "chat", chat }), []);
  const markRemoved = useCallback((id: string) => dispatch({ type: "participant-removed", id }), []);
  const markGone = useCallback(() => dispatch({ type: "status", status: "gone" }), []);
  const refresh = useCallback(() => pollNow.current(), []);

  return { ...state, send, retry, discard, setChat, markRemoved, markGone, refresh };
}
