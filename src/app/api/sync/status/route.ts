/**
 * GET /api/sync/status
 * Returns the current user's sync progress from Supabase (profiles).
 */

import { NextResponse } from "next/server";
import { createClientOrThrow } from "@/utils/supabase/server";
import { getSyncProgress, resetSyncProgress } from "@/lib/sync-progress-db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createClientOrThrow();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const row = await getSyncProgress(supabase, user.id);
    if (!row || row.sync_status === "idle" || row.sync_status === null) {
      return NextResponse.json({ status: "idle" });
    }

    const response = {
      jobId: row.sync_started_at ?? undefined,
      status: row.sync_status,
      phase: row.sync_phase ?? undefined,
      courseIndex: row.sync_course_index ?? 0,
      courseTotal: row.sync_course_total ?? 0,
      materialsStored: row.sync_materials_stored ?? 0,
      chunksCreated: row.sync_chunks_created ?? 0,
      currentCourseMaterials: row.sync_current_course_materials ?? 0,
      currentCourseChunks: row.sync_current_course_chunks ?? 0,
      message: row.sync_message ?? undefined,
      error: row.sync_error ?? undefined,
      result: row.sync_result ?? undefined,
      startedAt: row.sync_started_at ? new Date(row.sync_started_at).getTime() : undefined,
      completedAt: row.sync_completed_at ? new Date(row.sync_completed_at).getTime() : undefined,
    };

    // Reset to idle after client has read completed/failed so next poll gets idle
    if (row.sync_status === "completed" || row.sync_status === "failed") {
      await resetSyncProgress(supabase, user.id);
    }

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to retrieve sync status.";
    console.error("[GET /api/sync/status]", err);
    return NextResponse.json({ status: "idle", error: message }, { status: 500 });
  }
}
