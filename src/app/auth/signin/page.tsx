import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";

export default function SignInPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const nextUrl = searchParams?.next ?? "/sync-dashboard";
  return (
    <>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Sign in to access your dashboard.
        </p>
      </header>

      <AuthForm defaultTab="signin" nextUrl={nextUrl} />

      <p className="text-center text-sm text-[var(--muted-foreground)]">
        Need an account?{" "}
        <Link href="/auth/signup" className="underline hover:text-[var(--foreground)]">
          Sign up
        </Link>
      </p>
    </>
  );
}

