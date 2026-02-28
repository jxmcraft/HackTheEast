export default function LessonLoading() {
  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex gap-2">
          <div className="h-4 w-12 animate-pulse rounded bg-[var(--muted)]" />
          <div className="h-4 w-16 animate-pulse rounded bg-[var(--muted)]" />
          <div className="h-4 w-24 animate-pulse rounded bg-[var(--muted)]" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="min-h-[400px] animate-pulse rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <div className="mb-4 h-6 w-3/4 animate-pulse rounded bg-[var(--muted)]" />
            <div className="mb-2 h-4 w-1/2 animate-pulse rounded bg-[var(--muted)]" />
            <div className="space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-[var(--muted)]" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-[var(--muted)]" />
              <div className="h-4 w-4/6 animate-pulse rounded bg-[var(--muted)]" />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="mb-3 h-4 w-16 animate-pulse rounded bg-[var(--muted)]" />
            <div className="h-24 animate-pulse rounded-lg bg-[var(--muted)]" />
            <div className="mt-4 h-20 animate-pulse rounded-lg bg-[var(--muted)]" />
          </div>
        </div>
      </div>
    </main>
  );
}
