/**
 * Phase 5: Extract learning memories from lesson + chat (MiniMax first, Featherless fallback).
 */

import type { LessonForExtraction, ChatMessageForExtraction, GeneratedMemory } from "./types";

async function callMiniMax(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return null;
  const res = await fetch("https://api.minimax.io/v1/text/chatcompletion_v2", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "M2-her",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 1024,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data?.choices?.[0]?.message?.content?.trim() ?? null;
}

async function callFeatherless(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const apiKey = process.env.FEATHERLESS_API_KEY;
  if (!apiKey) return null;
  const base = (process.env.FEATHERLESS_API_BASE ?? "https://api.featherless.ai").replace(/\/$/, "");
  const model = process.env.FEATHERLESS_CHAT_MODEL ?? "Qwen/Qwen2.5-7B-Instruct";
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(base.includes("featherless") && {
        HTTP_Referer: process.env.NEXT_PUBLIC_APP_URL ?? "",
        "X-Title": "HTE Study Companion",
      }),
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data?.choices?.[0]?.message?.content?.trim() ?? null;
}

const EXTRACTION_SYSTEM = `You are an educational analyst. Analyze this learning session and extract 2-5 key memories about the student's learning.

Rules:
- type must be one of: concept_struggle, concept_mastered, learning_preference, topic_interest
- importance is 1-10 (10 = very important to remember)
- Be concise. One sentence per memory.
- concept_struggle: topics/concepts the student had difficulty with or asked for clarification
- concept_mastered: topics the student clearly understood or said they got it
- learning_preference: how they learn best (e.g. prefers examples, Socratic style)
- topic_interest: notable interest or motivation

Respond with ONLY a JSON array. No markdown, no explanation. Example:
[{"type":"concept_struggle","content":"Student had difficulty with entropy in thermodynamics","importance":8},{"type":"concept_mastered","content":"Student grasped the first law of thermodynamics","importance":6}]`;

function parseMemoriesJson(text: string, sourceLessonId: string): GeneratedMemory[] {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
  const jsonStr = jsonMatch ? jsonMatch[0] : trimmed;
  let arr: unknown[];
  try {
    arr = JSON.parse(jsonStr);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const validTypes: GeneratedMemory["memoryType"][] = [
    "concept_struggle",
    "concept_mastered",
    "learning_preference",
    "topic_interest",
  ];
  return arr
    .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
    .map((x) => {
      const type = typeof x.type === "string" && validTypes.includes(x.type as GeneratedMemory["memoryType"])
        ? (x.type as GeneratedMemory["memoryType"])
        : "learning_preference";
      const content = typeof x.content === "string" ? x.content.trim().slice(0, 1000) : "";
      const importance = typeof x.importance === "number" ? Math.min(10, Math.max(1, Math.round(x.importance))) : 5;
      return { memoryType: type, content, importanceScore: importance, sourceLessonId };
    })
    .filter((m) => m.content.length > 0);
}

/**
 * Extract memories from a lesson and its chat history using LLM (MiniMax first, Featherless fallback).
 */
export async function extractMemoriesFromLesson(
  lesson: LessonForExtraction,
  chatHistory: ChatMessageForExtraction[]
): Promise<GeneratedMemory[]> {
  const questions = chatHistory.filter((m) => m.role === "user").map((m) => m.content.trim());
  const responses = chatHistory.filter((m) => m.role === "tutor").map((m) => m.content.trim());
  const userPrompt = `Lesson Topic: ${lesson.topic}
Lesson Content Summary: ${lesson.contentSummary.slice(0, 3000)}

Student Questions: ${questions.length ? questions.join("\n") : "(none)"}
Tutor Responses (excerpts): ${responses.length ? responses.slice(-5).join("\n---\n") : "(none)"}

Extract 2-5 important memories. Reply with JSON array only.`;

  let text = await callMiniMax(EXTRACTION_SYSTEM, userPrompt);
  if (text == null) text = await callFeatherless(EXTRACTION_SYSTEM, userPrompt);
  if (text == null) return [];

  return parseMemoriesJson(text, lesson.id);
}

/**
 * Save extracted memories to user_memories. Skips exact duplicate content; updates importance if same content exists.
 */
export async function saveMemories(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  memories: GeneratedMemory[]
): Promise<void> {
  if (memories.length === 0) return;
  for (const m of memories) {
    const row = {
      user_id: userId,
      memory_type: m.memoryType,
      content: m.content,
      importance_score: m.importanceScore,
      source_lesson_id: m.sourceLessonId,
    };
    const { data: existing } = await supabase
      .from("user_memories")
      .select("id")
      .eq("user_id", userId)
      .eq("content", m.content)
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      await supabase
        .from("user_memories")
        .update({ importance_score: m.importanceScore, last_accessed: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase.from("user_memories").insert(row);
    }
  }
}
