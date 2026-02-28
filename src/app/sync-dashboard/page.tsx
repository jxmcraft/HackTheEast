"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  RefreshCw,
  PlusCircle,
  Settings,
  Brain,
  XCircle,
  MessageCircle,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import { LessonRequest } from "@/components/lesson/LessonRequest";
import { RecommendedLessons } from "@/components/dashboard/RecommendedLessons";
import { cn } from "@/lib/utils";

type CanvasCourse = { id: number; name: string; course_code?: string };
type CanvasAssignment = {
  id: number;
  name: string;
  description?: string | null;
  due_at: string | null;
  course_id: number;
};
type CanvasCalendarEvent = {
  id: number | string;
  title: string;
  start_at: string;
  end_at: string;
  description?: string | null;
  context_code?: string;
  context_name?: string;
  all_day?: boolean;
  workflow_state?: string;
};

type CalendarItem = {
  id: string;
  kind: "event" | "assignment";
  title: string;
  startAt: string;
  allDay?: boolean;
  subtitle?: string;
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
  const [error, setError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarEvents, setCalendarEvents] = useState<CanvasCalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [expandedCourses, setExpandedCourses] = useState<Set<number>>(new Set());

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
      const text = await res.text();
      if (!res.ok) return;
      let data: { courses?: unknown[]; assignments?: unknown[] };
      try {
        data = JSON.parse(text) as typeof data;
      } catch {
        return;
      }
      setCourses(Array.isArray(data.courses) ? (data.courses as CanvasCourse[]) : []);
      setAssignments(Array.isArray(data.assignments) ? (data.assignments as CanvasAssignment[]) : []);
    } catch {
      setCourses([]);
      setAssignments([]);
    }
  }

  useEffect(() => {
    loadStoredSync();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCalendarEvents() {
      setCalendarLoading(true);
      setCalendarError(null);
      const year = calendarMonth.getFullYear();
      const month = calendarMonth.getMonth();
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      const startDate = start.toISOString().slice(0, 10);
      const endDate = end.toISOString().slice(0, 10);
      try {
        const res = await fetch(
          `/api/canvas/calendar?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`
        );
        const text = await res.text();
        let data: CanvasCalendarEvent[] | { error?: string } = [];
        try {
          data = JSON.parse(text) as typeof data;
        } catch {
          data = [];
        }
        if (!res.ok) {
          const err = (data as { error?: string })?.error ?? "Failed to load calendar";
          throw new Error(err);
        }
        if (!cancelled) {
          setCalendarEvents(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        if (!cancelled) {
          setCalendarEvents([]);
          setCalendarError(e instanceof Error ? e.message : "Failed to load calendar");
        }
      } finally {
        if (!cancelled) setCalendarLoading(false);
      }
    }

    loadCalendarEvents();
    return () => {
      cancelled = true;
    };
  }, [calendarMonth]);

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
      const text = await res.text();
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

      setCourses(Array.isArray(data.courses) ? (data.courses as CanvasCourse[]) : []);
      setAssignments(Array.isArray(data.assignments) ? (data.assignments as CanvasAssignment[]) : []);
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
  const toLocalDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  const monthLabel = calendarMonth.toLocaleString(undefined, { month: "long", year: "numeric" });
  const startOfWeek = (date: Date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const endOfWeek = (date: Date) => {
    const d = new Date(date);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  };

  const today = new Date();
  const referenceWeekDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - weekOffset * 7);
  const weekStart = startOfWeek(referenceWeekDate);
  const weekEnd = endOfWeek(weekStart);

  const completedLessons = recentLessons.filter((lesson) => lesson.status === "completed");
  const completedThisWeek = completedLessons.filter((lesson) => {
    const created = new Date(lesson.created_at);
    return created >= weekStart && created <= weekEnd;
  }).length;
  const completedLessonsThisWeek = completedLessons
    .filter((lesson) => {
      const created = new Date(lesson.created_at);
      return created >= weekStart && created <= weekEnd;
    })
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const completedDaySet = new Set(completedLessons.map((lesson) => toLocalDateKey(new Date(lesson.created_at))));
  let streak = 0;
  const streakCursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  while (completedDaySet.has(toLocalDateKey(streakCursor))) {
    streak += 1;
    streakCursor.setDate(streakCursor.getDate() - 1);
  }
  const weekRangeLabel = `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  const weekDayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekDayStats = weekDayLabels.map((label, index) => {
    const dayStart = new Date(weekStart);
    dayStart.setDate(weekStart.getDate() + index);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const count = completedLessons.filter((lesson) => {
      const created = new Date(lesson.created_at);
      return created >= dayStart && created <= dayEnd;
    }).length;
    return { label, count, dateLabel: dayStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }) };
  });
  const weekDayLessons = weekDayLabels.map((label, index) => {
    const dayStart = new Date(weekStart);
    dayStart.setDate(weekStart.getDate() + index);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const lessons = completedLessons
      .filter((lesson) => {
        const created = new Date(lesson.created_at);
        return created >= dayStart && created <= dayEnd;
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return {
      label,
      dateLabel: dayStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      lessons,
    };
  });
  const weekMax = Math.max(1, ...weekDayStats.map((d) => d.count));

  const daysInMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    0
  ).getDate();
  const firstWeekday = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth(),
    1
  ).getDay();
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const assignmentItems: CalendarItem[] = assignments
    .filter((assignment) => assignment.due_at)
    .map((assignment) => {
      const courseName = courses.find((course) => course.id === assignment.course_id)?.name;
      return {
        id: `assignment-${assignment.course_id}-${assignment.id}`,
        kind: "assignment",
        title: assignment.name,
        startAt: assignment.due_at as string,
        allDay: false,
        subtitle: courseName ?? `Course ${assignment.course_id}`,
      };
    });

  const eventItems: CalendarItem[] = calendarEvents.map((event) => ({
    id: `event-${event.id}`,
    kind: "event",
    title: event.title,
    startAt: event.start_at,
    allDay: event.all_day,
    subtitle: event.context_name ?? event.context_code,
  }));

  const mergedItems = [...eventItems, ...assignmentItems];

  const eventMap = mergedItems.reduce<Record<string, CalendarItem[]>>((acc, item) => {
    const dateKey = toLocalDateKey(new Date(item.startAt));
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {});

  const sortedEventMap = Object.fromEntries(
    Object.entries(eventMap).map(([dateKey, items]) => [
      dateKey,
      items.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    ])
  ) as Record<string, CalendarItem[]>;

  const calendarCells: Array<{ date: Date; inMonth: boolean }> = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    const d = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1 - (firstWeekday - i));
    calendarCells.push({ date: d, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    calendarCells.push({ date: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day), inMonth: true });
  }
  while (calendarCells.length % 7 !== 0) {
    const last = calendarCells[calendarCells.length - 1].date;
    const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    calendarCells.push({ date: next, inMonth: false });
  }

  function lessonHref(l: RecentLesson) {
    const topicSlug = encodeURIComponent(l.topic.replace(/\s+/g, "-").slice(0, 80));
    return `/lesson/${l.course_id_canvas}/${topicSlug}?lessonId=${encodeURIComponent(l.id)}`;
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
            <h1 className="text-2xl font-bold">Home Dashboard</h1>
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
            <Link
              href="/progress"
              className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted)]"
              aria-label="Learning progress"
            >
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Progress</span>
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

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 md:p-8">
            <h2 className="mb-2 text-xl font-semibold">What would you like to learn today?</h2>
            <p className="mb-5 text-sm text-[var(--muted-foreground)]">
              Start a new lesson to study a topic from your synced courses.
            </p>
            <button
              onClick={() => setShowNewLesson(true)}
              className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
            >
              <PlusCircle className="h-4 w-4" />
              New Lesson
            </button>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 md:p-8">
            <h2 className="mb-2 flex items-center gap-2 text-xl font-semibold">
              <MessageCircle className="h-5 w-5 text-[var(--muted-foreground)]" />
              StudyBuddy
            </h2>
            <p className="mb-5 text-sm text-[var(--muted-foreground)]">
              Open your avatar tutor and chatbot to review topics and practice.
            </p>
            <Link
              href="/studybuddy"
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-700"
            >
              <ExternalLink className="h-4 w-4" />
              Open StudyBuddy
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-6">
          <RecommendedLessons />
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Weekly Stats</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWeekOffset((prev) => prev + 1)}
                className="rounded-lg border border-[var(--border)] p-2 hover:bg-[var(--muted)]"
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="min-w-[140px] text-center text-sm text-[var(--muted-foreground)]">{weekRangeLabel}</p>
              <button
                type="button"
                onClick={() => setWeekOffset((prev) => Math.max(0, prev - 1))}
                className="rounded-lg border border-[var(--border)] p-2 hover:bg-[var(--muted)] disabled:opacity-50"
                aria-label="Next week"
                disabled={weekOffset === 0}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-4">
              <p className="text-sm text-[var(--muted-foreground)]">Lessons finished this week</p>
              <p className="mt-1 text-3xl font-bold">{completedThisWeek}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-4">
              <p className="text-sm text-[var(--muted-foreground)]">Current streak (days)</p>
              <p className="mt-1 text-3xl font-bold">{streak}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--muted)]/10 p-4">
            <p className="mb-3 text-sm font-medium">Completed Lessons by Day</p>
            <div className="grid grid-cols-7 gap-2">
              {weekDayStats.map((day) => (
                <div key={`${day.label}-${day.dateLabel}`} className="flex flex-col items-center gap-2">
                  <div className="flex h-24 w-full items-end justify-center rounded bg-[var(--muted)]/30 px-1">
                    <div
                      className="w-full rounded-t bg-purple-500/70"
                      style={{ height: `${(day.count / weekMax) * 100}%`, minHeight: day.count > 0 ? 6 : 0 }}
                      title={`${day.label} (${day.dateLabel}): ${day.count}`}
                    />
                  </div>
                  <p className="text-[10px] text-[var(--muted-foreground)]">{day.label}</p>
                  <p className="text-xs font-medium">{day.count}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--muted)]/10 p-4">
            <p className="mb-2 text-sm font-medium">Lessons Completed This Week</p>
            <div className="grid grid-cols-7 gap-3">
              {weekDayLessons.map((day) => (
                <div key={`${day.label}-${day.dateLabel}`} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                  <p className="text-xs font-semibold text-[var(--muted-foreground)]">{day.label}</p>
                  <p className="mb-2 text-sm font-medium">{day.dateLabel}</p>
                  {day.lessons.length === 0 ? (
                    <p className="text-xs text-[var(--muted-foreground)]">No lessons completed.</p>
                  ) : (
                    <ul className="space-y-1">
                      {day.lessons.map((lesson) => (
                        <li key={lesson.id} className="text-sm">
                          <Link href={lessonHref(lesson)} className="hover:underline">
                            {lesson.topic}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            {completedLessonsThisWeek.length === 0 && (
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">No completed lessons in this week.</p>
            )}
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarDays className="h-5 w-5 text-[var(--muted-foreground)]" />
              Calendar
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  )
                }
                className="rounded-lg border border-[var(--border)] p-2 hover:bg-[var(--muted)]"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="min-w-[160px] text-center text-sm font-medium">{monthLabel}</p>
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                  )
                }
                className="rounded-lg border border-[var(--border)] p-2 hover:bg-[var(--muted)]"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {calendarLoading && (
            <div className="mb-3 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading calendar events...
            </div>
          )}
          {calendarError && (
            <div className="mb-3 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {calendarError}
            </div>
          )}

          <div className="grid grid-cols-7 gap-2 text-xs font-medium text-[var(--muted-foreground)]">
            {weekdayLabels.map((label) => (
              <div key={label} className="px-2 py-1">
                {label}
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {calendarCells.map(({ date, inMonth }, index) => {
              const key = toLocalDateKey(date);
              const dayEvents = sortedEventMap[key] ?? [];
              return (
                <div
                  key={`${key}-${index}`}
                  className={cn(
                    "min-h-[120px] rounded-lg border border-[var(--border)] p-2",
                    inMonth ? "bg-[var(--card)]" : "bg-[var(--muted)]/20 text-[var(--muted-foreground)]"
                  )}
                >
                  <div className="mb-1 text-xs font-semibold">{date.getDate()}</div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className={cn(
                          "rounded px-1.5 py-1 text-[10px] leading-tight",
                          event.kind === "assignment"
                            ? "bg-purple-500/15 border border-purple-500/30"
                            : "bg-[var(--muted)]"
                        )}
                      >
                        <p className="truncate font-medium">{event.title}</p>
                        {event.subtitle && (
                          <p className="truncate text-[var(--muted-foreground)]">{event.subtitle}</p>
                        )}
                        <p className="truncate text-[var(--muted-foreground)]">
                          {event.allDay
                            ? "All day"
                            : new Date(event.startAt).toLocaleTimeString(undefined, {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                        </p>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-[10px] text-[var(--muted-foreground)]">+{dayEvents.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <BookOpen className="h-5 w-5 text-[var(--muted-foreground)]" />
              Courses
            </h2>
          </div>

          {courses.length === 0 && !loading ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              No courses yet. Click Sync to load your courses from Canvas.
            </p>
          ) : (
            <div className="space-y-4">
              {courses.map((course) => {
                const isExpanded = expandedCourses.has(course.id);
                const lessons = recentLessons
                  .filter((lesson) => lesson.course_id_canvas === course.id)
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                const courseAssignments = assignments
                  .filter((assignment) => assignment.course_id === course.id)
                  .sort((a, b) => {
                    const at = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
                    const bt = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
                    return at - bt;
                  });

                return (
                  <div key={course.id} className="rounded-xl border border-[var(--border)] p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{course.name}</h3>
                        <p className="text-xs text-[var(--muted-foreground)]">Canvas ID: {course.id} {course.course_code ? `· ${course.course_code}` : ""}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCourses((prev) => {
                            const next = new Set(prev);
                            if (next.has(course.id)) next.delete(course.id);
                            else next.add(course.id);
                            return next;
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--muted)]"
                      >
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {isExpanded ? "Collapse" : "Expand"}
                      </button>
                    </div>

                    {isExpanded && (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/10 p-3">
                        <p className="mb-2 text-sm font-medium">Relevant Lessons Taken</p>
                        {lessons.length === 0 ? (
                          <p className="text-xs text-[var(--muted-foreground)]">No lessons yet.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {lessons.slice(0, 5).map((lesson) => (
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

                      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/10 p-3">
                        <p className="mb-2 text-sm font-medium">Assignments</p>
                        {courseAssignments.length === 0 ? (
                          <p className="text-xs text-[var(--muted-foreground)]">No assignments found.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {courseAssignments.slice(0, 5).map((assignment) => (
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
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
