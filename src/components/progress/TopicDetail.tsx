"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";

type TopicDetailProps = {
  courseId: string;
  topic: string;
  status: string;
  lessonIds?: string[];
};

const statusLabel: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  struggling: "Struggling",
  mastered: "Mastered",
};

export function TopicDetail({ courseId, topic, status, lessonIds = [] }: TopicDetailProps) {
  const topicSlug = encodeURIComponent(topic.replace(/\s+/g, "-").slice(0, 80));
  const lessonHref = `/lesson/${courseId}/${topicSlug}`;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{topic}</h3>
        <span className="rounded bg-[var(--muted)] px-2 py-0.5 text-xs">
          {statusLabel[status] ?? status}
        </span>
      </div>
      <p className="mb-3 text-sm text-[var(--muted-foreground)]">
        Course {courseId}. Open a lesson to see chat history and practice with the tutor.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href={lessonHref}
          className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-neutral-200"
        >
          <BookOpen className="h-4 w-4" />
          {lessonIds.length > 0 ? "Open lesson" : "Start lesson"}
        </Link>
      </div>
      {lessonIds.length > 0 && (
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          {lessonIds.length} lesson{lessonIds.length !== 1 ? "s" : ""} on this topic
        </p>
      )}
    </div>
  );
}
