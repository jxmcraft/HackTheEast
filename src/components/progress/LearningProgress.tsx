"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  BookOpen,
  Trophy,
  Flame,
  AlertCircle,
  Calendar,
  ChevronRight,
  Brain,
  Loader2,
} from "lucide-react";

type ProgressTopic = {
  topic: string;
  status: string;
  interactions_count: number;
  last_activity: string;
};

type CourseProgress = {
  courseId: string;
  topics: ProgressTopic[];
  mastered: number;
  inProgress: number;
  struggling: number;
  notStarted: number;
};

type Session = {
  id: string;
  courseId: string | null;
  topic: string | null;
  startedAt: string;
  endedAt: string | null;
  lessonsGenerated: number;
  questionsAsked: number;
  rating: number | null;
};

type ProgressResponse = {
  overall: {
    totalStudyMinutes: number;
    lessonsCompleted: number;
    topicsMastered: number;
    topicsStruggling: number;
    currentStreakDays: number;
  };
  progressByCourse: CourseProgress[];
  recentSessions: Session[];
  memorySummary: { total: number; byType: Record<string, number> };
};

const statusLabel: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  struggling: "Struggling",
  mastered: "Mastered",
};

const statusColor: Record<string, string> = {
  not_started: "bg-[var(--muted)]",
  in_progress: "bg-blue-500/70",
  struggling: "bg-amber-500/70",
  mastered: "bg-emerald-500/70",
};

export function LearningProgress() {
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/progress")
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { overall, progressByCourse, recentSessions, memorySummary } = data;
  const formatTime = (mins: number) =>
    mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60} min`;
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-6">
        <h2 className="mb-4 text-lg font-semibold">Overall stats</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-4">
            <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Study time</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{formatTime(overall.totalStudyMinutes)}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-4">
            <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
              <BookOpen className="h-4 w-4" />
              <span className="text-sm">Lessons done</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{overall.lessonsCompleted}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-4">
            <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
              <Trophy className="h-4 w-4" />
              <span className="text-sm">Topics mastered</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{overall.topicsMastered}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-4">
            <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
              <Flame className="h-4 w-4" />
              <span className="text-sm">Streak (days)</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{overall.currentStreakDays}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-4">
            <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
              <Brain className="h-4 w-4" />
              <span className="text-sm">Memories</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{memorySummary.total}</p>
          </div>
        </div>
        {overall.topicsStruggling > 0 && (
          <p className="mt-3 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-4 w-4" />
            {overall.topicsStruggling} topic{overall.topicsStruggling !== 1 ? "s" : ""} marked struggling — consider reviewing.
          </p>
        )}
      </section>

      {progressByCourse.length > 0 && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-6">
          <h2 className="mb-4 text-lg font-semibold">Course progress</h2>
          <div className="space-y-4">
            {progressByCourse.map((course) => {
              const total =
                course.mastered + course.inProgress + course.struggling + course.notStarted;
              const done = course.mastered + course.inProgress + course.struggling;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <div
                  key={course.courseId}
                  className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/10 p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">Course {course.courseId}</span>
                    <span className="text-sm text-[var(--muted-foreground)]">
                      {course.mastered} mastered · {course.inProgress} in progress
                      {course.struggling > 0 ? ` · ${course.struggling} struggling` : ""}
                    </span>
                  </div>
                  <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]">
                    <div
                      className="h-full rounded-full bg-purple-500/70 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <ul className="mt-2 space-y-1">
                    {course.topics.slice(0, 5).map((t) => (
                      <li
                        key={`${course.courseId}-${t.topic}`}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span
                          className={`inline-block h-2 w-2 shrink-0 rounded-full ${statusColor[t.status] ?? statusColor.not_started}`}
                          title={statusLabel[t.status] ?? t.status}
                        />
                        <span className="truncate">{t.topic}</span>
                        <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
                          {statusLabel[t.status] ?? t.status}
                        </span>
                      </li>
                    ))}
                    {course.topics.length > 5 && (
                      <li className="text-xs text-[var(--muted-foreground)]">
                        +{course.topics.length - 5} more topics
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Calendar className="h-5 w-5 text-[var(--muted-foreground)]" />
          Recent activity
        </h2>
        {recentSessions.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            No study sessions yet. Complete a lesson to see activity here.
          </p>
        ) : (
          <ul className="space-y-3">
            {recentSessions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/10 px-3 py-2"
              >
                <div>
                  <p className="font-medium">
                    {s.topic || "General"} {s.courseId && `· Course ${s.courseId}`}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {formatDate(s.startedAt)}
                    {s.lessonsGenerated > 0 && ` · ${s.lessonsGenerated} lesson(s)`}
                    {s.questionsAsked > 0 && ` · ${s.questionsAsked} question(s)`}
                    {s.rating != null && ` · ${s.rating}/5`}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
