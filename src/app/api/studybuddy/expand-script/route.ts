/**
 * POST /api/studybuddy/expand-script
 * Expands section content into a verbose, learner-friendly narration script
 * using the avatar's teaching style for personalized learning.
 */

import { NextRequest, NextResponse } from "next/server";
import { chatCompletion } from "@/lib/ai/llm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  sectionTitle: string;
  sectionContent: string;
  topic: string;
  personalityPrompt: string;
  fullTopicContent?: string;
  uploadsContext?: Array<{ name: string; extracted_text?: string; key_points?: { pageNumber: number; points: string[] }[] }>;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const sectionTitle = String(body.sectionTitle ?? "").trim();
    const sectionContent = String(body.sectionContent ?? "").trim();
    const topic = String(body.topic ?? "").trim();
    const personalityPrompt = String(body.personalityPrompt ?? "be clear and helpful").trim();
    const fullTopicContent = typeof body.fullTopicContent === "string" ? body.fullTopicContent.trim() : "";
    const uploadsContext = Array.isArray(body.uploadsContext) ? body.uploadsContext : [];

    if (!sectionContent) {
      return NextResponse.json({ error: "sectionContent is required" }, { status: 400 });
    }

    const contextBlock = fullTopicContent
      ? `

Full course/topic context (use this so your script connects and flows with the rest of the material; reference prior ideas and lead naturally into the next):
---
${fullTopicContent.slice(0, 8000)}
---
`
      : "";

    const uploadsBlock =
      uploadsContext.length > 0
        ? `

Student has uploaded these materials; you may reference their key points when relevant to this section:
---
${uploadsContext
  .slice(0, 3)
  .map(
    (u) =>
      `"${u.name}": ${(u.extracted_text || "").slice(0, 2000)} Key points: ${(u.key_points || [])
        .map((p) => `Page ${p.pageNumber}: ${(p.points || []).join("; ")}`)
        .join(" | ")}`
  )
  .join("\n\n")}
---
`
        : "";

    const systemPrompt = `You are an expert tutor creating a single, consistent narration script for a video lesson.

Topic: ${topic}
Section: ${sectionTitle}

Teaching style you MUST follow: ${personalityPrompt}
${contextBlock}${uploadsBlock}

The student will hear this script read aloud by an AI voice. Your job is to EXPAND and REWRITE the raw content below into a verbose, engaging, learner-friendly script. Do NOT simply read the content verbatim.

Guidelines:
- Explain concepts in plain language with examples and analogies
- Add transitions between ideas ("Now, let's look at...", "Here's the key point...") so sections connect
- Break down jargon and define terms when first introduced
- Use the teaching style above (e.g. if "use sports analogies", include them)
- Keep each "sentence" suitable for TTS: end with . ! or ? so it can be split for narration
- Aim for 2-4x the length of the original—make it easy for learners to understand
- Do not use bullet points or markdown; write flowing prose
- If you have full course context, reference it so this section flows from and into the rest of the course

Raw content for THIS section to expand:
---
${sectionContent}
---

Return ONLY the expanded script text. No titles, no headers, no markdown. Just the narration.`;

    const userPrompt = `Expand the section "${sectionTitle}" into a verbose, learner-friendly narration script following the teaching style: ${personalityPrompt}`;

    const script = await chatCompletion({
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.7,
    });

    return NextResponse.json({ script: script.trim() });
  } catch (error) {
    console.error("Expand script error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to expand script" },
      { status: 500 }
    );
  }
}
