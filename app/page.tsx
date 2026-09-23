import { Blobatar } from "@blobatar/react";
import { happy, sleepy, wink } from "blobatar/expression";
import {
  ArrowRight,
  EyeOff,
  Fingerprint,
  KeyRound,
  ServerOff,
  Trash2,
  UserRoundX,
} from "lucide-react";
import Link from "next/link";
import { BlobField } from "@/components/brand/blob-field";
import { Logo } from "@/components/brand/logo";
import { DemoChat } from "@/components/landing/demo-chat";
import { HeroBlob } from "@/components/landing/hero-blob";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";

const STEPS = [
  {
    seed: "step:blow",
    expression: wink,
    title: "Blow a blob",
    body: "Sign in and start a chat in one click. You get an unguessable link and a QR code.",
  },
  {
    seed: "step:share",
    expression: happy,
    title: "Share the link",
    body: "Anyone with the link joins with just a name. No accounts, no apps, no phone numbers.",
  },
  {
    seed: "step:pop",
    expression: sleepy,
    title: "Let it pop",
    body: "Close it when you're done, or it deletes itself after 5 quiet days. Either way, it's gone for good.",
  },
];

const PRIVACY = [
  {
    icon: Trash2,
    title: "Deleted means deleted",
    body: "Closing a chat hard-deletes every message and participant on the spot. There's no archive, no soft delete, no backup copy to restore.",
  },
  {
    icon: UserRoundX,
    title: "Guests stay anonymous",
    body: "People you invite only choose a display name. No email, no phone number, no account.",
  },
  {
    icon: KeyRound,
    title: "Unguessable links",
    body: "Every chat id carries 128 bits of randomness, so links can't be guessed or enumerated. Owners can lock a chat or remove people at any time.",
  },
  {
    icon: Fingerprint,
    title: "Unlinkable faces",
    body: "Your blob avatar is generated per chat, so nobody can match you across conversations by your picture.",
  },
  {
    icon: EyeOff,
    title: "No trackers",
    body: "No analytics, no ad pixels and no third-party scripts. Fonts are self-hosted, and links you share don't leak referrers.",
  },
  {
    icon: ServerOff,
    title: "Minimal footprint",
    body: "We don't store IP addresses or device details. Rate limiting only keeps short-lived hashed counters.",
  },
];

export default async function LandingPage() {
  const session = await getSession().catch(() => null);
  const cta = session ? "/dashboard" : "/sign-up";

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* ------------------------------------------------------------ hero */}
        <section className="relative isolate overflow-hidden">
          <BlobField />
          <div className="bg-dots absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" aria-hidden="true" />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-4 pt-16 pb-20 sm:px-6 sm:pt-24 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:pb-28">
            <div className="animate-fade-up">
              <div className="mb-7 flex items-center gap-3">
                <HeroBlob className="size-14" />
                <span className="inline-flex h-7 items-center gap-2 rounded-full border border-brand/25 bg-brand-soft px-3 text-xs font-medium text-brand">
                  <span className="size-1.5 animate-pulse rounded-full bg-brand" aria-hidden="true" />
                  Ephemeral by default
                </span>
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Say it.
                <br />
                <span className="bg-gradient-to-r from-foreground via-brand to-foreground/60 bg-clip-text text-transparent">
                  Then let it pop.
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground text-balance sm:text-lg">
                datblob gives you a temporary chat room in seconds. Share it with a link or QR code, talk, then
                delete it for good in one click. No archives, no tracking, nothing left behind.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="h-11 px-5 text-sm">
                  <Link href={cta}>
                    Start a temporary chat <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost" className="h-11 px-4 text-sm">
                  <Link href="#how">How it works</Link>
                </Button>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                Free. Guests don&apos;t need an account. Chats delete themselves after 5 days without activity.
              </p>
            </div>

            <div className="animate-fade-up [animation-delay:120ms]">
              <DemoChat />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- how it works */}
        <section id="how" className="scroll-mt-20 border-t border-border/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
            <div className="max-w-xl">
              <p className="font-mono text-xs tracking-wide text-brand uppercase">How it works</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance">
                Blobs appear, hold a conversation, and disappear.
              </h2>
            </div>
            <ol className="mt-12 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="group relative rounded-2xl border border-border bg-card/50 p-6 transition-colors hover:border-brand/25 hover:bg-card">
                  <div className="flex items-center justify-between">
                    <Blobatar name={step.seed} expression={step.expression} animate="hover" aria-hidden="true" className="size-12" />
                    <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                  </div>
                  <h3 className="mt-6 font-medium tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* --------------------------------------------------------- privacy */}
        <section id="privacy" className="scroll-mt-20 border-t border-border/60 bg-card/20">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
            <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
              <div>
                <p className="font-mono text-xs tracking-wide text-brand uppercase">Privacy</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance">Built to forget.</h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  datblob is for conversations that shouldn&apos;t outlive their purpose: sharing a code, coordinating
                  a plan, a quick candid chat. Temporary is the product, not an option buried in a settings menu.
                </p>
              </div>
              <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
                {PRIVACY.map(({ icon: Icon, title, body }) => (
                  <div key={title} className="bg-background p-6">
                    <Icon className="size-5 text-brand" aria-hidden="true" />
                    <h3 className="mt-4 text-sm font-medium">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- cta */}
        <section className="relative isolate overflow-hidden border-t border-border/60">
          <BlobField intensity={0.6} />
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-6">
            <div className="flex -space-x-3" aria-hidden="true">
              {["cta:a", "cta:b", "cta:c", "cta:d"].map((s) => (
                <Blobatar key={s} name={s} background="circle" animate="hover" className="size-12 rounded-full ring-4 ring-background" />
              ))}
            </div>
            <h2 className="mt-8 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Your next conversation doesn&apos;t need to last forever.
            </h2>
            <Button asChild size="lg" className="mt-8 h-11 px-5">
              <Link href={cta}>
                Start a temporary chat <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <Logo />
          <p>Essential cookies only. No analytics. Nothing kept once a chat is gone.</p>
        </div>
      </footer>
    </div>
  );
}
