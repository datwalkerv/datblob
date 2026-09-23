"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { GithubIcon } from "@/components/brand/github-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/ui/password-field";
import { Separator } from "@/components/ui/separator";
import { signIn, signUp } from "@/lib/auth-client";
import { signInInput, signUpInput } from "@/lib/validation";

type Mode = "sign-in" | "sign-up";

export function AuthForm({ mode, next, github }: { mode: Mode; next: string; github: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [oauthPending, setOauthPending] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isSignUp = mode === "sign-up";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let action: () => Promise<{ error: { status: number; message?: string } | null }>;
    if (isSignUp) {
      const parsed = signUpInput.safeParse({ name, email, password });
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the form");
      action = () => signUp.email(parsed.data);
    } else {
      const parsed = signInInput.safeParse({ email, password });
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the form");
      action = () => signIn.email(parsed.data);
    }
    start(async () => {
      const res = await action();
      if (res.error) {
        setError(
          res.error.status === 429
            ? "Too many attempts. Wait a minute and try again."
            : (res.error.message ?? "Something went wrong"),
        );
        return;
      }
      toast.success(isSignUp ? "Welcome to datblob" : "Welcome back");
      router.push(next);
      router.refresh();
    });
  }

  async function withGithub() {
    setOauthPending(true);
    const res = await signIn.social({ provider: "github", callbackURL: next });
    if (res.error) {
      setOauthPending(false);
      toast.error(res.error.message ?? "GitHub sign-in failed");
    }
  }

  const busy = pending || oauthPending;

  return (
    <div className="flex flex-col gap-6">
      {github && (
        <>
          <Button type="button" variant="outline" size="lg" className="h-10" onClick={withGithub} disabled={busy}>
            {oauthPending ? <Loader2 className="animate-spin" /> : <GithubIcon />}
            Continue with GitHub
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" />
            or with email
            <Separator className="flex-1" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {isSignUp && (
          <div className="grid gap-2">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              autoComplete="nickname"
              placeholder="How you appear in chats you own"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              className="h-10"
              required
            />
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10"
            required
          />
        </div>

        <PasswordField
          id="password"
          name={email || "datblob"}
          size={84}
          label="Password"
          value={password}
          onValueChange={setPassword}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          minLength={isSignUp ? 10 : undefined}
          required
          className="max-w-none"
        />

        {error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="mt-1 h-10" disabled={busy}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {isSignUp ? "Create account" : "Sign in"}
          {!pending && <ArrowRight />}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? "Already have an account? " : "New to datblob? "}
        <Link
          href={`${isSignUp ? "/sign-in" : "/sign-up"}${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {isSignUp ? "Sign in" : "Create one"}
        </Link>
      </p>
    </div>
  );
}
