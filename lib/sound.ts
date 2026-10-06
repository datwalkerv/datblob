"use client";

/**
 * A tiny synthesized "bloop" for incoming messages. Generated with the Web
 * Audio API, so there is no audio file to load and no third-party request.
 *
 * Browsers only allow audio after the user has interacted with the page, so
 * the context is created/resumed on the first pointer or key press. Once
 * unlocked it keeps working while the tab is in the background.
 */

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  ctx ??= new AudioContext();
  return ctx;
}

export function unlockAudio(): void {
  const c = context();
  if (c && c.state === "suspended") void c.resume().catch(() => {});
}

export function playMessageSound(): void {
  const c = context();
  if (!c || c.state !== "running") return;
  const now = c.currentTime;
  const out = c.createGain();
  out.gain.value = 0.18;
  out.connect(c.destination);

  // Two quick rising notes: a soft, bubbly "bl-oop".
  note(c, out, now, 520, 780, 0.09);
  note(c, out, now + 0.075, 700, 1040, 0.12);
}

function note(c: AudioContext, out: AudioNode, start: number, from: number, to: number, length: number) {
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + length * 0.7);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(1, start + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(env).connect(out);
  osc.start(start);
  osc.stop(start + length + 0.02);
}
