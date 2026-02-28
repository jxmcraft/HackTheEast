"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { LessonContent } from "@/components/lesson/LessonContent";
import { TutorAvatar } from "@/components/avatar/TutorAvatar";
import { StudyChat } from "@/components/chat/StudyChat";
import { LessonQuizModal } from "@/components/lesson/LessonQuizModal";
import { getContextualGreeting } from "@/lib/avatar/personality";
import type { AvatarStyle } from "@/lib/avatar/personality";

type LessonPageClientProps = {
  courseId: string;
  topic: string;
  context: string;
  courseName: string | null;
  lessonIdFromUrl: string | null;
  avatarName: string;
  avatarStyle: AvatarStyle;
};

export function LessonPageClient({
  courseId,
  topic,
  context,
  courseName,
  lessonIdFromUrl,
  avatarName,
  avatarStyle,
}: LessonPageClientProps) {
  const [lessonId, setLessonId] = useState<string | null>(lessonIdFromUrl);
  const [contentSummary, setContentSummary] = useState("");
  const [chatThinking, setChatThinking] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(() =>
    getContextualGreeting({ topic, style: avatarStyle })
  );
  const [bookmarked, setBookmarked] = useState(false);
  const [progress, setProgress] = useState<"understood" | "need_review" | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);

  const onLessonReady = useCallback((id: string, summary: string) => {
    setLessonId(id);
    setContentSummary(summary);
  }, []);

  const onMessageSent = useCallback(() => {
    setChatThinking(true);
    setAvatarMessage(null);
  }, []);

  const onResponseReceived = useCallback((msg: string) => {
    setChatThinking(false);
    setAvatarMessage(msg || "Here's my response.");
  }, []);

  const suggestedQuestions = [
    `What is the main idea of ${topic}?`,
    "Can you explain that with an example?",
    "What should I remember for the exam?",
  ];

  const saveBookmark = async () => {
    if (!lessonId) return;
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, type: "bookmark", content: topic }),
      });
      const data = await res.json();
      if (data.success) setBookmarked(true);
    } catch {
      // ignore
    }
  };

  const setProgressMark = async (value: "understood" | "need_review") => {
    try {
      await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          type: "note",
          content: value,
          meta: { progress: value },
        }),
      });
      setProgress(value);
    } catch {
      // ignore
    }
  };

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Link href="/sync-dashboard" className="hover:text-[var(--foreground)]">Dashboard</Link>
          <span>/</span>
          <span>{courseName ?? `Course ${courseId}`}</span>
          <span>/</span>
          <span className="text-[var(--foreground)]">{topic}</span>
          <span className="ml-auto">
            <Link
              href={`/studybuddy?fromLesson=1&topic=${encodeURIComponent(topic)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--muted)]"
            >
              <BookOpen className="h-4 w-4" />
              Practice in StudyBuddy
            </Link>
          </span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <section className="min-h-[400px] rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <h1 className="mb-2 text-xl font-bold">{topic}</h1>
            <p className="mb-4 text-sm text-[var(--muted-foreground)]">
              {courseName ? `Course: ${courseName}` : `Course ID: ${courseId}`}
            </p>
            {context && (
              <p className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3 text-sm">
                <span className="font-medium">Context:</span> {context}
              </p>
            )}
            <LessonContent
              courseId={courseId}
              topic={topic}
              context={context}
              lessonIdFromUrl={lessonIdFromUrl}
              onLessonReady={onLessonReady}
            />
            <div className="mt-4 flex flex-wrap items-center gap-2 min-h-[44px]">
              {lessonId && (
                <>
                  <button
                    type="button"
                    onClick={saveBookmark}
                    disabled={bookmarked}
                    className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 px-3 py-1.5 text-sm hover:bg-[var(--muted)] disabled:opacity-60"
                  >
                    {bookmarked ? "Saved for later" : "Save for later"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setProgressMark("understood")}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${progress === "understood" ? "border-green-500 bg-green-500/20" : "border-[var(--border)] hover:bg-[var(--muted)]"}`}
                  >
                    Understood
                  </button>
                  <button
                    type="button"
                    onClick={() => setProgressMark("need_review")}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${progress === "need_review" ? "border-amber-500 bg-amber-500/20" : "border-[var(--border)] hover:bg-[var(--muted)]"}`}
                  >
                    Need review
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuizOpen(true)}
                    className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)] hover:opacity-90"
                  >
                    Test your understanding
                  </button>
                  <Link
                    href={`/studybuddy?fromLesson=1&topic=${encodeURIComponent(topic)}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted)]"
                  >
                    <BookOpen className="h-4 w-4" />
                    StudyBuddy
                  </Link>
                </>
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start max-lg:order-last">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 max-md:flex max-md:items-center max-md:gap-3">
              <TutorAvatar
                name={avatarName || "Tutor"}
                style={avatarStyle}
                message={avatarMessage}
                isThinking={chatThinking}
                compact={false}
              />
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <h2 className="mb-3 text-sm font-semibold">Q&A</h2>
              <StudyChat
                lessonId={lessonId}
                topic={topic}
                lessonContentExcerpt={contentSummary}
                avatarStyle={avatarStyle}
                suggestedQuestions={suggestedQuestions}
                onMessageSent={onMessageSent}
                onResponseReceived={onResponseReceived}
              />
            </div>
          </aside>
        </div>
      </div>
      <LessonQuizModal
        open={quizOpen}
        onOpenChange={setQuizOpen}
        topic={topic}
        lessonContentExcerpt={contentSummary}
      />
    </main>
  );
}
