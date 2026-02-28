"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ClipboardList,
  Loader2,
  RefreshCw,
  MessageCircle,
  ExternalLink,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type CanvasCourse = { id: number; name: string; course_code?: string };
type CanvasAssignment = {
  id: number;
  name: string;
  description?: string | null;
  due_at: string | null;
  course_id: number;
};

export default function SyncDashboardPage() {
  const [courses, setCourses] = useState<CanvasCourse[]>([]);
  const [assignments, setAssignments] = useState<CanvasAssignment[]>([]);
  const [loading, setLoading] = useState<"idle" | "courses" | "assignments" | "all">("idle");
  const [error, setError] = useState<string | null>(null);

  const loadCourses = async () => {
    setLoading("courses");
    setError(null);
    try {
      const res = await fetch("/api/canvas/courses");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch courses");
      setCourses(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setCourses([]);
    } finally {
      setLoading("idle");
    }
  };

  const loadAssignments = async () => {
    setLoading("assignments");
    setError(null);
    try {
      const res = await fetch("/api/canvas/assignments");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch assignments");
      setAssignments(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setAssignments([]);
    } finally {
      setLoading("idle");
    }
  };

  const syncAll = async () => {
    setLoading("all");
    setError(null);
    try {
      const [coursesRes, assignmentsRes] = await Promise.all([
        fetch("/api/canvas/courses"),
        fetch("/api/canvas/assignments"),
      ]);
      const [coursesData, assignmentsData] = await Promise.all([
        coursesRes.json(),
        assignmentsRes.json(),
      ]);
      if (!coursesRes.ok) throw new Error(coursesData.error || "Courses failed");
      if (!assignmentsRes.ok) throw new Error(assignmentsData.error || "Assignments failed");
      setCourses(Array.isArray(coursesData) ? coursesData : []);
      setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading("idle");
    }
  };

  const isLoading = loading !== "idle";
  const formatDate = (s: string | null) =>
    s ? new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "—";

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
          </div>
          <button
            onClick={syncAll}
            disabled={isLoading}
            className={cn(
              "flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50",
              isLoading && "cursor-not-allowed"
            )}
          >
            {loading === "all" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync all
          </button>
        </header>

        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <MessageCircle className="h-5 w-5 text-[var(--muted-foreground)]" />
              StudyBuddy – Avatar & Chatbot
            </h2>
            <Link
              href="/studybuddy"
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-700"
            >
              <ExternalLink className="h-4 w-4" />
              Open StudyBuddy
            </Link>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            Your tutor avatar, voice, and chatbot are saved in StudyBuddy. Open StudyBuddy and use &quot;Link to account&quot; on the content selection page to sync them to this account. Use &quot;Load from account&quot; to restore on another device.
          </p>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <BookOpen className="h-5 w-5 text-[var(--muted-foreground)]" />
              Courses
            </h2>
            <button
              onClick={loadCourses}
              disabled={isLoading}
              className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50"
            >
              {loading === "courses" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
            </button>
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
                    No courses. Click Sync all or Refresh to load.
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
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ClipboardList className="h-5 w-5 text-[var(--muted-foreground)]" />
              Assignments
            </h2>
            <button
              onClick={loadAssignments}
              disabled={isLoading}
              className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50"
            >
              {loading === "assignments" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
            </button>
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
                    No assignments. Click Sync all or Refresh to load.
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
