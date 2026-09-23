/** Only allow same-site relative paths as post-auth destinations. */
export function safeNext(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.startsWith("/api/")) return fallback;
  return value.slice(0, 200);
}
