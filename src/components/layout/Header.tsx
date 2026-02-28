"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { SignOutButton } from "@/components/auth/SignOutButton";

export function Header() {
  const { user, loading } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-3">
      <Link href="/" className="font-semibold">
        HTE
      </Link>
      {!loading && (
        <nav className="flex items-center gap-4 text-sm">
          {!user && (
            <Link
              href="/login"
              className="rounded-lg border border-[var(--border)] px-3 py-1 hover:bg-[var(--muted)]/40"
            >
              Login
            </Link>
          )}
          {user && (
            <>
              <span className="text-[var(--muted-foreground)]">{user.email}</span>
              <Link
                href="/settings"
                className="rounded-lg border border-[var(--border)] px-3 py-1 hover:bg-[var(--muted)]/40"
              >
                Settings
              </Link>
              <SignOutButton />
            </>
          )}
        </nav>
      )}
    </header>
  );
}

