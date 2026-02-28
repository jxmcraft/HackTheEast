"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  ClipboardList,
  Loader2,
  RefreshCw,
  PlusCircle,
  Settings,
  Brain,
  XCircle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LessonRequest } from "@/components/lesson/LessonRequest";
import { cn } from "@/lib/utils";

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

export default function SyncDashboardPage() {
  const [courses, setCourses] = useState<CanvasCourse[]>([]);
  const [assignments, setAssignments] = useState<CanvasAssignment[]>([]);
  const [recentLessons, setRecentLessons] = useState<RecentLesson[]>([]);
  const [showNewLesson, setShowNewLesson] = useState(false);
  const [loading, setLoading] = useState<"idle" | "syncing">("idle");
  const [syncProgress, setSyncProgress] = useState<{
    phase: string;
    courseIndex: number;
    courseTotal: number;
    materialsStored?: number;
    chunksCreated?: number;
    currentCourseMaterials?: number;
    currentCourseChunks?: number;
    message?: string;
  } | null>(null);
  const [retryingLessonId, setRetryingLessonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  async function loadProfile() {
    try {
      const res = await fetch("/api/profile");
      const text = await res.text();
      if (!res.ok) return;
      try {
        const data = JSON.parse(text);
        setLastSyncAt(data.last_canvas_sync_at ?? null);
      } catch {
        setLastSyncAt(null);
      }
    } catch {
      setLastSyncAt(null);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadRecentLessons() {
    try {
      const res = await fetch("/api/lessons");
      const text = await res.text();
      if (!res.ok) return;
      try {
        const data = JSON.parse(text);
        setRecentLessons(Array.isArray(data) ? data : []);
      } catch {
        setRecentLessons([]);
      }
    } catch {
      setRecentLessons([]);
    }
  }

  useEffect(() => {
    loadRecentLessons();
  }, []);

  async function loadStoredSync() {
    try {
      const res = await fetch("/api/sync");
      const contentType = res.headers.get("content-type") ?? "";
      const text = await res.text();
      // #region agent log
      fetch('http://127.0.0.1:7816/ingest/dcfe79ee-b938-4a53-8e78-211d2e2b322f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1f53d4'},body:JSON.stringify({sessionId:'1f53d4',hypothesisId:'H2',location:'sync-dashboard:loadStoredSync',message:'GET /api/sync response',data:{status:res.status,contentType,bodyPreview:text.slice(0,120),isHtml:text.trimStart().startsWith('<')},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (!res.ok) return;
      let data: { courses?: unknown[]; assignments?: unknown[] };
      try {
        data = JSON.parse(text) as typeof data;
      } catch {
        return;
      }
      setCourses(Array.isArray(data.courses) ? data.courses : []);
      setAssignments(Array.isArray(data.assignments) ? data.assignments : []);
    } catch {
      setCourses([]);
      setAssignments([]);
    }
  }

  useEffect(() => {
    loadStoredSync();
  }, []);

  /** Poll sync status and update UI; call again if still running. Used after starting sync or when reconnecting after reload. */
  function pollSyncStatus() {
    fetch("/api/sync/status")
      .then((statusRes) => statusRes.text())
      .then((statusText) => {
        let statusData: {
          status?: string;
          phase?: string;
          courseIndex?: number;
          courseTotal?: number;
          materialsStored?: number;
          chunksCreated?: number;
          currentCourseMaterials?: number;
          currentCourseChunks?: number;
          message?: string;
          error?: string;
        };
        try {
          statusData = JSON.parse(statusText) as typeof statusData;
        } catch {
          statusData = {};
        }
        if (statusData.status === "running") {
          setSyncProgress({
            phase: statusData.phase ?? "ingest",
            courseIndex: statusData.courseIndex ?? 0,
            courseTotal: statusData.courseTotal ?? 0,
            materialsStored: statusData.materialsStored,
            chunksCreated: statusData.chunksCreated,
            currentCourseMaterials: statusData.currentCourseMaterials,
            currentCourseChunks: statusData.currentCourseChunks,
            message: statusData.message,
          });
          setLoading("syncing");
          setTimeout(pollSyncStatus, 1500);
          return;
        }
        if (statusData.status === "completed") {
          setSyncProgress(null);
          setLoading("idle");
          loadStoredSync();
          loadProfile();
          return;
        }
        if (statusData.status === "failed") {
          setError(statusData.error ?? "Sync failed");
          setSyncProgress(null);
          setLoading("idle");
          return;
        }
        setSyncProgress(null);
        setLoading("idle");
        loadStoredSync();
        loadProfile();
      })
      .catch(() => {
        setSyncProgress(null);
        setLoading("idle");
        loadStoredSync();
        loadProfile();
      });
  }

  /** On load: if a sync is already in progress, show progress and resume polling. */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/sync/status")
      .then((res) => (res.ok ? res.text() : null))
      .then((text) => {
        if (cancelled || !text) return;
        let data: { status?: string; phase?: string; courseIndex?: number; courseTotal?: number; materialsStored?: number; chunksCreated?: number; currentCourseMaterials?: number; currentCourseChunks?: number; message?: string };
        try {
          data = JSON.parse(text) as typeof data;
        } catch {
          return;
        }
        if (data.status === "running") {
          setLoading("syncing");
          setSyncProgress({
            phase: data.phase ?? "ingest",
            courseIndex: data.courseIndex ?? 0,
            courseTotal: data.courseTotal ?? 0,
            materialsStored: data.materialsStored,
            chunksCreated: data.chunksCreated,
            currentCourseMaterials: data.currentCourseMaterials,
            currentCourseChunks: data.currentCourseChunks,
            message: data.message,
          });
          setTimeout(pollSyncStatus, 500);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const syncAll = async () => {
    setLoading("syncing");
    setError(null);
    setSyncProgress(null);
    let willPoll = false;
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const contentType = res.headers.get("content-type") ?? "";
      const text = await res.text();
      // #region agent log
      fetch('http://127.0.0.1:7816/ingest/dcfe79ee-b938-4a53-8e78-211d2e2b322f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1f53d4'},body:JSON.stringify({sessionId:'1f53d4',hypothesisId:'H1',location:'sync-dashboard:syncAll',message:'POST /api/sync response',data:{status:res.status,contentType,bodyPreview:text.slice(0,120),isHtml:text.trimStart().startsWith('<')},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      let data: { courses?: unknown[]; assignments?: unknown[]; error?: string; jobId?: string };
      try {
        data = JSON.parse(text) as typeof data;
      } catch (parseErr) {
        const isHtml = text.trimStart().toLowerCase().startsWith("<!doctype") || text.trimStart().startsWith("<");
        throw new Error(isHtml ? "Server error during sync. Try again or check the server logs." : (parseErr instanceof Error ? parseErr.message : "Invalid response"));
      }
      if (!res.ok) throw new Error(data.error || "Sync failed");

      if (res.status === 202 && data.jobId) {
        willPoll = true;
        setSyncProgress({ phase: "starting", courseIndex: 0, courseTotal: 0, message: "Starting sync." });
        setTimeout(pollSyncStatus, 500);
        return;
      }

      setCourses(Array.isArray(data.courses) ? data.courses : []);
      setAssignments(Array.isArray(data.assignments) ? data.assignments : []);
      setLastSyncAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      if (!willPoll) setLoading("idle");
    }
  };

  const isLoading = loading !== "idle";
  const formatLastSync = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : null;
  const formatDate = (s: string | null) =>
    s ? new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "—";

  function lessonHref(l: RecentLesson) {
    const topicSlug = encodeURIComponent(l.topic.replace(/\s+/g, "-").slice(0, 80));
    return `/lesson/${l.course_id_canvas}/${topicSlug}?lessonId=${encodeURIComponent(l.id)}`;
  }

  async function handleRetry(l: RecentLesson, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setRetryingLessonId(l.id);
    setError(null);
    try {
      const res = await fetch("/api/generate-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: l.id }),
      });
      const text = await res.text();
      let data: { error?: string };
      try {
        data = JSON.parse(text) as { error?: string };
      } catch {
        data = {};
      }
      if (!res.ok) throw new Error(data.error ?? "Regenerate failed");
      window.location.href = lessonHref(l);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetryingLessonId(null);
    }
  }

  if (showNewLesson) {
    return (
      <main className="min-h-screen p-6 md:p-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowNewLesson(false)}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              ← Back to dashboard
            </button>
          </div>
          <LessonRequest />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              ← Home
            </Link>
            <h1 className="text-2xl font-bold">Sync Dashboard</h1>
            <Link
              href="/settings"
              className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted)]"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <Link
              href="/memory"
              className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted)]"
              aria-label="Agent memory"
            >
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">Memory</span>
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowNewLesson(true)}
              className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
            >
              <PlusCircle className="h-4 w-4" />
              New Lesson
            </button>
            <button
              onClick={syncAll}
              disabled={isLoading}
              className={cn(
                "flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50",
                isLoading && "cursor-not-allowed"
              )}
            >
              {loading === "syncing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync
            </button>
            {formatLastSync(lastSyncAt) && (
              <span className="text-sm text-[var(--muted-foreground)]">
                Last sync: {formatLastSync(lastSyncAt)}
              </span>
            )}
          </div>
        </header>

        {(loading === "syncing" || syncProgress) && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[var(--muted-foreground)]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {syncProgress?.message ?? "Syncing."}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--muted-foreground)]">
                  {syncProgress && syncProgress.courseTotal > 0 && (
                    <span>Course {syncProgress.courseIndex + 1} of {syncProgress.courseTotal}</span>
                  )}
                  {((syncProgress?.currentCourseMaterials ?? 0) > 0 || (syncProgress?.currentCourseChunks ?? 0) > 0) && (
                    <span>
                      This course: {(syncProgress?.currentCourseMaterials ?? 0)} materials, {(syncProgress?.currentCourseChunks ?? 0)} chunks.
                    </span>
                  )}
                  {((syncProgress?.materialsStored ?? 0) > 0 || (syncProgress?.chunksCreated ?? 0) > 0) && (
                    <span>
                      Total: {(syncProgress?.materialsStored ?? 0)} materials, {(syncProgress?.chunksCreated ?? 0)} chunks.
                    </span>
                  )}
                  {(!syncProgress || syncProgress.courseTotal === 0) && (syncProgress?.materialsStored ?? 0) === 0 && (syncProgress?.chunksCreated ?? 0) === 0 && (
                    <span>Fetching courses and ingesting materials.</span>
                  )}
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
                  {syncProgress && syncProgress.courseTotal > 0 ? (
                    <div
                      className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
                      style={{
                        width: `${100 * (syncProgress.courseIndex + 0.5) / syncProgress.courseTotal}%`,
                      }}
                    />
                  ) : (
                    <div className="h-full w-1/3 min-w-[80px] rounded-full bg-[var(--primary)] animate-pulse" />
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await fetch("/api/sync/cancel", { method: "POST" });
                    setSyncProgress(null);
                    setLoading("idle");
                    await loadStoredSync();
                    await loadProfile();
                  } catch {
                    setSyncProgress(null);
                    setLoading("idle");
                  }
                }}
                className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted)] flex items-center gap-1"
                aria-label="Cancel sync"
              >
                <XCircle className="h-4 w-4" />
                Cancel
              </button>
            </div>
          </div>
        )}

        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="mb-2 text-lg font-semibold">What would you like to learn today?</h2>
          <p className="mb-4 text-sm text-[var(--muted-foreground)]">
            Start a new lesson to study a topic from your synced courses.
          </p>
          <button
            onClick={() => setShowNewLesson(true)}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
          >
            <PlusCircle className="h-4 w-4" />
            New Lesson
          </button>
        </section>

        {recentLessons.length > 0 && (
          <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-6">
            <h2 className="mb-4 text-lg font-semibold">Recent lessons</h2>
            <ul className="space-y-2">
              {recentLessons.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-3">
                  <Link
                    href={lessonHref(l)}
                    className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 rounded-lg hover:bg-[var(--muted)]/30 focus:bg-[var(--muted)]/30"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{l.topic}</p>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {l.course_name ?? `Course ${l.course_id_canvas}`} · {formatDate(l.created_at)}
                      </p>
                    </div>
                    <span className={cn(
                      "rounded px-2 py-0.5 text-xs capitalize",
                      l.status === "completed" && "bg-emerald-500/20 text-emerald-400",
                      l.status === "in_progress" && "bg-amber-500/20 text-amber-400",
                      l.status === "pending" && "bg-[var(--muted)]"
                    )}>
                      {l.status.replace("_", " ")}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => handleRetry(l, e)}
                    disabled={retryingLessonId !== null}
                    className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted)] disabled:opacity-50 flex items-center gap-1"
                  >
                    {retryingLessonId === l.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Retry
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-6">
          <div className="mb-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <BookOpen className="h-5 w-5 text-[var(--muted-foreground)]" />
              Courses
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canvas ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-[var(--muted-foreground)]">
                    No courses yet. Click Sync to load your courses from Canvas.
                  </TableCell>
                </TableRow>
              )}
              {courses.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-[var(--muted-foreground)]">{c.id}</TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.course_code ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-6">
          <div className="mb-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ClipboardList className="h-5 w-5 text-[var(--muted-foreground)]" />
              Assignments
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Course ID</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead className="max-w-[200px]">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-[var(--muted-foreground)]">
                    No assignments yet. Click Sync to load assignments from Canvas.
                  </TableCell>
                </TableRow>
              )}
              {assignments.map((a) => (
                <TableRow key={`${a.course_id}-${a.id}`}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="font-mono text-[var(--muted-foreground)]">
                    {a.course_id}
                  </TableCell>
                  <TableCell>{formatDate(a.due_at)}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-[var(--muted-foreground)]">
                    {a.description
                      ? a.description.replace(/<[^>]+>/g, "").slice(0, 80) + (a.description.length > 80 ? "…" : "")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>
    </main>
  );
}
