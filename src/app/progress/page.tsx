import Link from "next/link";
import { redirect } from "next/navigation";
import { createClientOrThrow } from "@/utils/supabase/server";
import { LearningProgress } from "@/components/progress/LearningProgress";
import { TrendingUp } from "lucide-react";

export default async function ProgressPage() {
  const supabase = createClientOrThrow();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/sync-dashboard"
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              ← Dashboard
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <TrendingUp className="h-7 w-7 text-[var(--muted-foreground)]" />
              Learning progress
            </h1>
          </div>
        </header>
        <p className="text-sm text-[var(--muted-foreground)]">
          Your study time, topics, and recent sessions. Data is used to personalize future lessons.
        </p>
        <LearningProgress />
      </div>
    </main>
  );
}
