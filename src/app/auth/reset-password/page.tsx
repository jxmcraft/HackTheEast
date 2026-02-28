import Link from "next/link";
import { PasswordResetForm } from "@/components/auth/PasswordResetForm";

export default function ResetPasswordPage() {
  return (
    <>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Reset your password</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          We’ll email you a password reset link.
        </p>
      </header>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <PasswordResetForm />
      </div>

      <p className="text-center text-sm text-[var(--muted-foreground)]">
        <Link href="/auth/signin" className="underline hover:text-[var(--foreground)]">
          Back to sign in
        </Link>
      </p>
    </>
  );
}

