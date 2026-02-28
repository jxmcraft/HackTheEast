"use client";

import React, { useEffect, useState } from "react";
import type { StudyBuddySlide } from "@/app/api/studybuddy/generate-slides/route";

interface LectureSlidesProps {
  slides: StudyBuddySlide[];
  currentIndex: number;
  sectionTitle: string;
}

export default function LectureSlides({ slides, currentIndex }: LectureSlidesProps) {
  const [mermaidSvgs, setMermaidSvgs] = useState<Record<number, string>>({});

  useEffect(() => {
    if (slides.length === 0) return;

    const renderMermaid = async (idx: number, code: string) => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
          flowchart: { useMaxWidth: true, htmlLabels: true },
          pie: { useMaxWidth: true },
        });
        const id = `slide-mermaid-${idx}-${Date.now()}`;
        const { svg } = await mermaid.render(id, code);
        setMermaidSvgs((prev) => ({ ...prev, [idx]: svg }));
      } catch {
        setMermaidSvgs((prev) => ({ ...prev, [idx]: "" }));
      }
    };

    slides.forEach((slide, idx) => {
      if (slide.mermaidCode && slide.chartType && slide.chartType !== "none") {
        renderMermaid(idx, slide.mermaidCode);
      }
    });
  }, [slides]);

  if (slides.length === 0) return null;

  const slide = slides[Math.min(currentIndex, slides.length - 1)];

  return (
    <div className="flex flex-col h-full justify-center px-6 md:px-12">
      <div
        key={currentIndex}
        className="bg-[var(--color-surface)]/60 backdrop-blur-sm rounded-2xl border border-[var(--border)] p-6 md:p-8 shadow-2xl max-w-3xl mx-auto w-full animate-[fadeSlide_0.3s_ease-out]"
      >
        <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)] mb-4">{slide.title}</h2>

        {slide.definition && (
          <div className="mb-4 p-4 rounded-lg bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/50">
            <p className="text-sm font-medium text-[var(--color-primary)] mb-1">Definition</p>
            <p className="text-[var(--foreground)]">{slide.definition}</p>
          </div>
        )}

        <ul className="space-y-2 mb-4">
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-[var(--muted-foreground)]">
              <span className="text-[var(--color-primary)] shrink-0">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {slide.mermaidCode && slide.chartType && slide.chartType !== "none" && mermaidSvgs[currentIndex] && (
          <div className="mt-4 p-4 rounded-lg bg-[var(--background)]/80 flex items-center justify-center min-h-[160px]">
            <div
              className="[&_svg]:max-w-full [&_svg]:max-h-[200px] [&_svg]:w-auto [&_svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: mermaidSvgs[currentIndex] }}
            />
          </div>
        )}
      </div>

      <div className="flex justify-center gap-1.5 mt-4">
        {slides.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === currentIndex ? "w-6 bg-purple-500" : "w-1.5 bg-gray-600"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
