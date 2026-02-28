"use client";

import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";

export type Slide = { title: string; bullets: string[]; speakerNotes: string; visualSuggestion?: string };

type Props = {
  slides: Slide[];
  lessonId?: string;
  topic?: string;
  context?: string;
  onSlideUpdated?: (slides: Slide[]) => void;
};

export function SlidesLessonView({ slides, lessonId, topic, context, onSlideUpdated }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(true);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);

  const handleRegenerateSlide = useCallback(
    async (index: number, feedback?: string) => {
      if (!lessonId || !topic || !onSlideUpdated) return;
      setRegeneratingIndex(index);
      try {
        const res = await fetch("/api/regenerate-slide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonId,
            slideIndex: index,
            topic,
            context: context || undefined,
            feedback: feedback || undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Regenerate failed");
        const newSlide = data.slide as Slide;
        const updated = [...slides];
        updated[index] = newSlide;
        onSlideUpdated(updated);
      } catch {
        setRegeneratingIndex(null);
      } finally {
        setRegeneratingIndex(null);
      }
    },
    [lessonId, topic, context, onSlideUpdated, slides]
  );

  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => emblaApi.off("select", onSelect);
  }, [emblaApi, onSelect]);

  if (!slides.length) return null;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-[var(--border)]" ref={emblaRef}>
        <div className="flex">
          {slides.map((slide, i) => (
            <div key={i} className="min-w-0 flex-[0_0_100%] rounded-lg bg-[var(--card)] p-8">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs text-[var(--muted-foreground)]">
                  Slide {i + 1} of {slides.length}
                </span>
                {onSlideUpdated && lessonId && topic ? (
                  <button
                    type="button"
                    onClick={() => handleRegenerateSlide(i)}
                    disabled={regeneratingIndex !== null}
                    className="text-xs underline hover:no-underline disabled:opacity-50"
                  >
                    {regeneratingIndex === i ? "Updating…" : "Regenerate this slide"}
                  </button>
                ) : null}
              </div>
              <h2 className="mb-4 text-xl font-bold">{slide.title}</h2>
              <ul className="list-disc space-y-2 pl-6 text-sm">
                {slide.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
              {slide.visualSuggestion && (
                <p className="mt-4 text-xs text-[var(--muted-foreground)]">
                  Visual: {slide.visualSuggestion}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => scrollTo(i)}
            className={`h-2 w-2 rounded-full transition ${i === selectedIndex ? "bg-white" : "bg-[var(--muted-foreground)]/50"}`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
        <button
          type="button"
          onClick={() => setShowNotes(!showNotes)}
          className="ml-4 text-xs text-[var(--muted-foreground)] underline"
        >
          {showNotes ? "Hide" : "Show"} speaker notes
        </button>
      </div>
      {showNotes && slides[selectedIndex]?.speakerNotes && (
        <details open className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-4">
          <summary className="cursor-pointer text-sm font-medium">Speaker notes</summary>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            {slides[selectedIndex].speakerNotes}
          </p>
        </details>
      )}
    </div>
  );
}
