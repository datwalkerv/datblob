"use client";

import { LayoutGrid, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Blobatar } from "@/components/ui/blobatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-client";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none transition-transform hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="Account menu"
      >
        <Blobatar name={email} className="size-8" blobatar={{ animate: "hover" }} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
          <span className="truncate text-sm font-medium text-foreground">{name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <LayoutGrid /> Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={pending}
          onSelect={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await signOut();
              if (res.error) {
                toast.error(res.error.message ?? "Couldn't sign out");
                return;
              }
              router.push("/");
              router.refresh();
            });
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
