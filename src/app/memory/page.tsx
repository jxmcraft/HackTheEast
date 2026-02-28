"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Brain, ChevronDown, ChevronRight, FileText, Link2, BookOpen, ClipboardList, Settings } from "lucide-react";

type MaterialMeta = {
  title?: string;
  url?: string;
  source?: string;
  module_name?: string;
};

type Material = {
  canvas_item_id: string;
  content_type: string;
  metadata: MaterialMeta;
  chunk_count: number;
  preview: string;
};

type CourseWithMaterials = {
  id: string;
  name: string;
  canvas_id: number;
  materials: Material[];
};

export default function MemoryPage() {
  const [courses, setCourses] = useState<CourseWithMaterials[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/materials");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? res.statusText);
        }
        const data = await res.json();
        if (!cancelled) {
          setCourses(Array.isArray(data.courses) ? data.courses : []);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const iconForType = (type: string) => {
    switch (type) {
      case "file":
        return <FileText className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />;
      case "assignment":
        return <ClipboardList className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />;
      case "page":
        return <BookOpen className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />;
      default:
        return <FileText className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />;
    }
  };

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/sync-dashboard" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              ← Dashboard
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Brain className="h-7 w-7 text-[var(--muted-foreground)]" />
              Agent memory
            </h1>
            <Link
              href="/settings"
              className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted)]"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <p className="text-sm text-[var(--muted-foreground)]">
          Files and pages extracted from each course and used for lesson retrieval. Linked pages from Canvas content are included.
        </p>

        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] py-12">
            <p className="text-[var(--muted-foreground)]">Loading…</p>
          </div>
        )}

        {!loading && !error && courses.length === 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted-foreground)]">
            <p>No course materials yet.</p>
            <p className="mt-2 text-sm">Sync a course from the dashboard and run ingestion to populate memory.</p>
            <Link href="/sync-dashboard" className="mt-4 inline-block text-sm text-[var(--foreground)] underline">
              Go to dashboard
            </Link>
          </div>
        )}

        {!loading && courses.length > 0 && (
          <div className="space-y-3">
            {courses.map((course) => {
              const isExpanded = expanded.has(course.id);
              const hasMaterials = course.materials.length > 0;
              return (
                <div
                  key={course.id}
                  className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]"
                >
                  <button
                    type="button"
                    onClick={() => toggle(course.id)}
                    className="flex w-full items-center gap-2 p-4 text-left hover:bg-[var(--muted)]/30"
                  >
                    {hasMaterials ? (
                      isExpanded ? (
                        <ChevronDown className="h-5 w-5 shrink-0 text-[var(--muted-foreground)]" />
                      ) : (
                        <ChevronRight className="h-5 w-5 shrink-0 text-[var(--muted-foreground)]" />
                      )
                    ) : (
                      <span className="w-5 shrink-0" />
                    )}
                    <span className="font-semibold">{course.name}</span>
                    <span className="text-sm text-[var(--muted-foreground)]">
                      (Canvas {course.canvas_id})
                    </span>
                    <span className="ml-auto rounded bg-[var(--muted)] px-2 py-0.5 text-xs">
                      {course.materials.length} item{course.materials.length !== 1 ? "s" : ""}
                    </span>
                  </button>
                  {isExpanded && (
                    <ul className="border-t border-[var(--border)] bg-[var(--muted)]/10">
                      {course.materials.length === 0 ? (
                        <li className="p-4 text-sm text-[var(--muted-foreground)]">
                          No materials extracted. Ingest this course from the dashboard.
                        </li>
                      ) : (
                        course.materials.map((m) => (
                          <li
                            key={m.canvas_item_id}
                            className="border-b border-[var(--border)] last:border-b-0"
                          >
                            <div className="flex gap-3 p-3">
                              {iconForType(m.content_type)}
                              <div className="min-w-0 flex-1">
                                <p className="font-medium">
                                  {m.metadata?.title ?? m.canvas_item_id}
                                </p>
                                {(m.metadata?.url || m.metadata?.source) && (
                                  <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-[var(--muted-foreground)]">
                                    {m.metadata?.source === "linked" && (
                                      <span className="inline-flex items-center gap-0.5">
                                        <Link2 className="h-3 w-3" /> Linked
                                      </span>
                                    )}
                                    {m.metadata?.url && (
                                      <a
                                        href={m.metadata.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="truncate underline hover:no-underline"
                                      >
                                        {m.metadata.url}
                                      </a>
                                    )}
                                  </p>
                                )}
                                {m.metadata?.module_name && (
                                  <p className="text-xs text-[var(--muted-foreground)]">
                                    Module: {m.metadata.module_name}
                                  </p>
                                )}
                                {m.preview && (
                                  <p className="mt-1 line-clamp-2 text-xs text-[var(--muted-foreground)]">
                                    {m.preview}
                                  </p>
                                )}
                                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                                  {m.chunk_count} chunk{m.chunk_count !== 1 ? "s" : ""} · {m.content_type}
                                </p>
                              </div>
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
