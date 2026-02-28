/**
 * MiniMax service for generating lesson structure (script + slides) for audio-visual lessons.
 * Uses MiniMax chat on api.minimax.io (same as StudyBuddy chat); requires MINIMAX_API_KEY only.
 */

import type { Slide } from "@/types/audioVisual";
import { withRetry } from "./retryLogic";

const MINIMAX_BASE = "https://api.minimax.io";
const MINIMAX_CHAT_MODEL = process.env.MINIMAX_CHAT_MODEL ?? "M2-her";

/** M2-her supports max 2048 output; Text Generation models (MiniMax-M2.5, etc.) support up to 10240. */
const MAX_OUTPUT_TOKENS: Record<string, number> = {
  "M2-her": 2048,
  "MiniMax-M2.5": 4096,
  "MiniMax-M2.5-highspeed": 4096,
  "MiniMax-M2.1": 4096,
  "MiniMax-M2": 4096,
  "MiniMax-M1": 4096,
  "MiniMax-Text-01": 2048,
};
const DEFAULT_MAX_TOKENS = 4096;

function getMaxTokens(model: string): number {
  return MAX_OUTPUT_TOKENS[model] ?? DEFAULT_MAX_TOKENS;
}

export interface LessonStructureResult {
  script: string;
  slides: Omit<Slide, "id" | "estimatedDuration">[];
}

function getMinimaxConfig(): { apiKey: string } {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("MINIMAX_API_KEY is required for audio-visual lesson generation.");
  }
  return { apiKey };
}

const SYSTEM_PROMPT = `You are an expert educational content creator specializing in creating engaging lessons.
You must respond with ONLY valid JSON. Use strict JSON: every property name must be in double quotes (e.g. "title" not title). No markdown code fences, no explanation before or after.
Generate a comprehensive lesson structure with the following JSON shape exactly:
{
  "script": "Full narration text for a conversational podcast (about 400-600 words). Sound natural and engaging.",
  "slides": [
    {
      "title": "Slide Title",
      "points": ["Point 1", "Point 2", "Point 3"],
      "imagePrompt": "Detailed description for image generation: cinematic, educational, specific scene.",
      "segmentText": "The exact portion of the script that corresponds to this slide."
    }
  ]
}
Rules: 5-7 slides. Each slide: 2-3 bullet points (concise). imagePrompt must be detailed for visual generation. segmentText must be a continuous segment of the script.`;

function buildUserPrompt(topic: string, context: string, avatarStyle: string): string {
  const styleNote =
    avatarStyle === "strict"
      ? "Teaching style: Formal, precise, high expectations."
      : avatarStyle === "socratic"
        ? "Teaching style: Question-based, guides discovery."
        : "Teaching style: Supportive, positive, celebrates progress.";

  return `Topic: ${topic}

${context ? `Context from course materials:\n${context}\n` : ""}
${styleNote}

Output ONLY the JSON object (no \`\`\`json or other text).`;
}

/** Return the substring that is the first complete JSON object (brace-matched, respects strings). */
function extractFirstJsonObject(s: string): string | null {
  let start = s.indexOf("{");
  if (start === -1) {
    const arrayStart = s.indexOf("[");
    if (arrayStart !== -1) start = s.indexOf("{", arrayStart);
  }
  if (start === -1) return null;
  let depth = 0;
  let i = start;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    if (c === '"') {
      i += 1;
      while (i < n) {
        if (s[i] === "\\") {
          i += 2;
          continue;
        }
        if (s[i] === '"') {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (c === "{") {
      depth += 1;
      i += 1;
      continue;
    }
    if (c === "}") {
      depth -= 1;
      i += 1;
      if (depth === 0) return s.slice(start, i);
      continue;
    }
    i += 1;
  }
  return null;
}

/** Strip markdown code fences that wrap JSON (e.g. ```json\n... or ```\n...). */
function stripMarkdownFences(s: string): string {
  return s.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}

/** Remove trailing commas before } or ] so JSON.parse can succeed. */
function removeTrailingCommas(jsonStr: string): string {
  return jsonStr.replace(/,(\s*[}\]])/g, "$1");
}

/** Repair single-quoted property names (e.g. 'title': -> "title":) for any key. */
function repairSingleQuotedKeys(jsonStr: string): string {
  return jsonStr.replace(
    /(}\s*,\s*|{\s*|,\s*)'([^']+)'(\s*:)/g,
    (_, prefix, key) => prefix + `"${key.replace(/"/g, '\\"')}"` + ":"
  );
}

/** Repair unquoted property names (e.g. title: -> "title":) for known keys. */
function repairUnquotedKeys(jsonStr: string): string {
  return jsonStr.replace(
    /(}\s*,\s*|{\s*)(script|slides|title|points|imagePrompt|segmentText)(\s*:)/g,
    (_, prefix, key) => prefix + `"${key}"` + ":"
  );
}

