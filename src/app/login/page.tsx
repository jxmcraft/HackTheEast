import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const next = searchParams?.next ?? "/sync-dashboard";

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Use your email and password to access your dashboard.
          </p>
        </header>

        <LoginForm next={next} />

        <p className="text-center text-sm text-[var(--muted-foreground)]">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="underline hover:text-[var(--foreground)]">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}

