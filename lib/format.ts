const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "4d 23h", "5h 12m", "3m", "<1m" */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return "now";
  if (ms < MIN) return "<1m";
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / MIN);
  if (d > 0) return h ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

/** "just now", "4m ago", "3h ago", "2d ago" */
export function formatAgo(ms: number): string {
  if (ms < 45_000) return "just now";
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MIN))}m ago`;
  if (ms < DAY) return `${Math.round(ms / HOUR)}h ago`;
  return `${Math.round(ms / DAY)}d ago`;
}

const clock = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" });
const full = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export const formatClock = (d: Date) => clock.format(d);
export const formatFull = (d: Date) => full.format(d);

export function formatDay(d: Date, now = new Date()): string {
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / DAY);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return day.format(d);
}

/** Urgency tier for the expiry badge. */
export function expiryTone(ms: number): "calm" | "soon" | "urgent" {
  if (ms < 6 * HOUR) return "urgent";
  if (ms < DAY) return "soon";
  return "calm";
}
