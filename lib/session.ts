import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@/lib/auth";

/** Per-request memoised session lookup for server components and route handlers. */
export const getSession = cache(async () => {
  // Read request headers first: it marks the route as dynamic before anything can throw.
  const h = await headers();
  return auth().api.getSession({ headers: h });
});

export async function sessionFrom(req: Request) {
  return auth().api.getSession({ headers: req.headers });
}
