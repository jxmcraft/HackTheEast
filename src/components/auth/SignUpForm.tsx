"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSignUp } from "@/hooks/useAuth";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignUpForm({
  className,
  nextUrl = "/sync-dashboard",
}: {
  className?: string;
  nextUrl?: string;
}) {
  const router = useRouter();

  const { signUp, loading, error } = useSignUp();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim();
    if (!emailRegex.test(trimmedEmail)) return setFormError("Enter a valid email address.");
    if (password.length < 8) return setFormError("Password must be at least 8 characters.");

    try {
      await signUp({ email: trimmedEmail, password, full_name: trimmedName || undefined });
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
        <label htmlFor="signup-name" className="text-sm font-medium">
          Full name <span className="text-[var(--muted-foreground)]">(optional)</span>
        </label>
        <input
          id="signup-name"
          name="full_name"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="signup-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="signup-email"
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
        <label htmlFor="signup-password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <p className="text-xs text-[var(--muted-foreground)]">At least 8 characters.</p>
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
        {loading ? "Creating account…" : "Sign up"}
      </button>
    </form>
  );
}

