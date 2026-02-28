/**
 * Semantic search retrieval for course materials.
 * Uses embeddings (LiteLLM) and Supabase match_course_materials.
 */

import { createClient } from "@/utils/supabase/server";
import { generateEmbedding } from "@/lib/embeddings";

export type RetrievedMaterial = {
  id: string;
  content_text: string;
  metadata: {
    title?: string;
    url?: string;
    content_type?: string;
    [key: string]: unknown;
  };
  similarity: number;
};

const DEFAULT_LIMIT = 8;
const MAX_CONTEXT_CHARS = 24_000; // ~6k tokens; leave room for prompts
const CHARS_PER_TOKEN_EST = 4;

/**
 * Resolve Canvas course ID + user to internal course UUID (for course_materials.course_id).
 */
export async function getCourseUuid(canvasCourseId: string, userId: string): Promise<string | null> {
  const supabase = createClient();
  const canvasId = Number(canvasCourseId);
  if (!Number.isInteger(canvasId)) return null;
  const { data } = await supabase
    .from("courses")
    .select("id")
    .eq("canvas_id", canvasId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Retrieve relevant course materials by topic using semantic search.
 * courseId: Canvas course ID (number as string). Resolved to internal UUID via getCourseUuid.
 */
export async function retrieveRelevantMaterials(params: {
  courseId: string;
  topic: string;
  limit?: number;
  userId: string;
}): Promise<RetrievedMaterial[]> {
  const { courseId, topic, userId } = params;
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), 20);

  const courseUuid = await getCourseUuid(courseId, userId);
  if (!courseUuid) {
    return [];
  }

  const cleanedTopic = topic.trim().slice(0, 500);
  if (!cleanedTopic) {
    return [];
  }

  let embedding: number[];
  try {
    embedding = await generateEmbedding(cleanedTopic);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Embedding failed: ${msg}`);
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("match_course_materials", {
    query_embedding: embedding,
    match_count: limit,
    filter_course_id: courseUuid,
  });

  if (error) {
    throw new Error(`Semantic search failed: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    content_text: string;
    metadata: Record<string, unknown> | null;
    similarity: number;
  }>;

  const materials: RetrievedMaterial[] = rows.map((row) => ({
    id: row.id,
    content_text: row.content_text ?? "",
    metadata: (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as RetrievedMaterial["metadata"],
    similarity: typeof row.similarity === "number" ? row.similarity : 0,
  }));

  return materials;
}

/**
 * Format retrieved materials into a single context string for the LLM.
 * Truncates to stay under ~8000 tokens (MAX_CONTEXT_CHARS).
 */
export function prepareContextForLLM(materials: RetrievedMaterial[]): string {
  if (materials.length === 0) {
    return "No course materials were found for this topic.";
  }
  const maxChars = Math.min(MAX_CONTEXT_CHARS, 8000 * CHARS_PER_TOKEN_EST);
  let total = 0;
  const parts: string[] = [];
  for (const m of materials) {
    const title = (m.metadata?.title as string) ?? m.metadata?.content_type ?? "Source";
    const url = m.metadata?.url;
    const header = `--- Source: ${title}${url ? ` (${url})` : ""} ---`;
    const block = `${header}\n${m.content_text}\n---\n`;
    if (total + block.length > maxChars) {
      const remaining = maxChars - total - 50;
      if (remaining > 0) {
        parts.push(`${header}\n${m.content_text.slice(0, remaining)}...\n---\n`);
      }
      break;
    }
    parts.push(block);
    total += block.length;
  }
  return parts.join("\n").trim() || "No course materials were found for this topic.";
}