/** Extract JSON from MiniMax response (may be wrapped in markdown or have trailing content). */
function parseJsonFromResponse(content: string): Record<string, unknown> {
  let trimmed = content.trim();
  trimmed = stripMarkdownFences(trimmed);

  function tryParse(candidate: string): Record<string, unknown> | null {
    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  // 1) Try first complete brace-matched object (raw then repaired).
  let firstObject = extractFirstJsonObject(trimmed);
  if (firstObject) {
    let parsed = tryParse(firstObject);
    if (parsed) return parsed;
    firstObject = removeTrailingCommas(firstObject);
    parsed = tryParse(firstObject);
    if (parsed) return parsed;
    firstObject = repairUnquotedKeys(firstObject);
    parsed = tryParse(firstObject);
    if (parsed) return parsed;
    firstObject = repairSingleQuotedKeys(firstObject);
    parsed = tryParse(firstObject);
    if (parsed) return parsed;
    firstObject = removeTrailingCommas(repairSingleQuotedKeys(repairUnquotedKeys(firstObject)));
    parsed = tryParse(firstObject);
    if (parsed) return parsed;
  }

  // 2) Try full trimmed content (after repairs) in case response is only the object.
  let full = removeTrailingCommas(repairSingleQuotedKeys(repairUnquotedKeys(trimmed)));
  let parsed = tryParse(full);
  if (parsed) return parsed;

  // 3) Try extracting again from repaired full string (brace match might succeed after repair).
  firstObject = extractFirstJsonObject(full);
  if (firstObject) {
    parsed = tryParse(removeTrailingCommas(firstObject));
    if (parsed) return parsed;
  }

  // 4) Last resort: try parsing raw content as JSON (API might return pure JSON).
  parsed = tryParse(trimmed);
  if (parsed) return parsed;

  throw new Error("No JSON object found in MiniMax response");
}

/** Validate and normalize parsed structure; assign ids and durations. */
function normalizeStructure(parsed: Record<string, unknown>): LessonStructureResult {
  const script = typeof parsed.script === "string" ? parsed.script.trim() : "";
  if (!script) throw new Error("Missing or invalid 'script' in MiniMax response");

  const rawSlides = Array.isArray(parsed.slides) ? parsed.slides : [];
  const slides: Omit<Slide, "id" | "estimatedDuration">[] = rawSlides.map((s: unknown, index: number) => {
    const slide = s as Record<string, unknown>;
    const title = typeof slide.title === "string" ? slide.title : `Slide ${index + 1}`;
    const points = Array.isArray(slide.points)
      ? (slide.points as unknown[]).filter((p): p is string => typeof p === "string").slice(0, 3)
      : [];
    const imagePrompt =
      typeof slide.imagePrompt === "string" ? slide.imagePrompt : `Educational illustration for: ${title}`;
    const segmentText = typeof slide.segmentText === "string" ? slide.segmentText : "";

    return { title, points, imagePrompt, segmentText };
  });

  if (slides.length === 0) throw new Error("No valid slides in MiniMax response");

  return { script, slides };
}

/**
 * Generate lesson structure (script + slides) using MiniMax chat completion.
 * Retries up to 2 times on API failure.
 */
export async function generateLessonStructure(
  topic: string,
  context: string,
  avatarStyle: string
): Promise<LessonStructureResult> {
  const { apiKey } = getMinimaxConfig();
  const base = MINIMAX_BASE.replace(/\/$/, "");
  const url = `${base}/v1/text/chatcompletion_v2`;
  const userPrompt = buildUserPrompt(topic, context, avatarStyle);

  const doRequest = async (): Promise<LessonStructureResult> => {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MINIMAX_CHAT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: getMaxTokens(MINIMAX_CHAT_MODEL),
      }),
    });

    const bodyText = await res.text();
    if (!res.ok) {
      console.error("[minimax] API error", res.status, bodyText.slice(0, 500));
      throw new Error(`MiniMax API error ${res.status}: ${bodyText.slice(0, 300)}`);
    }

    let data: { choices?: Array<{ message?: { content?: string } }>; base_resp?: { status_code?: number; status_msg?: string } };
    try {
      data = JSON.parse(bodyText) as typeof data;
    } catch {
      throw new Error("Invalid JSON from MiniMax");
    }

    const statusCode = data?.base_resp?.status_code;
    const statusMsg = data?.base_resp?.status_msg ?? "";
    if (statusCode != null && statusCode !== 0) {
      const msg = statusMsg ? ` (${statusMsg})` : "";
      throw new Error(`MiniMax returned status ${statusCode}${msg}`);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Empty or invalid MiniMax response");

    const parsed = parseJsonFromResponse(content);
    return normalizeStructure(parsed);
  };

  return withRetry(doRequest, 2, 1500);
}
