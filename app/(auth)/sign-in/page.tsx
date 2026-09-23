import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { githubEnabled } from "@/lib/env";
import { safeNext } from "@/lib/redirect";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function Page({ searchParams }: PageProps<"/sign-in">) {
  const { next } = await searchParams;
  const target = safeNext(next);
  if (await getSession()) redirect(target);

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
      <div className="mb-6 space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to start a new blob or check on your live ones.</p>
      </div>
      <AuthForm mode="sign-in" next={target} github={githubEnabled()} />
    </div>
  );
}
