/**
 * Slides-mode lesson generator: JSON array of slides for carousel.
 */

import { chatCompletion } from "@/lib/ai/llm";
import type { RetrievedMaterial } from "@/lib/ai/retrieval";
import type { UserPreferences } from "@/lib/ai/types";

export type Slide = {
  title: string;
  bullets: string[];
  speakerNotes: string;
  visualSuggestion?: string;
};

export type SlidesLesson = {
  slides: Slide[];
  totalSlides: number;
};

export async function generateSlidesLesson(params: {
  topic: string;
  context: string;
  materials: RetrievedMaterial[];
  userPreferences: UserPreferences;
}): Promise<SlidesLesson> {
  const { topic, context, userPreferences } = params;

  const systemPrompt = `You are a presentation designer creating educational slides.

Teaching style: ${userPreferences.avatar_style}

Topic: ${topic}

Using these materials:

${context}

Create a slide presentation as a JSON array. Each slide should have:
- "title": A catchy, memorable title
- "bullets": 3-5 key points (short, readable)
- "speakerNotes": Detailed explanation you would say (for the audio/avatar)
- "visualSuggestion": Brief description of what visual could accompany this slide

Format: Return ONLY valid JSON array, no markdown formatting, no code fences.
Target: 7-10 slides for a comprehensive lesson.`;

  const userPrompt = `Generate slides for: ${topic}.`;

  let raw: string;
  try {
    raw = await chatCompletion({ system: systemPrompt, user: userPrompt, temperature: 0.5 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Slides generation failed: ${msg}`);
  }

  const slides = parseSlidesJson(raw);
  return { slides, totalSlides: slides.length };
}

function parseSlidesJson(raw: string): Slide[] {
  let jsonStr = raw.trim();
  const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1].trim();
  let arr: unknown[];
  try {
    arr = JSON.parse(jsonStr) as unknown[];
  } catch {
    throw new Error("Slides response was not valid JSON.");
  }
  if (!Array.isArray(arr)) throw new Error("Slides response was not a JSON array.");
  return arr.map((item, i) => normalizeSlide(item, i));
}

function normalizeSlide(item: unknown, index: number): Slide {
  if (!item || typeof item !== "object") {
    return { title: `Slide ${index + 1}`, bullets: [], speakerNotes: "" };
  }
  const o = item as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title : `Slide ${index + 1}`;
  let bullets: string[] = [];
  if (Array.isArray(o.bullets)) {
    bullets = o.bullets.map((b) => (typeof b === "string" ? b : String(b))).filter(Boolean);
  }
  const speakerNotes = typeof o.speakerNotes === "string" ? o.speakerNotes : "";
  const visualSuggestion = typeof o.visualSuggestion === "string" ? o.visualSuggestion : undefined;
  return { title, bullets, speakerNotes, visualSuggestion };
}
