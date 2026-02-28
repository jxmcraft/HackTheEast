/**
 * Persist extracted calendar events from course materials and fetch them for the calendar UI.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClientOrThrow } from "@/utils/supabase/server";
import type { IngestedMaterial } from "@/lib/canvas/ingest";
import { extractDatesFromText } from "./date-extractor";
import { screenCalendarCandidates } from "./screen-with-ai";

let _tableMissingLogged = false;

/**
 * Delete all extracted calendar events for a course, then insert events
 * extracted from the given materials. Call after ingesting/storing materials.
 * Materials include: front page, announcements, course files (PDF/DOCX/PPTX text),
 * module pages, assignments, and module files — all are scanned for dates and
 * added to the calendar (e.g. exam dates, deadlines from syllabi and files).
 */
export async function extractAndStoreDates(
  courseId: string,
  materials: IngestedMaterial[],
  options?: { supabase?: SupabaseClient }
): Promise<number> {
  const supabase = options?.supabase ?? createClientOrThrow();

  // #region agent log
  fetch("http://127.0.0.1:7816/ingest/dcfe79ee-b938-4a53-8e78-211d2e2b322f", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "57bbab" },
    body: JSON.stringify({
      sessionId: "57bbab",
      location: "calendar/store.ts:extractAndStoreDates:beforeDelete",
      message: "About to delete extracted_calendar_events for course",
      data: { courseId, materialsCount: materials.length },
      timestamp: Date.now(),
      hypothesisId: "A",
    }),
  }).catch(() => {});
  // #endregion

  const { error: delErr } = await supabase
    .from("extracted_calendar_events")
    .delete()
    .eq("course_id", courseId);
  if (delErr) {
    const isTableMissing =
      delErr.message.includes("schema cache") || delErr.message.includes("not find the table");
    if (isTableMissing && !_tableMissingLogged) {
      _tableMissingLogged = true;
      console.warn(
        "Calendar dates from materials (e.g. midterms, deadlines) are not being saved. " +
          "Run the migration so the table exists: supabase db push (or run supabase/migrations/20260301150000_extracted_calendar_events.sql in the SQL editor), then run Sync again."
      );
    }
    // #region agent log
    fetch("http://127.0.0.1:7816/ingest/dcfe79ee-b938-4a53-8e78-211d2e2b322f", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "57bbab" },
      body: JSON.stringify({
        sessionId: "57bbab",
        location: "calendar/store.ts:extractAndStoreDates:deleteError",
        message: "Delete extracted_calendar_events failed",
        data: { courseId, errorCode: delErr.code, errorMessage: delErr.message, errorDetails: delErr.details },
        timestamp: Date.now(),
        hypothesisId: "A",
      }),
    }).catch(() => {});
    // #endregion
    console.warn("Failed to clear extracted_calendar_events:", delErr.message);
    return 0;
  }

  let inserted = 0;
  const allCandidates: { ev: import("./date-extractor").ExtractedEvent; source_canvas_item_id: string }[] = [];
  for (const material of materials) {
    const events = extractDatesFromText(
      material.content_text,
      material.metadata?.title as string | undefined
    );
    for (const ev of events) {
      allCandidates.push({ ev, source_canvas_item_id: material.canvas_item_id });
    }
  }

  const toInsert = await screenCalendarCandidates(allCandidates);
  for (const { ev, source_canvas_item_id } of toInsert) {
    const { error } = await supabase.from("extracted_calendar_events").insert({
      course_id: courseId,
      title: ev.title,
      start_at: ev.startAt,
      end_at: ev.endAt ?? null,
      all_day: ev.allDay,
      source_canvas_item_id,
      snippet: ev.snippet ?? null,
    });
    if (!error) inserted += 1;
  }
  return inserted;
}

export type StoredExtractedEvent = {
  id: string;
  course_id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  source_canvas_item_id: string | null;
  snippet: string | null;
};

/**
 * Fetch extracted calendar events for the given course IDs within a date range.
 */
export async function getExtractedCalendarEvents(
  courseIds: string[],
  startDate: string,
  endDate: string,
  options?: { supabase?: SupabaseClient }
): Promise<StoredExtractedEvent[]> {
  if (courseIds.length === 0) return [];
  const supabase = options?.supabase ?? createClientOrThrow();

  const { data, error } = await supabase
    .from("extracted_calendar_events")
    .select("id, course_id, title, start_at, end_at, all_day, source_canvas_item_id, snippet")
    .in("course_id", courseIds)
    .gte("start_at", startDate)
    .lte("start_at", endDate)
    .order("start_at", { ascending: true });

  if (error) {
    console.warn("Failed to fetch extracted_calendar_events:", error.message);
    return [];
  }
  return (data ?? []) as StoredExtractedEvent[];
}
