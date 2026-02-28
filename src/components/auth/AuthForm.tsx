"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";

type Tab = "signin" | "signup";

export function AuthForm({
  defaultTab = "signin",
  nextUrl,
  className,
}: {
  defaultTab?: Tab;
  nextUrl?: string;
  className?: string;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab);

  return (
    <div className={cn("w-full max-w-md space-y-4", className)}>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-2">
        <div role="tablist" aria-label="Authentication" className="grid grid-cols-2 gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "signin"}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium",
              tab === "signin"
                ? "bg-white text-black"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
            onClick={() => setTab("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "signup"}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium",
              tab === "signup"
                ? "bg-white text-black"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
            onClick={() => setTab("signup")}
          >
            Sign up
          </button>
        </div>
      </div>

      <div
        className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
        role="tabpanel"
      >
        {tab === "signin" ? (
          <SignInForm nextUrl={nextUrl} />
        ) : (
          <SignUpForm nextUrl={nextUrl} />
        )}
      </div>

      <p className="text-center text-xs text-[var(--muted-foreground)]">
        By continuing, you agree to the app policies.{" "}
        <Link href="/" className="underline hover:text-[var(--foreground)]">
          Home
        </Link>
      </p>
    </div>
  );
}

