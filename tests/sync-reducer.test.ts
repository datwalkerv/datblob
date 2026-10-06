import { describe, expect, it } from "vitest";
import { init, reducer, type State } from "@/hooks/use-chat-sync";
import type { MessageView, ParticipantView, SyncPayload } from "@/lib/types";

const person = (id: string, name: string, role: "owner" | "guest" = "guest"): ParticipantView => ({
  id,
  name,
  role,
  presence: "online",
  removed: false,
});
const msg = (seq: number, participantId: string, body = `m${seq}`): MessageView => ({
  id: `id${seq}`,
  seq,
  participantId,
  body,
  createdAt: new Date(2026, 0, 1, 12, seq).toISOString(),
});
const payload = (over: Partial<SyncPayload> & { rev?: number }): SyncPayload => ({
  chat: {
    id: "chat",
    title: "t",
    rev: over.rev ?? 0,
    locked: false,
    createdAt: "",
    lastActivityAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
  },
  me: { id: "alice", role: "owner", name: "Alice" },
  participants: [person("alice", "Alice", "owner"), person("bob", "Bob")],
  messages: [],
  cursor: 0,
  reset: false,
  serverTime: new Date().toISOString(),
  ...over,
});

function start(): State {
  return init(payload({ messages: [msg(1, "bob"), msg(2, "alice"), msg(3, "bob")], cursor: 3 }));
}

describe("sync reducer", () => {
  it("appends deltas", () => {
    const s = reducer(start(), { type: "sync", payload: payload({ messages: [msg(4, "alice")], cursor: 4 }) });
    expect(s.messages.map((m) => m.seq)).toEqual([1, 2, 3, 4]);
    expect(s.cursor).toBe(4);
  });

  it("replaces everything on a server reset", () => {
    const s = reducer(start(), {
      type: "sync",
      payload: payload({ rev: 1, reset: true, participants: [person("alice", "Alice", "owner")], messages: [msg(2, "alice")], cursor: 2 }),
    });
    expect(s.messages.map((m) => m.seq)).toEqual([2]);
    expect(s.cursor).toBe(2);
    expect(s.resync).toBe(false);
  });

  it("drops a departed person's messages even without a reset", () => {
    const s = reducer(start(), {
      type: "sync",
      payload: payload({ rev: 0, participants: [person("alice", "Alice", "owner")], messages: [], cursor: 3 }),
    });
    expect(s.messages.map((m) => m.participantId)).toEqual(["alice"]);
  });

  it("asks for a snapshot when the revision moves without a reset, then replaces", () => {
    let s = reducer(start(), { type: "sync", payload: payload({ rev: 1, messages: [], cursor: 3 }) });
    expect(s.resync).toBe(true);
    s = reducer(s, { type: "sync", payload: payload({ rev: 1, messages: [msg(2, "alice")], cursor: 2 }) });
    expect(s.resync).toBe(false);
    expect(s.messages.map((m) => m.seq)).toEqual([2]);
  });

  it("keeps messages from people removed by the owner (they stay listed as removed)", () => {
    const s = reducer(start(), {
      type: "sync",
      payload: payload({ participants: [person("alice", "Alice", "owner"), { ...person("bob", "Bob"), removed: true }], cursor: 3 }),
    });
    expect(s.messages).toHaveLength(3);
  });
});
