/**
 * Upload course material file buffers to Supabase Storage.
 * Used by sync and ingest to store original PDF/DOCX/PPTX binaries.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UploadCourseFileFn } from "./ingest";

export const COURSE_FILES_BUCKET = "course-material-files";

export function makeUploadCourseFile(
  supabase: SupabaseClient,
  courseUuid: string
): UploadCourseFileFn {
  return async ({ canvasItemId, buffer, fileName, contentType }) => {
    const safeName = (fileName ?? "file").replace(/[/\\]/g, "_").replace(/\.\./g, "") || "file";
    const path = `${courseUuid}/${canvasItemId}/${safeName}`;
    const { error } = await supabase.storage.from(COURSE_FILES_BUCKET).upload(path, buffer, {
      contentType,
      upsert: true,
    });
    if (error) throw new Error(error.message);
    return path;
  };
}
