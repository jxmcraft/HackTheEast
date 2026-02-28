/**
 * Audio-mode lesson generator: podcast-style script (MVP: script only, no TTS).
 */

import { chatCompletion } from "@/lib/ai/llm";
import type { RetrievedMaterial } from "@/lib/ai/retrieval";
import type { UserPreferences } from "@/lib/ai/types";

export type AudioLesson = {
  script: { speaker: string; text: string }[];
  audioUrl?: string;
  duration: number; // seconds, estimated
};

const MEMORY_BLOCK = (ctx: string) => `

IMPORTANT CONTEXT ABOUT THIS STUDENT:
${ctx}
Adapt the script: if they struggled before, explain more; if they mastered basics, go further.`;

export async function generateAudioLesson(params: {
  topic: string;
  context: string;
  materials: RetrievedMaterial[];
  userPreferences: UserPreferences;
  studentContext?: string;
}): Promise<AudioLesson> {
  const { topic, context, userPreferences, studentContext } = params;

  const systemPrompt = `Create a conversational, friendly podcast script about ${topic}.
${studentContext ? MEMORY_BLOCK(studentContext) : ""}

Style: ${userPreferences.avatar_style}

Format: Two hosts having a conversation about the topic.
- Host A (the tutor): Explains concepts
- Host B (the student): Asks questions, provides relatable examples

The script should:
- Last approximately 5-8 minutes when read aloud (estimate ~150 words per minute)
- Cover the main points from the materials
- Include natural transitions
- End with a summary

Using these materials:

${context}

Return as JSON only (no markdown):
{
  "script": [ { "speaker": "Host A", "text": "..." }, { "speaker": "Host B", "text": "..." } ],
  "estimatedDurationMinutes": 6
}`;

  const userPrompt = `Generate the podcast script for: ${topic}.`;

  let raw: string;
  try {
    raw = await chatCompletion({ system: systemPrompt, user: userPrompt, temperature: 0.7 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Audio lesson generation failed: ${msg}`);
  }

  const parsed = parseAudioJson(raw);
  const duration = estimateDurationSeconds(parsed.script);
  return { script: parsed.script, duration };
}

function parseAudioJson(raw: string): { script: { speaker: string; text: string }[] } {
  let jsonStr = raw.trim();
  const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1].trim();
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    throw new Error("Audio script response was not valid JSON.");
  }
  const scriptArr = Array.isArray(obj.script) ? obj.script : [];
  const script = scriptArr.map((item) => {
    if (!item || typeof item !== "object") return { speaker: "Host A", text: "" };
    const o = item as Record<string, unknown>;
    return {
      speaker: typeof o.speaker === "string" ? o.speaker : "Host A",
      text: typeof o.text === "string" ? o.text : String(o.text ?? ""),
    };
  });
  return { script };
}

function estimateDurationSeconds(script: { text: string }[]): number {
  const totalWords = script.reduce((sum, s) => sum + s.text.split(/\s+/).filter(Boolean).length, 0);
  const wpm = 150;
  return Math.max(60, Math.round((totalWords / wpm) * 60));
}
