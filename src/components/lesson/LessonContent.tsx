"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { TextLessonView } from "./TextLessonView";
import { SlidesLessonView } from "./SlidesLessonView";
import { AudioLessonView } from "./AudioLessonView";
import { FallbackBanner } from "./FallbackBanner";

type Source = { title?: string; url?: string };
type Mode = "text" | "slides" | "audio";
type FallbackUsed = "none" | "partial" | "general" | "web_search" | "user_context";

type LessonContentState = {
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  lessonId?: string;
  mode?: Mode;
  content?: unknown;
  sources?: Source[];
  fallbackUsed?: FallbackUsed;
  disclaimer?: string | null;
};

type Props = {
  courseId: string;
  topic: string;
  context: string;
  lessonIdFromUrl?: string | null;
  /** When lesson is loaded or generated, call with lessonId and a short content summary for chat context */
  onLessonReady?: (lessonId: string, contentSummary: string) => void;
};

function getContentSummary(content: unknown, mode: string): string {
  if (!content || typeof content !== "object") return "";
  const c = content as Record<string, unknown>;
  if (mode === "text" && typeof c.markdown === "string")
    return c.markdown.slice(0, 6000);
  if (mode === "slides" && Array.isArray(c.slides)) {
    const slides = c.slides as { title?: string; bullets?: string[] }[];
    return slides.map((s) => `${s.title ?? ""}\n${(s.bullets ?? []).join("\n")}`).join("\n\n").slice(0, 6000);
  }
  if (mode === "audio" && Array.isArray(c.script))
    return (c.script as { text?: string }[]).map((s) => s.text ?? "").join(" ").slice(0, 6000);
  return "";
}

export function LessonContent({ courseId, topic, context, lessonIdFromUrl, onLessonReady }: Props) {
  const [state, setState] = useState<LessonContentState>({ status: "idle" });

  const generate = useCallback(
    async (overwriteLessonId?: string | null) => {
      setState({ status: "loading" });
      try {
        const body: Record<string, string> = {
          courseId,
          topic,
        };
        if (context) body.context = context;
        if (overwriteLessonId) body.lessonId = overwriteLessonId;
        const res = await fetch("/api/generate-lesson", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState({ status: "error", error: data.error ?? res.statusText });
          return;
        }
        setState({
          status: "ready",
          lessonId: data.lessonId,
          mode: data.mode ?? "text",
          content: data.content,
          sources: data.sources ?? [],
          fallbackUsed: (data.fallbackUsed as FallbackUsed) ?? "none",
          disclaimer: data.disclaimer ?? null,
        });
      } catch (e) {
        setState({
          status: "error",
          error: e instanceof Error ? e.message : "Failed to generate lesson",
        });
      }
    },
    [courseId, topic, context]
  );

  const loadExisting = useCallback(
    async (id: string) => {
      setState({ status: "loading" });
      try {
        const res = await fetch(`/api/lessons/${id}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState({ status: "error", error: data.error ?? "Lesson not found" });
          return;
        }
        if (data.content) {
          setState({
            status: "ready",
            lessonId: data.id,
            mode: (data.learning_mode as Mode) ?? "text",
            content: data.content,
            sources: data.sources ?? [],
            fallbackUsed: (data.fallback_used as FallbackUsed) ?? "none",
            disclaimer: null,
          });
        } else {
          void generate(id);
        }
      } catch (e) {
        setState({
          status: "error",
          error: e instanceof Error ? e.message : "Failed to load lesson",
        });
      }
    },
    [generate]
  );

  useEffect(() => {
    if (lessonIdFromUrl) {
      void loadExisting(lessonIdFromUrl);
    } else {
      void generate(null);
    }
  }, [lessonIdFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  useEffect(() => {
    if (state.status === "ready" && state.lessonId && state.content && onLessonReady) {
      const summary = getContentSummary(state.content, state.mode ?? "text");
      onLessonReady(state.lessonId, summary);
    }
  }, [state.status, state.lessonId, state.content, state.mode, onLessonReady]);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] p-8">
        <p className="text-[var(--muted-foreground)]">Generating lesson…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
        <p className="text-red-400">{state.error}</p>
        <button
          type="button"
          onClick={() => generate(state.lessonId ?? null)}
          className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
        >
          Retry
        </button>
      </div>
    );
  }

  if (state.status !== "ready" || !state.content) return null;

  const sources = state.sources ?? [];
  const content = state.content as Record<string, unknown>;

  return (
    <div className="space-y-6">
      {(state.fallbackUsed && state.fallbackUsed !== "none") && (
        <FallbackBanner
          type={state.fallbackUsed}
          message={state.disclaimer ?? undefined}
        />
      )}
      {state.mode === "text" && typeof content.markdown === "string" && (
        <TextLessonView markdown={content.markdown} />
      )}
      {state.mode === "slides" && Array.isArray(content.slides) && (
        <SlidesLessonView
          slides={content.slides as { title: string; bullets: string[]; speakerNotes: string; visualSuggestion?: string }[]}
          lessonId={state.lessonId}
          topic={topic}
          context={context}
          onSlideUpdated={(updatedSlides) =>
            setState((s) => (s.content && typeof s.content === "object" && "slides" in s.content
              ? { ...s, content: { ...(s.content as object), slides: updatedSlides } }
              : s))
          }
        />
      )}
      {state.mode === "audio" && Array.isArray(content.script) && (
        <AudioLessonView
          script={content.script as { speaker: string; text: string }[]}
          durationSeconds={(content.duration as number) ?? 0}
        />
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => generate(state.lessonId ?? null)}
          className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 px-4 py-2 text-sm hover:bg-[var(--muted)]"
        >
          Regenerate
        </button>
        <Link
          href="/sync-dashboard"
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--muted)]"
        >
          New topic
        </Link>
      </div>

      {sources.length > 0 && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 p-4">
          <h3 className="mb-2 text-sm font-semibold">Sources</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-[var(--muted-foreground)]">
            {sources.map((s, i) => (
              <li key={i}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
                    {s.title ?? "Source"}
                  </a>
                ) : (
                  s.title ?? "Source"
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
