"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

export function SignOutButton({
  className,
  children = "Sign out",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const { signOut } = useAuth();

  return (
    <button
      type="button"
      onClick={async () => {
        await signOut();
        router.push("/auth/signin");
        router.refresh();
      }}
      className={cn(
        "rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]/40",
        className
      )}
    >
      {children}
    </button>
  );
}

