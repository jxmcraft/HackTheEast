"use client";

import { useState } from "react";
import { usePasswordReset } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PasswordResetForm({ className }: { className?: string }) {
  const { requestPasswordReset, loading, error } = usePasswordReset();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSent(false);

    const trimmedEmail = email.trim();
    if (!emailRegex.test(trimmedEmail)) return setFormError("Enter a valid email address.");

    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=/`;
      await requestPasswordReset(trimmedEmail, redirectTo);
      setSent(true);
    } catch {
      // surfaced via hook
    }
  };

  const message = formError ?? error?.message ?? null;

  return (
    <form onSubmit={onSubmit} className={cn("space-y-4", className)} aria-busy={loading}>
      <div className="space-y-2">
        <label htmlFor="reset-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="reset-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>

      {sent && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          If that email exists, a reset link has been sent.
        </div>
      )}

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
        {loading ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

