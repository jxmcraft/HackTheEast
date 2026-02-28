/**
 * Sync progress stored in Supabase (profiles table).
 * Used so the frontend can poll GET /api/sync/status and show progress from DB.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type SyncStatus = "idle" | "running" | "completed" | "failed";

export interface SyncProgressRow {
  sync_status: SyncStatus | null;
  sync_started_at: string | null;
  sync_completed_at: string | null;
  sync_phase: string | null;
  sync_course_index: number | null;
  sync_course_total: number | null;
  sync_materials_stored: number | null;
  sync_chunks_created: number | null;
  sync_current_course_materials: number | null;
  sync_current_course_chunks: number | null;
  sync_message: string | null;
  sync_error: string | null;
  sync_result: {
    courses?: { id: number; name: string; course_code?: string }[];
    assignments?: { id: number; name: string; description?: string; due_at?: string; course_id: number }[];
    ingest?: { courseId: number; materialsStored: number; chunksCreated: number }[];
  } | null;
}

const SYNC_COLUMNS =
  "sync_status,sync_started_at,sync_completed_at,sync_phase,sync_course_index,sync_course_total,sync_materials_stored,sync_chunks_created,sync_current_course_materials,sync_current_course_chunks,sync_message,sync_error,sync_result";

export async function getSyncProgress(
  supabase: SupabaseClient,
  userId: string
): Promise<SyncProgressRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(SYNC_COLUMNS)
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return data as SyncProgressRow;
}

/** Set sync status to running and initial progress. */
export async function startSyncProgress(
  supabase: SupabaseClient,
  userId: string,
  courseTotal: number
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("profiles")
    .update({
      sync_status: "running",
      sync_started_at: now,
      sync_completed_at: null,
      sync_phase: "starting",
      sync_course_index: 0,
      sync_course_total: courseTotal,
      sync_materials_stored: 0,
      sync_chunks_created: 0,
      sync_current_course_materials: 0,
      sync_current_course_chunks: 0,
      sync_message: "Starting sync…",
      sync_error: null,
      sync_result: null,
    })
    .eq("id", userId);
}

/** Resume from a given course index (e.g. after server restart). Does not reset started_at or counts. */
export async function resumeSyncProgress(
  supabase: SupabaseClient,
  userId: string,
  courseTotal: number,
  fromCourseIndex: number
): Promise<void> {
  await supabase
    .from("profiles")
    .update({
      sync_status: "running",
      sync_phase: "ingest",
      sync_course_index: fromCourseIndex,
      sync_course_total: courseTotal,
      sync_message: "Resuming sync…",
      sync_error: null,
    })
    .eq("id", userId);
}

/** Update progress during sync (phase, course index, message, cumulative counts, current-course counts). */
export async function updateSyncProgress(
  supabase: SupabaseClient,
  userId: string,
  update: {
    phase?: string;
    courseIndex?: number;
    courseTotal?: number;
    message?: string;
    materialsStored?: number;
    chunksCreated?: number;
    currentCourseMaterials?: number;
    currentCourseChunks?: number;
  }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (update.phase !== undefined) payload.sync_phase = update.phase;
  if (update.courseIndex !== undefined) payload.sync_course_index = update.courseIndex;
  if (update.courseTotal !== undefined) payload.sync_course_total = update.courseTotal;
  if (update.message !== undefined) payload.sync_message = update.message;
  if (update.materialsStored !== undefined) payload.sync_materials_stored = update.materialsStored;
  if (update.chunksCreated !== undefined) payload.sync_chunks_created = update.chunksCreated;
  if (update.currentCourseMaterials !== undefined) payload.sync_current_course_materials = update.currentCourseMaterials;
  if (update.currentCourseChunks !== undefined) payload.sync_current_course_chunks = update.currentCourseChunks;
  if (Object.keys(payload).length === 0) return;
  await supabase.from("profiles").update(payload).eq("id", userId);
}

/** Mark sync as completed and store result. */
export async function completeSyncProgress(
  supabase: SupabaseClient,
  userId: string,
  result: SyncProgressRow["sync_result"]
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("profiles")
    .update({
      sync_status: "completed",
      sync_completed_at: now,
      sync_phase: "done",
      sync_message: "Sync complete",
      sync_error: null,
      sync_result: result as unknown as Record<string, unknown>,
    })
    .eq("id", userId);
}

/** Mark sync as failed. */
export async function failSyncProgress(
  supabase: SupabaseClient,
  userId: string,
  error: string
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("profiles")
    .update({
      sync_status: "failed",
      sync_completed_at: now,
      sync_message: error,
      sync_error: error,
    })
    .eq("id", userId);
}

/** Reset to idle (e.g. when starting a new sync, after client read completed/failed, or on cancel). */
export async function resetSyncProgress(supabase: SupabaseClient, userId: string): Promise<void> {
  await supabase
    .from("profiles")
    .update({
      sync_status: "idle",
      sync_started_at: null,
      sync_completed_at: null,
      sync_phase: null,
      sync_course_index: 0,
      sync_course_total: 0,
      sync_materials_stored: 0,
      sync_chunks_created: 0,
      sync_current_course_materials: 0,
      sync_current_course_chunks: 0,
      sync_message: null,
      sync_error: null,
      sync_result: null,
    })
    .eq("id", userId);
}

/** Consider sync stale (e.g. server restarted) if running and started more than this many ms ago. */
export const SYNC_RESUME_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

/** If there is a running sync that started recently, return the course index to resume from; else 0. */
export async function getResumeCourseIndex(
  supabase: SupabaseClient,
  userId: string
): Promise<{ startFromIndex: number; materialsStored: number; chunksCreated: number }> {
  const row = await getSyncProgress(supabase, userId);
  if (!row || row.sync_status !== "running" || !row.sync_started_at) {
    return { startFromIndex: 0, materialsStored: 0, chunksCreated: 0 };
  }
  const startedAt = new Date(row.sync_started_at).getTime();
  if (Date.now() - startedAt > SYNC_RESUME_MAX_AGE_MS) {
    return { startFromIndex: 0, materialsStored: 0, chunksCreated: 0 };
  }
  return {
    startFromIndex: row.sync_course_index ?? 0,
    materialsStored: row.sync_materials_stored ?? 0,
    chunksCreated: row.sync_chunks_created ?? 0,
  };
}
