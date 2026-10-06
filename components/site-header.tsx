import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { UserMenu } from "@/components/auth/user-menu";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";
import { accountAvatarSeed } from "@/lib/account";
import { cn } from "@/lib/utils";

export async function SiteHeader({ className }: { className?: string }) {
  const session = await getSession().catch(() => null);
  return (
    <header
      className={cn(
        "sticky top-0 z-40 pt-safe border-b border-border/60 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/55",
        className,
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1.5">
          {session ? (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <UserMenu name={session.user.name} email={session.user.email} avatar={accountAvatarSeed(session.user.id)} />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/sign-up">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
