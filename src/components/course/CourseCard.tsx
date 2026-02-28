"use client";

import { cn } from "@/lib/utils";

export type CourseOption = {
  id: number;
  name: string;
  course_code?: string;
  start_at?: string | null;
  end_at?: string | null;
};

export function CourseCard({
  course,
  selected,
  onSelect,
  disabled,
}: {
  course: CourseOption;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const term = course.start_at
    ? new Date(course.start_at).toLocaleDateString(undefined, { year: "numeric", month: "short" })
    : "—";

  return (
    <div
      className={cn(
        "rounded-xl border-2 p-4 transition",
        selected
          ? "border-[var(--ring)] bg-[var(--muted)]"
          : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--muted-foreground)]"
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="font-medium leading-tight">{course.name}</h3>
        <span className="text-xs text-[var(--muted-foreground)] shrink-0">Term: {term}</span>
      </div>
      {course.course_code && (
        <p className="mb-3 text-sm text-[var(--muted-foreground)]">{course.course_code}</p>
      )}
      <p className="mb-3 text-xs text-[var(--muted-foreground)]">Module count: —</p>
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className={cn(
          "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium hover:bg-[var(--muted)] disabled:opacity-50",
          selected && "ring-2 ring-[var(--ring)]"
        )}
      >
        {selected ? "Selected" : "Select"}
      </button>
    </div>
  );
}
