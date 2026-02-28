"use client";

import { useRouter } from "next/navigation";
import { LessonWizard } from "./LessonWizard";

export function LessonRequest() {
  const router = useRouter();

  async function handleComplete(courseId: number, courseName: string, topic: string, context: string) {
    const res = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_id_canvas: courseId,
        course_name: courseName,
        topic,
        context: context || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to create lesson");
    }
    const data = await res.json().catch(() => ({}));
    const lessonId = data?.id ?? null;
    const topicSlug = encodeURIComponent(topic.replace(/\s+/g, "-").slice(0, 80));
    const search = new URLSearchParams();
    if (context) search.set("context", context);
    if (lessonId) search.set("lessonId", lessonId);
    router.push(`/lesson/${courseId}/${topicSlug}${search.toString() ? `?${search.toString()}` : ""}`);
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
      <h1 className="mb-6 text-xl font-bold">New Lesson</h1>
      <LessonWizard onComplete={handleComplete} />
    </div>
  );
}
