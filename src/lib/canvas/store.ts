/**
 * Embedding generation and storage for course materials.
 * Uses local, OpenAI, or MiniMax embeddings (see EMBEDDING_PROVIDER and keys in env).
 */

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClientOrThrow } from "@/utils/supabase/server";
import type { IngestedMaterial } from "@/lib/canvas/ingest";
import {
  generateEmbeddingBatch,
  EMBEDDING_DIM,
} from "@/lib/embeddings";

const CHUNK_OVERLAP = 100;
const EMBED_BATCH_SIZE = 32;

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
  const supabase = options?.supabase ?? createClientOrThrow();
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

    const storagePath = material.metadata?.file_storage_path as string | undefined;
    const fileName = (material.metadata?.file_name as string) ?? "file";
    const contentType = (material.metadata?.file_content_type as string) ?? "application/octet-stream";
    let fileRecordFailed = false;
    if (storagePath) {
      const { error: fileErr } = await supabase.from("course_material_files").upsert(
        {
          course_id: courseId,
          canvas_item_id: material.canvas_item_id,
          file_name: fileName,
          content_type: contentType,
          storage_path: storagePath,
          file_size: (material.metadata?.file_size as number) ?? null,
        },
        { onConflict: "course_id,canvas_item_id" }
      );
      if (fileErr) {
        console.warn("Failed to upsert course_material_files:", fileErr.message);
        fileRecordFailed = true;
      }
    }

    const chunks = chunkText(material.content_text);
    if (chunks.length === 0) continue;

    let materialChunksCreated = 0;
    const allEmbeddings: number[][] = [];
    try {
      for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
        const vectors = await generateEmbeddingBatch(batch);
        allEmbeddings.push(...vectors);
      }
    } catch (err) {
      console.warn(
        `Embedding failed for ${material.canvas_item_id}:`,
        err instanceof Error ? err.message : err
      );
      options?.onProgress?.(seenMaterialKeys.size, chunksCreated);
      continue;
    }

    for (let i = 0; i < chunks.length; i++) {
      const embedding = allEmbeddings[i];
      if (!embedding || embedding.length !== EMBEDDING_DIM) {
        console.warn(
          `Embedding dimension ${embedding?.length ?? 0} != ${EMBEDDING_DIM}, skipping ${material.canvas_item_id}-chunk-${i}`
        );
        continue;
      }
      const canvasItemId = `${material.canvas_item_id}-chunk-${i}`;
      const chunk = chunks[i];
      const { error } = await supabase.from("course_materials").insert({
        course_id: courseId,
        canvas_item_id: canvasItemId,
        content_type: material.content_type,
        content_text: chunk,
        metadata: material.metadata,
        embedding,
      });

      if (error) {
        if (error.code === "23505") {
          // Chunk already exists (e.g. from prior run that wrote rows but not hash). Count as success so we don't warn "No chunks saved".
          chunksCreated++;
          materialChunksCreated++;
          continue;
        }
        throw error;
      }
      chunksCreated++;
      materialChunksCreated++;
    }

    if (materialChunksCreated === 0) {
      console.warn(
        `[store] No chunks saved for ${material.canvas_item_id}: all embeddings failed. Embeddings use the local model by default; ensure the server can load it, or set EMBEDDING_PROVIDER=openai and OPENAI_EMBEDDING_API_KEY.`
      );
    }

    const uploadFailed = material.metadata?.upload_failed === true;
    const incompleteChunks = materialChunksCreated < chunks.length;
    const fullSuccess =
      materialChunksCreated > 0 &&
      !uploadFailed &&
      !fileRecordFailed &&
      !incompleteChunks;
    if (fullSuccess) {
      const { error: hashErr } = await supabase
        .from("material_content_hashes")
        .upsert(
          { course_id: courseId, canvas_item_id: material.canvas_item_id, content_hash: hash },
          { onConflict: "course_id,canvas_item_id" }
        );
      if (hashErr) {
        console.warn("Failed to upsert material_content_hashes:", hashErr.message);
      }
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
  const supabase = createClientOrThrow();
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
