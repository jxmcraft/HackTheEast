/**
 * Embedding generation and storage for course materials.
 * All requests go through LiteLLM proxy (model from LITELLM_EMBEDDING_MODEL; configure Minimax/Featherless in litellm/config.yaml).
 */

import { createClient } from "@/utils/supabase/server";
import type { IngestedMaterial } from "@/lib/canvas/ingest";
import {
  generateEmbedding,
  EMBEDDING_DIM,
} from "@/lib/embeddings";

const CHUNK_OVERLAP = 100;
const DELAY_MS = 150;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Split text into overlapping chunks for better embedding quality.
 */
export function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = CHUNK_OVERLAP
): string[] {
  if (!text?.trim()) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + chunkSize;
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(" ", end);
      if (lastSpace > start) end = lastSpace + 1;
    }
    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
    if (start >= text.length) break;
  }
  return chunks.filter((c) => c.length > 0);
}

/**
 * Store ingested materials: chunk, generate embeddings, insert into course_materials.
 * courseId must be the internal course UUID (e.g. from public.courses.id).
 * Skips inserting when a row with the same canvas_item_id already exists (per chunk id).
 */
export async function storeCourseMaterials(
  courseId: string,
  materials: IngestedMaterial[]
): Promise<{ materialsStored: number; chunksCreated: number }> {
  const supabase = createClient();
  let chunksCreated = 0;
  const seenMaterialKeys = new Set<string>();

  for (const material of materials) {
    const chunks = chunkText(material.content_text);
    if (chunks.length === 0) continue;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const canvasItemId = `${material.canvas_item_id}-chunk-${i}`;

      const { data: existing } = await supabase
        .from("course_materials")
        .select("id")
        .eq("canvas_item_id", canvasItemId)
        .maybeSingle();

      if (existing) continue;

      let embedding: number[];
      try {
        await delay(DELAY_MS);
        embedding = await generateEmbedding(chunk);
      } catch (err) {
        console.warn(
          `Embedding failed for ${canvasItemId}:`,
          err instanceof Error ? err.message : err
        );
        continue;
      }

      if (embedding.length !== EMBEDDING_DIM) {
        console.warn(
          `Embedding dimension ${embedding.length} != ${EMBEDDING_DIM}, skipping ${canvasItemId}`
        );
        continue;
      }

      const { error } = await supabase.from("course_materials").insert({
        course_id: courseId,
        canvas_item_id: canvasItemId,
        content_type: material.content_type,
        content_text: chunk,
        metadata: material.metadata,
        embedding,
      });

      if (error) {
        if (error.code === "23505") continue; // unique violation, skip
        throw error;
      }
      chunksCreated++;
    }
    if (chunks.length > 0) seenMaterialKeys.add(material.canvas_item_id);
  }

  return {
    materialsStored: seenMaterialKeys.size,
    chunksCreated,
  };
}

/**
 * Delete all course_materials for a course (e.g. before re-sync).
 */
export async function clearCourseMaterials(courseId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("course_materials")
    .delete()
    .eq("course_id", courseId);
  if (error) throw error;
}
