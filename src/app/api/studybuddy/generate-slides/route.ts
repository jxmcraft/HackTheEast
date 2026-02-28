/**
 * POST /api/studybuddy/generate-slides
 * Generates customized slides from section content: charts, definitions, bullets.
 * Designed for lecture-style display with avatar top-right.
 */

import { NextRequest, NextResponse } from "next/server";
import { chatCompletion } from "@/lib/ai/llm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 45;

export type StudyBuddySlide = {
  title: string;
  bullets: string[];
  definition?: string;
  chartType?: "flowchart" | "pie" | "sequence" | "mindmap" | "none";
  mermaidCode?: string;
  speakerNotes?: string;
};

type Body = {
  sectionTitle: string;
  sectionContent: string;
  topic: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const sectionTitle = String(body.sectionTitle ?? "").trim();
    const sectionContent = String(body.sectionContent ?? "").trim();
    const topic = String(body.topic ?? "").trim();

    if (!sectionContent) {
      return NextResponse.json({ error: "sectionContent is required" }, { status: 400 });
    }

    const systemPrompt = `You are a presentation designer creating educational slides for a lecture video.

Topic: ${topic}
Section: ${sectionTitle}

Create 3-6 slides that make the content easily digestible. Return ONLY valid JSON array.

Each slide object:
- "title": Short, catchy title
- "bullets": 2-4 key points (concise, readable)
- "definition": (optional) When the slide introduces an important term, include a clear definition here. Only use when there's a key concept to define.
- "chartType": (optional) Use when a visual helps: "flowchart" (processes, steps), "pie" (proportions), "sequence" (order), "mindmap" (hierarchy), or "none"
- "mermaidCode": (optional) Mermaid diagram code when chartType is set. For flowchart use flowchart TB/LR, for pie use pie, for sequence use sequenceDiagram.
- "speakerNotes": (optional) Brief note for the narrator

Guidelines:
- Use flowchart for: processes, training loops, data flow, architecture
- Use pie for: proportions, distributions (e.g. "ReLU 60%, Sigmoid 20%...")
- Use sequence for: step-by-step order, interactions
- Add "definition" when introducing terms like "activation function", "backpropagation", etc.
- Keep bullets short (one line each)
- Make it engaging and easy to scan

Content:
---
${sectionContent}
---

Return ONLY a JSON array. No markdown, no code fences. Example:
[{"title":"Key Concept","bullets":["Point 1","Point 2"],"definition":"A term is...","chartType":"flowchart","mermaidCode":"flowchart LR\n  A-->B"},...]`;

    const userPrompt = `Generate slides for section "${sectionTitle}" on ${topic}.`;

    const raw = await chatCompletion({
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.5,
    });

    const jsonStr = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    let arr: unknown[];
    try {
      arr = JSON.parse(jsonStr) as unknown[];
    } catch {
      return NextResponse.json({ error: "Invalid JSON from model" }, { status: 500 });
    }

    if (!Array.isArray(arr)) {
      return NextResponse.json({ error: "Response was not an array" }, { status: 500 });
    }

    const slides: StudyBuddySlide[] = arr.map((item, i) => {
      if (!item || typeof item !== "object") {
        return { title: `Slide ${i + 1}`, bullets: [] };
      }
      const o = item as Record<string, unknown>;
      return {
        title: typeof o.title === "string" ? o.title : `Slide ${i + 1}`,
        bullets: Array.isArray(o.bullets)
          ? o.bullets.map((b) => (typeof b === "string" ? b : String(b))).filter(Boolean)
          : [],
        definition: typeof o.definition === "string" ? o.definition : undefined,
        chartType: ["flowchart", "pie", "sequence", "mindmap", "none"].includes(String(o.chartType ?? ""))
          ? (o.chartType as StudyBuddySlide["chartType"])
          : undefined,
        mermaidCode: typeof o.mermaidCode === "string" ? o.mermaidCode : undefined,
        speakerNotes: typeof o.speakerNotes === "string" ? o.speakerNotes : undefined,
      };
    });

    return NextResponse.json({ slides });
  } catch (error) {
    console.error("Generate slides error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate slides" },
      { status: 500 }
    );
  }
}
