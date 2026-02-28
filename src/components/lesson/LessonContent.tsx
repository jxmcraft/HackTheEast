"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { TextLessonView } from "./TextLessonView";
import { SlidesLessonView } from "./SlidesLessonView";
import { AudioLessonView } from "./AudioLessonView";
import { AudioVisualPlayer, AudioVisualLoading } from "./AudioVisualPlayer";
import { FallbackBanner } from "./FallbackBanner";
import type { SlideWithImage } from "@/types/audioVisual";

function getGenerationStatus(state: LessonContentState): string | null {
  if (state.podcastGenerating) {
    return state.generatingMode === "slides" ? "Generating slide deck…" : "Generating podcast…";
  }
  if (state.loadingAudioVisual) {
    return state.loadingAudioVisualMode === "slides" ? "Loading slide deck…" : "Loading podcast…";
  }
  if (state.status === "loading") return "Generating lesson…";
  return null;
}

function GenerationStatusBanner({
  status,
  progress,
  step,
  indeterminate,
}: {
  status: string;
  progress?: number | null;
  step?: string | null;
  /** When true, show an animated indeterminate progress bar (e.g. while loading saved audio/slides). */
  indeterminate?: boolean;
}) {
  const showProgressBar = typeof progress === "number" && progress >= 0;
  const showIndeterminate = indeterminate && !showProgressBar;
  return (
    <div className="mb-6 -mx-6 -mt-6 md:-mx-10 md:-mt-10 rounded-t-xl border-b border-[var(--border)] bg-[var(--muted)]/40 px-6 py-8 md:px-10 md:py-10">
      <div className="flex flex-col items-center justify-center gap-4 text-center max-w-xl mx-auto">
        <div
          className="h-14 w-14 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"
          aria-hidden
        />
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-[var(--foreground)]">
            {step ?? status}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {indeterminate || showProgressBar
              ? "This may take a moment. Your lesson will be saved to your account."
              : "Your lesson is being prepared and will be saved to your account."}
          </p>
        </div>
        {(showProgressBar && !showIndeterminate) && (
          <div className="w-full space-y-1">
            <div className="h-3 w-full bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--primary)] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(2, progress ?? 0))}%` }}
              />
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">{Math.round(progress ?? 0)}%</p>
          </div>
        )}
        {showIndeterminate && (
          <div className="w-full space-y-1">
            <div className="h-2 w-full bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className="h-full w-1/3 bg-[var(--primary)] rounded-full"
                style={{ animation: "loading-shimmer 1.5s ease-in-out infinite" }}
              />
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">Loading…</p>
          </div>
        )}
      </div>
    </div>
  );
}

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
  /** When set, we have an audio-visual result to show (podcast mode). */
  audioVisual?: {
    audioUrl: string;
    slides: SlideWithImage[];
    script: string;
    voiceId?: string;
  } | null;
  /** Which conversion is shown when audioVisual is set (podcast vs slides). */
  audioVisualMode?: "podcast" | "slides" | null;
  /** True while fetching saved podcast/slide-deck (GET audio-visual). */
  loadingAudioVisual?: boolean;
  /** Which mode we're loading when loadingAudioVisual is true. */
  loadingAudioVisualMode?: "podcast" | "slides" | null;
  /** True only while POST /api/generate-audio-visual is in flight. */
  podcastGenerating?: boolean;
  /** Which audio-visual type we're generating when podcastGenerating is true. */
  generatingMode?: "podcast" | "slides" | null;
  /** 0-100 for podcast/slides generation progress bar. */
  generationProgress?: number | null;
  /** Step label for podcast/slides generation. */
  generationStep?: string | null;
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Keep URL in sync with lessonId so reload loads the same lesson (and its saved podcast/slide-deck).
  useEffect(() => {
    if (!state.lessonId || state.status !== "ready") return;
    const current = searchParams.get("lessonId");
    if (current === state.lessonId) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("lessonId", state.lessonId);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [state.lessonId, state.status, pathname, searchParams, router]);

  const generate = useCallback(
    async (overwriteLessonId?: string | null) => {
      setState((s) => ({ ...s, status: "loading", audioVisual: null }));
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

  const generateAudioVisual = useCallback(async (mode: "podcast" | "slides", lessonId?: string | null, voiceId?: string | null) => {
    const label = mode === "podcast" ? "podcast" : "slide deck";
    setState((s) => ({
      ...s,
      status: "loading",
      error: undefined,
      audioVisual: null,
      podcastGenerating: true,
      generatingMode: mode,
      generationProgress: 10,
      generationStep: `Preparing ${label}…`,
    }));
    const steps: { progress: number; step: string }[] = [
      { progress: 10, step: `Preparing ${label}…` },
      { progress: 22, step: "Creating lesson structure…" },
      { progress: 35, step: mode === "podcast" ? "Generating audio…" : "Generating slide images…" },
      { progress: 50, step: mode === "podcast" ? "Synthesizing voice…" : "Rendering slides…" },
      { progress: 65, step: "Almost there…" },
      { progress: 80, step: "Finalizing…" },
    ];
    let stepIndex = 0;
    const advanceProgress = () => {
      stepIndex += 1;
      if (stepIndex < steps.length) {
        const { progress, step } = steps[stepIndex];
        setState((s) => ({ ...s, generationProgress: progress, generationStep: step }));
      }
    };
    const interval = setInterval(advanceProgress, 1800);
    try {
      const res = await fetch("/api/generate-audio-visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          courseId,
          context: context || undefined,
          avatarStyle: "encouraging",
          mode,
          ...(lessonId ? { lessonId } : {}),
          ...(voiceId ? { voiceId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState((s) => ({
          ...s,
          status: "ready",
          audioVisual: null,
          podcastGenerating: false,
          generatingMode: null,
          generationProgress: null,
          generationStep: null,
          error: data.error ?? res.statusText,
        }));
        return;
      }
      if (data.success && data.lesson && data.assets) {
        setState((s) => ({
          ...s,
          generationProgress: 100,
          generationStep: "Done!",
        }));
        await new Promise((r) => setTimeout(r, 400));
        setState((s) => ({
          ...s,
          status: "ready",
          podcastGenerating: false,
          generatingMode: null,
          generationProgress: null,
          generationStep: null,
          audioVisual: {
            audioUrl: data.assets.audioUrl ?? "",
            slides: data.assets.slides ?? [],
            script: data.lesson.script ?? "",
            voiceId: voiceId ?? undefined,
          },
          audioVisualMode: mode,
        }));
      } else {
        setState((s) => ({
          ...s,
          status: "ready",
          audioVisual: null,
          podcastGenerating: false,
          generatingMode: null,
          generationProgress: null,
          generationStep: null,
          error: data.error ?? "Generation failed",
        }));
      }
    } catch (e) {
      setState((s) => ({
        ...s,
        status: "ready",
        audioVisual: null,
        podcastGenerating: false,
        generatingMode: null,
        generationProgress: null,
        generationStep: null,
        error: e instanceof Error ? e.message : "Failed to generate podcast",
      }));
    } finally {
      clearInterval(interval);
    }
  }, [courseId, topic, context]);

  /** Load saved podcast/slide deck or generate if not found. Call when user clicks Convert to podcast/slides. */
  const loadOrGenerateAudioVisual = useCallback(
    async (mode: "podcast" | "slides") => {
      const lessonId = state.lessonId;
      if (!lessonId) return;
      setState((s) => ({ ...s, loadingAudioVisual: true, loadingAudioVisualMode: mode }));
      try {
        const res = await fetch(`/api/lessons/${lessonId}/audio-visual?mode=${mode}`);
        if (res.ok) {
          const data: { script?: string; slides?: SlideWithImage[]; audioUrl?: string; voiceId?: string } =
            await res.json();
          setState((s) => ({
            ...s,
            loadingAudioVisual: false,
            loadingAudioVisualMode: null,
            audioVisual: {
              script: data.script ?? "",
              slides: Array.isArray(data.slides) ? data.slides : [],
              audioUrl: data.audioUrl ?? "",
              voiceId: data.voiceId,
            },
            audioVisualMode: mode,
          }));
          return;
        }
        if (res.status === 404) {
          setState((s) => ({ ...s, loadingAudioVisual: false, loadingAudioVisualMode: null }));
          await generateAudioVisual(mode, lessonId);
          return;
        }
        setState((s) => ({ ...s, loadingAudioVisual: false, loadingAudioVisualMode: null }));
      } catch {
        setState((s) => ({ ...s, loadingAudioVisual: false, loadingAudioVisualMode: null }));
      }
    },
    [state.lessonId, generateAudioVisual]
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
      if (state.lessonId === lessonIdFromUrl && state.status === "ready") return;
      void loadExisting(lessonIdFromUrl);
    } else {
      if (state.status !== "idle") return;
      void generate(null);
    }
  }, [lessonIdFromUrl, state.lessonId, state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.status === "ready" && state.lessonId && state.content && onLessonReady) {
      const summary = getContentSummary(state.content, state.mode ?? "text");
      onLessonReady(state.lessonId, summary);
    }
  }, [state.status, state.lessonId, state.content, state.mode, onLessonReady]);

  // Show progress UI whenever we're loading or generating podcast/slide deck (even if status is still "ready")
  if (state.loadingAudioVisual || state.podcastGenerating) {
    const statusMsg = getGenerationStatus(state);
    const banner = statusMsg ? (
      <GenerationStatusBanner
        status={statusMsg}
        progress={state.podcastGenerating ? (state.generationProgress ?? 0) : undefined}
        step={state.podcastGenerating ? state.generationStep : undefined}
        indeterminate={state.loadingAudioVisual && !state.podcastGenerating}
      />
    ) : null;
    if (state.podcastGenerating) {
      return (
        <>
          {banner}
          <AudioVisualLoading
            mode={state.generatingMode ?? "podcast"}
            step={state.generationStep ?? (state.generatingMode === "slides" ? "Generating slide deck…" : "Generating podcast…")}
            progress={state.generationProgress ?? 0}
          />
        </>
      );
    }
    if (state.loadingAudioVisual) {
      return (
        <>
          {banner}
          <AudioVisualLoading
            mode={state.loadingAudioVisualMode ?? "podcast"}
            step="Loading…"
            progress={0}
          />
        </>
      );
    }
  }

  if (state.status === "loading") {
    const statusMsg = getGenerationStatus(state);
    const banner = statusMsg ? (
      <GenerationStatusBanner
        status={statusMsg}
        progress={undefined}
        step={undefined}
      />
    ) : null;
    return (
      <>
        {banner}
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] p-8">
          <div className="animate-spin h-10 w-10 border-2 border-[var(--muted-foreground)] border-t-transparent rounded-full mb-4" aria-hidden />
          <p className="text-[var(--muted-foreground)]">Generating lesson…</p>
        </div>
      </>
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

  if (state.status === "ready" && state.audioVisual) {
    return (
      <div className="space-y-6">
        <AudioVisualPlayer
          variant={state.audioVisualMode === "podcast" ? "podcast" : "slides"}
          audioUrl={state.audioVisual.audioUrl}
          slides={state.audioVisual.slides}
          script={state.audioVisual.script}
          voiceId={state.audioVisual.voiceId}
          onRegenerateWithVoice={
            state.audioVisualMode === "podcast"
              ? (voiceId) => generateAudioVisual("podcast", state.lessonId, voiceId)
              : undefined
          }
          onAddNarrator={
            state.audioVisualMode === "slides" && state.lessonId
              ? async () => {
                  const res = await fetch(
                    `/api/lessons/${state.lessonId}/audio-visual/add-narrator`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        voiceId: state.audioVisual?.voiceId ?? undefined,
                      }),
                    }
                  );
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(
                      (data as { error?: string }).error ?? `Request failed (${res.status})`
                    );
                  }
                  const mode = "slides";
                  const getRes = await fetch(
                    `/api/lessons/${state.lessonId}/audio-visual?mode=${mode}`
                  );
                  if (!getRes.ok) throw new Error("Failed to reload slide deck");
                  const data: {
                    script?: string;
                    slides?: SlideWithImage[];
                    audioUrl?: string;
                    voiceId?: string;
                  } = await getRes.json();
                  setState((s) =>
                    s.audioVisual
                      ? {
                          ...s,
                          audioVisual: {
                            ...s.audioVisual,
                            audioUrl: data.audioUrl ?? s.audioVisual.audioUrl,
                            voiceId: data.voiceId ?? s.audioVisual.voiceId,
                          },
                        }
                      : s
                  );
                }
              : undefined
          }
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              generateAudioVisual(
                state.audioVisualMode === "podcast" ? "podcast" : "slides",
                state.lessonId,
                state.audioVisual?.voiceId
              )
            }
            className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 px-4 py-2 text-sm hover:bg-[var(--muted)]"
          >
            {state.audioVisualMode === "podcast" ? "Regenerate podcast" : "Regenerate slide deck"}
          </button>
          <button
            type="button"
            onClick={() => setState((s) => ({ ...s, audioVisual: null, audioVisualMode: null }))}
            className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 px-4 py-2 text-sm hover:bg-[var(--muted)]"
          >
            Back to lesson
          </button>
          <Link
            href="/sync-dashboard"
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--muted)]"
          >
            New topic
          </Link>
        </div>
      </div>
    );
  }

  if (state.status === "ready" && state.error && !state.audioVisual) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-amber-200">{state.error}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => generateAudioVisual("podcast", state.lessonId)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Retry podcast
            </button>
            <button
              type="button"
              onClick={() => setState((s) => ({ ...s, error: undefined }))}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
        {state.content && (
          <>
            {(state.fallbackUsed && state.fallbackUsed !== "none") && (
              <FallbackBanner
                type={state.fallbackUsed}
                message={state.disclaimer ?? undefined}
              />
            )}
            {state.mode === "text" && typeof (state.content as Record<string, unknown>).markdown === "string" && (
              <TextLessonView markdown={(state.content as { markdown: string }).markdown} />
            )}
            {state.mode === "slides" && Array.isArray((state.content as Record<string, unknown>).slides) && (
              <SlidesLessonView
                slides={(state.content as { slides: { title: string; bullets: string[]; speakerNotes: string; visualSuggestion?: string }[] }).slides}
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
            {state.mode === "audio" && Array.isArray((state.content as Record<string, unknown>).script) && (
              <AudioLessonView
                script={(state.content as { script: { speaker: string; text: string }[] }).script}
                durationSeconds={((state.content as Record<string, unknown>).duration as number) ?? 0}
              />
            )}
          </>
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
      </div>
    );
  }

  if (state.status !== "ready" || !state.content) return null;

  const sources = state.sources ?? [];
  const content = state.content as Record<string, unknown>;
  const textLessonActions = (
    <>
      <button
        type="button"
        onClick={() => loadOrGenerateAudioVisual("podcast")}
        className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 px-4 py-2 text-sm hover:bg-[var(--muted)]"
      >
        Convert to podcast
      </button>
      <button
        type="button"
        onClick={() => loadOrGenerateAudioVisual("slides")}
        className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 px-4 py-2 text-sm hover:bg-[var(--muted)]"
      >
        Convert to slide deck
      </button>
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
    </>
  );

  return (
    <div className="space-y-6">
      {(state.fallbackUsed && state.fallbackUsed !== "none") && (
        <FallbackBanner
          type={state.fallbackUsed}
          message={state.disclaimer ?? undefined}
        />
      )}
      {state.mode === "text" && typeof content.markdown === "string" && (
        <TextLessonView markdown={content.markdown} actions={textLessonActions} />
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

      {state.mode !== "text" && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => loadOrGenerateAudioVisual("podcast")}
            className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 px-4 py-2 text-sm hover:bg-[var(--muted)]"
          >
            Convert to podcast
          </button>
          <button
            type="button"
            onClick={() => loadOrGenerateAudioVisual("slides")}
            className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 px-4 py-2 text-sm hover:bg-[var(--muted)]"
          >
            Convert to slide deck
          </button>
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
      )}

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
