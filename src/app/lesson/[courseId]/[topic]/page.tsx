import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { LessonContent } from "@/components/lesson/LessonContent";

type Props = { params: Promise<{ courseId: string; topic: string }>; searchParams: Promise<{ context?: string; lessonId?: string }> };

export default async function LessonPage({ params, searchParams }: Props) {
  const { courseId, topic } = await params;
  const { context: contextParam, lessonId: lessonIdParam } = await searchParams;
  const context = contextParam ? decodeURIComponent(contextParam) : "";
  const lessonIdFromUrl = lessonIdParam ? decodeURIComponent(lessonIdParam) : null;
  const courseIdNum = Number(courseId);
  if (!Number.isInteger(courseIdNum)) notFound();
  const topicDecoded = decodeURIComponent(topic.replace(/-/g, " "));
  if (!topicDecoded.trim()) notFound();

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/lesson/" + courseId + "/" + topic);

  const credentials = await (await import("@/lib/canvas-credentials")).getCanvasCredentialsFromProfile();
  let courseName: string | null = null;
  if (credentials?.baseUrl && credentials?.token) {
    try {
      const courses = await (await import("@/lib/canvas")).syncCourses(credentials);
      const c = courses.find((x) => x.id === courseIdNum);
      courseName = c?.name ?? null;
    } catch {
      // ignore
    }
  }

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Link href="/sync-dashboard" className="hover:text-[var(--foreground)]">Dashboard</Link>
          <span>/</span>
          <span>{courseName ?? `Course ${courseId}`}</span>
          <span>/</span>
          <span className="text-[var(--foreground)]">{topicDecoded}</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <section className="min-h-[400px] rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <h1 className="mb-2 text-xl font-bold">{topicDecoded}</h1>
            <p className="mb-4 text-sm text-[var(--muted-foreground)]">
              {courseName ? `Course: ${courseName}` : `Course ID: ${courseId}`}
            </p>
            {context && (
              <p className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3 text-sm">
                <span className="font-medium">Context:</span> {context}
              </p>
            )}
            <LessonContent
              courseId={courseId}
              topic={topicDecoded}
              context={context}
              lessonIdFromUrl={lessonIdFromUrl}
            />
          </section>
          <aside className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="mb-3 text-sm font-semibold">Tutor</h2>
            <div className="h-24 rounded-lg bg-[var(--muted)]/50 flex items-center justify-center text-[var(--muted-foreground)] text-sm">
              Avatar (Phase 4)
            </div>
            <div className="mt-4 rounded-lg border border-[var(--border)] p-3 text-sm text-[var(--muted-foreground)]">
              Chat / Q&A (Phase 4)
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
