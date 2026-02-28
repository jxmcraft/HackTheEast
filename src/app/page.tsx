import Link from "next/link";
import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const user = await getUser();
  if (user) redirect("/sync-dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">HTE</h1>
      <p className="text-[var(--muted-foreground)]">
        Canvas LMS sync & study dashboard
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)]"
        >
          Sign up
        </Link>
      </div>
    </main>
  );
}
