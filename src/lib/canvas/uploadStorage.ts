/**
 * Upload course material file buffers to Supabase Storage.
 * Used by sync and ingest to store original PDF/DOCX/PPTX binaries.
 * Sanitizes filenames so storage keys are valid (no Unicode/special chars that cause "Invalid key").
 */

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UploadCourseFileFn } from "./ingest";

export const COURSE_FILES_BUCKET = "course-material-files";

/** Characters allowed in storage object keys; Supabase rejects many Unicode/special chars. */
const SAFE_KEY_CHAR = /[a-zA-Z0-9._-]/;

/**
 * Produce a safe storage key segment from a filename (preserve extension, sanitize base).
 */
export function safeStorageFileName(fileName: string): string {
  const raw = (fileName ?? "file").replace(/[/\\]/g, "_").replace(/\.\./g, "").trim() || "file";
  const lastDot = raw.lastIndexOf(".");
  const base = lastDot > 0 ? raw.slice(0, lastDot) : raw;
  const ext = lastDot > 0 ? raw.slice(lastDot) : "";
  const safeBase = base
    .split("")
    .map((c) => (SAFE_KEY_CHAR.test(c) ? c : "_"))
    .join("")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 200);
  const extSafe = ext.toLowerCase().match(/^\.(pdf|docx|pptx)$/i) ? ext : ".bin";
  if (!safeBase) {
    const hash = createHash("sha256").update(raw).digest("hex").slice(0, 12);
    return `file_${hash}${extSafe}`;
  }
  return safeBase + extSafe;
}

export function makeUploadCourseFile(
  supabase: SupabaseClient,
  courseUuid: string
): UploadCourseFileFn {
  return async ({ canvasItemId, buffer, fileName, contentType }) => {
    const safeName = safeStorageFileName(fileName ?? "file");
    const path = `${courseUuid}/${canvasItemId}/${safeName}`;
    const { error } = await supabase.storage.from(COURSE_FILES_BUCKET).upload(path, buffer, {
      contentType,
      upsert: true,
    });
    if (error) throw new Error(error.message);
    return path;
  };
}
