"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Brain, Download, ExternalLink, FileText, Link2, BookOpen, ClipboardList, Database } from "lucide-react";

type MaterialMeta = {
  title?: string;
  url?: string;
  source?: string;
  module_name?: string;
  file_storage_path?: string;
  file_name?: string;
  file_content_type?: string;
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

type CanvasCourse = { id: number; name: string; course_code?: string };

type CanvasAssignment = {
  id: number;
  name: string;
  description?: string | null;
  due_at: string | null;
  course_id: number;
};

type RecentLesson = {
  id: string;
  course_id_canvas: number;
  course_name: string | null;
  topic: string;
  status: string;
  created_at: string;
};

export default function CourseMemoryPage() {
  const params = useParams<{ courseCanvasId: string }>();
  const courseCanvasId = useMemo(() => Number(params?.courseCanvasId), [params?.courseCanvasId]);
  const [course, setCourse] = useState<CourseWithMaterials | null>(null);
  const [courseInfo, setCourseInfo] = useState<CanvasCourse | null>(null);
  const [relevantLessons, setRelevantLessons] = useState<RecentLesson[]>([]);
  const [courseAssignments, setCourseAssignments] = useState<CanvasAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!Number.isFinite(courseCanvasId)) {
        setError("Invalid course ID.");
        setLoading(false);
        return;
      }

      try {
        const [materialsRes, lessonsRes, syncRes] = await Promise.all([
          fetch("/api/materials"),
          fetch("/api/lessons"),
          fetch("/api/sync"),
        ]);

        if (!materialsRes.ok) {
          const data = await materialsRes.json().catch(() => ({}));
          throw new Error(data.error ?? materialsRes.statusText);
        }

        const materialsData = await materialsRes.json();
        const materialCourses = Array.isArray(materialsData.courses)
          ? (materialsData.courses as CourseWithMaterials[])
          : [];
        const matched = materialCourses.find((item) => item.canvas_id === courseCanvasId) ?? null;

        let lessonsData: RecentLesson[] = [];
        if (lessonsRes.ok) {
          const lessonsJson = await lessonsRes.json().catch(() => []);
          lessonsData = Array.isArray(lessonsJson) ? (lessonsJson as RecentLesson[]) : [];
        }

        let syncData: { courses?: CanvasCourse[]; assignments?: CanvasAssignment[] } = {};
        if (syncRes.ok) {
          const syncJson = await syncRes.json().catch(() => ({}));
          syncData = syncJson as typeof syncData;
        }

        const filteredLessons = lessonsData
          .filter((lesson) => lesson.course_id_canvas === courseCanvasId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const assignments = (Array.isArray(syncData.assignments) ? syncData.assignments : [])
          .filter((assignment) => assignment.course_id === courseCanvasId)
          .sort((a, b) => {
            const at = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
            const bt = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
            return at - bt;
          });

        const matchedCourseInfo =
          (Array.isArray(syncData.courses) ? syncData.courses : []).find(
            (syncCourse) => syncCourse.id === courseCanvasId
          ) ?? null;

        if (!cancelled) {
          setCourse(matched);
          setCourseInfo(matchedCourseInfo);
          setRelevantLessons(filteredLessons);
          setCourseAssignments(assignments);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseCanvasId]);

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

  function formatDate(value: string | null | undefined) {
    if (!value) return "No date";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No date";
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function lessonHref(lesson: RecentLesson) {
    const topicSlug = encodeURIComponent(lesson.topic.replace(/\s+/g, "-").slice(0, 80));
    return `/lesson/${lesson.course_id_canvas}/${topicSlug}?lessonId=${encodeURIComponent(lesson.id)}`;
  }

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
              Course content
            </h1>
          </div>
          {Number.isFinite(courseCanvasId) && (
            <a
              href={`/api/materials/download?course_canvas_id=${courseCanvasId}`}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--muted)]"
            >
              <Download className="h-4 w-4" />
              Download contents
            </a>
          )}
        </header>

        {(course || courseInfo) && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="text-lg font-semibold">{course?.name ?? courseInfo?.name}</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Canvas ID: {courseCanvasId}</p>
          </div>
        )}

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

        {!loading && !error && !course && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted-foreground)]">
            <p>Course content not found.</p>
            <p className="mt-2 text-sm">Sync and ingest this course first from the dashboard.</p>
          </div>
        )}

        {!loading && !error && (course || courseInfo) && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <p className="mb-2 text-sm font-medium">Relevant Lessons Taken</p>
                {relevantLessons.length === 0 ? (
                  <p className="text-xs text-[var(--muted-foreground)]">No lessons yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {relevantLessons.slice(0, 8).map((lesson) => (
                      <li key={lesson.id} className="text-sm">
                        <Link href={lessonHref(lesson)} className="hover:underline">
                          {lesson.topic}
                        </Link>
                        <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                          {lesson.status.replace("_", " ")} · {formatDate(lesson.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <p className="mb-2 text-sm font-medium">Assignments</p>
                {courseAssignments.length === 0 ? (
                  <p className="text-xs text-[var(--muted-foreground)]">No assignments found.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {courseAssignments.slice(0, 8).map((assignment) => (
                      <li key={`${assignment.course_id}-${assignment.id}`} className="text-sm">
                        {assignment.name}
                        <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                          Due: {formatDate(assignment.due_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
              <div className="border-b border-[var(--border)] px-4 py-3">
                <p className="text-sm text-[var(--muted-foreground)]">
                  Extracted files and pages used by StudyBuddy for this course.
                </p>
              </div>
              <ul>
                {!course || course.materials.length === 0 ? (
                  <li className="p-4 text-sm text-[var(--muted-foreground)]">
                    No materials extracted yet. Ingest this course from the dashboard.
                  </li>
                ) : (
                  course.materials.map((material) => (
                    <li key={material.canvas_item_id} className="border-b border-[var(--border)] p-3 last:border-b-0">
                      <div className="flex gap-3">
                        {iconForType(material.content_type)}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{material.metadata?.title ?? material.canvas_item_id}</p>
                          {(material.metadata?.url || material.metadata?.source) && (
                            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-[var(--muted-foreground)]">
                              {material.metadata?.source === "linked" && (
                                <span className="inline-flex items-center gap-0.5">
                                  <Link2 className="h-3 w-3" /> Linked
                                </span>
                              )}
                              {material.metadata?.url && (
                                <a
                                  href={material.metadata.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="truncate underline hover:no-underline"
                                >
                                  {material.metadata.url}
                                </a>
                              )}
                            </p>
                          )}
                          {material.metadata?.module_name && (
                            <p className="text-xs text-[var(--muted-foreground)]">Module: {material.metadata.module_name}</p>
                          )}
                          {material.preview && (
                            <p className="mt-1 line-clamp-2 text-xs text-[var(--muted-foreground)]">{material.preview}</p>
                          )}
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                            {material.chunk_count} chunk{material.chunk_count !== 1 ? "s" : ""} · {material.content_type}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {material.metadata?.url ? (
                              <a
                                href={material.metadata.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--muted)]"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Original Site
                              </a>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs opacity-50"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Original Site
                              </button>
                            )}

                            <a
                              href={`/api/materials/download-item?course_canvas_id=${encodeURIComponent(String(courseCanvasId))}&canvas_item_id=${encodeURIComponent(material.canvas_item_id)}`}
                              className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--muted)]"
                            >
                              <Download className="h-3.5 w-3.5" />
                              File Download
                            </a>

                            {material.metadata?.file_storage_path ? (
                              <a
                                href={`/api/materials/download-original?course_canvas_id=${encodeURIComponent(String(courseCanvasId))}&canvas_item_id=${encodeURIComponent(material.canvas_item_id)}`}
                                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--muted)]"
                              >
                                <Database className="h-3.5 w-3.5" />
                                Supabase Original File
                              </a>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs opacity-50"
                              >
                                <Database className="h-3.5 w-3.5" />
                                Supabase Original File
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
