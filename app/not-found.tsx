import { unsure } from "blobatar/expression";
import Link from "next/link";
import { BlobField } from "@/components/brand/blob-field";
import { Logo } from "@/components/brand/logo";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <BlobField intensity={0.5} />
      <header className="relative z-10 mx-auto flex h-14 w-full max-w-6xl items-center px-4 sm:px-6">
        <Logo />
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center pb-20">
        <EmptyState
          seed="datblob:404"
          expression={unsure}
          title="Nothing floating here"
          action={
            <Button asChild>
              <Link href="/">Go home</Link>
            </Button>
          }
        >
          This page doesn&apos;t exist, or it already popped.
        </EmptyState>
      </main>
    </div>
  );
}
