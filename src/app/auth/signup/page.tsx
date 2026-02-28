import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";

export default function SignUpPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const nextUrl = searchParams?.next ?? "/sync-dashboard";
  return (
    <>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Sign up to start syncing Canvas and tracking study sessions.
        </p>
      </header>

      <AuthForm defaultTab="signup" nextUrl={nextUrl} />

      <p className="text-center text-sm text-[var(--muted-foreground)]">
        Already have an account?{" "}
        <Link href="/auth/signin" className="underline hover:text-[var(--foreground)]">
          Sign in
        </Link>
      </p>
    </>
  );
}

