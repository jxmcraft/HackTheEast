"use client";

import { useState, useMemo } from "react";
import { Loader2, Search } from "lucide-react";
import { CourseCard, type CourseOption } from "./CourseCard";
import { cn } from "@/lib/utils";

export function CourseSelector({
  courses,
  onSelect,
  selectedCourseId,
  loading,
  error,
}: {
  courses: CourseOption[];
  onSelect: (course: CourseOption) => void;
  selectedCourseId: number | null;
  loading?: boolean;
  error?: string | null;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return courses;
    const q = query.toLowerCase();
    return courses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.course_code?.toLowerCase().includes(q))
    );
  }, [courses, query]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-12">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
        <p className="text-sm text-[var(--muted-foreground)]">Loading courses…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted-foreground)]">
        No courses found. Add your Canvas credentials in Settings and sync courses.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <input
          type="search"
          placeholder="Search courses…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            selected={selectedCourseId === course.id}
            onSelect={() => onSelect(course)}
          />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-center text-sm text-[var(--muted-foreground)]">No courses match your search.</p>
      )}
    </div>
  );
}
