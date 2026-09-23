import Link from "next/link";
import { BlobField } from "@/components/brand/blob-field";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <BlobField intensity={0.7} />
      <div className="bg-dots absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden="true" />
      <header className="relative z-10 mx-auto flex h-14 w-full max-w-6xl items-center px-4 sm:px-6">
        <Logo />
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm animate-fade-up">{children}</div>
      </main>
      <footer className="relative z-10 pb-6 text-center text-xs text-muted-foreground">
        Accounts only exist so you can own chats. Guests never need one.{" "}
        <Link href="/#privacy" className="underline-offset-4 hover:text-foreground hover:underline">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
