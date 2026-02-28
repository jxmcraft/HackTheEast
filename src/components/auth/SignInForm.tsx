"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSignIn } from "@/hooks/useAuth";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInForm({
  className,
  nextUrl = "/sync-dashboard",
}: {
  className?: string;
  nextUrl?: string;
}) {
  const router = useRouter();

  const { signIn, loading, error } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedEmail = email.trim();
    if (!emailRegex.test(trimmedEmail)) return setFormError("Enter a valid email address.");
    if (password.length < 8) return setFormError("Password must be at least 8 characters.");

    try {
      await signIn({ email: trimmedEmail, password });
      router.push(nextUrl);
      router.refresh();
    } catch {
      // error is surfaced via hook
    }
  };

  const message = formError ?? error?.message ?? null;

  return (
    <form onSubmit={onSubmit} className={cn("space-y-4", className)} aria-busy={loading}>
      <div className="space-y-2">
        <label htmlFor="signin-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="signin-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="signin-password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="signin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <div className="flex items-center justify-between">
          <Link
            href="/auth/reset-password"
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            Forgot password?
          </Link>
        </div>
      </div>

      {message && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-400"
        >
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

