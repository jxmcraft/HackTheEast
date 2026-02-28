/**
 * POST /api/regenerate-slide
 * Regenerate a single slide with optional feedback.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { chatCompletion } from "@/lib/ai/llm";
import type { Slide } from "@/lib/ai/generators/slidesGenerator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  lessonId: string;
  slideIndex: number;
  topic: string;
  context?: string;
  feedback?: string;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as Body;
    const lessonId = String(body.lessonId ?? "").trim();
    const slideIndex = Number(body.slideIndex);
    const topic = String(body.topic ?? "").trim();
    const contextHint = String(body.context ?? "").trim() || undefined;
    const feedback = String(body.feedback ?? "").trim() || undefined;

    if (!lessonId || !Number.isInteger(slideIndex) || slideIndex < 0 || !topic) {
      return NextResponse.json(
        { error: "lessonId, slideIndex (number), and topic are required" },
        { status: 400 }
      );
    }

    const { data: lesson, error: fetchErr } = await supabase
      .from("lessons")
      .select("content, learning_mode")
      .eq("id", lessonId)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !lesson || lesson.learning_mode !== "slides") {
      return NextResponse.json({ error: "Lesson not found or not a slides lesson" }, { status: 404 });
    }

    const content = lesson.content as { slides?: Slide[] } | null;
    const slides = Array.isArray(content?.slides) ? content.slides : [];
    if (slideIndex >= slides.length) {
      return NextResponse.json({ error: "Invalid slideIndex" }, { status: 400 });
    }

    const currentSlide = slides[slideIndex];
    const feedbackPrompt = feedback
      ? `The student asked: "${feedback}". Generate a new slide that addresses this.`
      : "Generate a new version of this slide with the same topic but possibly different angle or emphasis.";

    const systemPrompt = `You are a presentation designer. You are editing one slide in a lesson about "${topic}".
${contextHint ? `Context: ${contextHint}` : ""}

Current slide title: ${currentSlide?.title ?? "Unknown"}

${feedbackPrompt}

Return ONLY valid JSON for a single slide (no array, no markdown):
{
  "title": "A catchy title",
  "bullets": ["point 1", "point 2", "point 3"],
  "speakerNotes": "What the presenter would say.",
  "visualSuggestion": "Optional visual description"
}`;

    const raw = await chatCompletion({
      system: systemPrompt,
      user: `Generate the slide.`,
      temperature: 0.5,
    });

    const jsonStr = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    let newSlide: Slide;
    try {
      const obj = JSON.parse(jsonStr) as Record<string, unknown>;
      newSlide = {
        title: typeof obj.title === "string" ? obj.title : currentSlide?.title ?? "Slide",
        bullets: Array.isArray(obj.bullets) ? obj.bullets.map((b) => String(b)) : currentSlide?.bullets ?? [],
        speakerNotes: typeof obj.speakerNotes === "string" ? obj.speakerNotes : currentSlide?.speakerNotes ?? "",
        visualSuggestion: typeof obj.visualSuggestion === "string" ? obj.visualSuggestion : undefined,
      };
    } catch {
      return NextResponse.json({ error: "Failed to parse new slide from model" }, { status: 500 });
    }

    const updatedSlides = [...slides];
    updatedSlides[slideIndex] = newSlide;

    const { error: updateErr } = await supabase
      .from("lessons")
      .update({
        content: { ...content, slides: updatedSlides },
        updated_at: new Date().toISOString(),
      })
      .eq("id", lessonId)
      .eq("user_id", user.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, slide: newSlide });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Regenerate failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
