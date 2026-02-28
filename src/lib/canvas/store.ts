/**
 * Embedding generation and storage for course materials.
 * All requests go through LiteLLM proxy (model from LITELLM_EMBEDDING_MODEL; configure Minimax/Featherless in litellm/config.yaml).
 */

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import type { IngestedMaterial } from "@/lib/canvas/ingest";
import {
  generateEmbedding,
  EMBEDDING_DIM,
} from "@/lib/embeddings";

const CHUNK_OVERLAP = 100;
const DELAY_MS = 300;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Compute a stable hash of material content so we can skip re-ingesting unchanged content. */
export function contentHash(contentText: string): string {
  return createHash("sha256").update(contentText, "utf8").digest("hex");
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
 * Delete all chunks for a single material (by base canvas_item_id). Used when content hash changes.
 */
async function deleteChunksForMaterial(
  supabase: SupabaseClient,
  courseId: string,
  baseCanvasItemId: string
): Promise<void> {
  const chunkPrefix = `${baseCanvasItemId}-chunk-`;
  const { error } = await supabase
    .from("course_materials")
    .delete()
    .eq("course_id", courseId)
    .like("canvas_item_id", `${chunkPrefix}%`);
  if (error) throw error;
}

/**
 * Store ingested materials: chunk, generate embeddings, insert into course_materials.
 * Uses material_content_hashes to skip unchanged content; replaces chunks when content hash changes.
 * courseId must be the internal course UUID (e.g. from public.courses.id).
 * Pass supabase for background jobs (e.g. service-role client); otherwise uses request-scoped client.
 * Optional onProgress(materialsInCourse, chunksInCourse) is called after each material.
 */
export async function storeCourseMaterials(
  courseId: string,
  materials: IngestedMaterial[],
  options?: { supabase?: SupabaseClient; onProgress?: (materialsInCourse: number, chunksInCourse: number) => void }
): Promise<{ materialsStored: number; chunksCreated: number }> {
  const supabase = options?.supabase ?? createClient();
  let chunksCreated = 0;
  const seenMaterialKeys = new Set<string>();

  for (const material of materials) {
    const hash = contentHash(material.content_text);
    const { data: existingRow } = await supabase
      .from("material_content_hashes")
      .select("content_hash")
      .eq("course_id", courseId)
      .eq("canvas_item_id", material.canvas_item_id)
      .maybeSingle();

    if (existingRow?.content_hash === hash) continue;

    if (existingRow) {
      await deleteChunksForMaterial(supabase, courseId, material.canvas_item_id);
    }

    const chunks = chunkText(material.content_text);
    if (chunks.length === 0) continue;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const canvasItemId = `${material.canvas_item_id}-chunk-${i}`;

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

    const { error: hashErr } = await supabase
      .from("material_content_hashes")
      .upsert(
        { course_id: courseId, canvas_item_id: material.canvas_item_id, content_hash: hash },
        { onConflict: "course_id,canvas_item_id" }
      );
    if (hashErr) {
      console.warn("Failed to upsert material_content_hashes:", hashErr.message);
    }

    seenMaterialKeys.add(material.canvas_item_id);
    options?.onProgress?.(seenMaterialKeys.size, chunksCreated);
  }

  return {
    materialsStored: seenMaterialKeys.size,
    chunksCreated,
  };
}

/**
 * Delete all course_materials and their content hashes for a course (e.g. before re-sync).
 */
export async function clearCourseMaterials(courseId: string): Promise<void> {
  const supabase = createClient();
  const { error: hashErr } = await supabase
    .from("material_content_hashes")
    .delete()
    .eq("course_id", courseId);
  if (hashErr) throw hashErr;
  const { error } = await supabase
    .from("course_materials")
    .delete()
    .eq("course_id", courseId);
  if (error) throw error;
}
