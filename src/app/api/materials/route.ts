/**
 * GET /api/materials
 * Returns agent memory: courses and their extracted materials (files, pages, assignments, linked pages).
 * Scoped to the authenticated user's courses.
 */

import { NextResponse } from "next/server";
import { createClientOrThrow } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MaterialMeta = {
  title?: string;
  url?: string;
  source?: string;
  module_name?: string;
  [key: string]: unknown;
};

function baseCanvasItemId(canvasItemId: string): string {
  return canvasItemId.replace(/-chunk-\d+$/, "");
}

export async function GET() {
  const supabase = createClientOrThrow();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: userCourses, error: coursesErr } = await supabase
    .from("courses")
    .select("id, name, canvas_id")
    .eq("user_id", user.id)
    .order("name");

  if (coursesErr) {
    return NextResponse.json({ error: coursesErr.message }, { status: 500 });
  }
  if (!userCourses?.length) {
    return NextResponse.json({ courses: [] });
  }

  const courseIds = userCourses.map((c) => c.id);
  const { data: rows, error: matErr } = await supabase
    .from("course_materials")
    .select("course_id, canvas_item_id, content_type, content_text, metadata")
    .in("course_id", courseIds);

  if (matErr) {
    return NextResponse.json({ error: matErr.message }, { status: 500 });
  }

  const byCourse = new Map<
    string,
    {
      id: string;
      name: string;
      canvas_id: number;
      materials: Array<{
        canvas_item_id: string;
        content_type: string;
        metadata: MaterialMeta;
        chunk_count: number;
        preview: string;
      }>;
    }
  >();

  for (const c of userCourses) {
    byCourse.set(c.id, {
      id: c.id,
      name: c.name,
      canvas_id: c.canvas_id,
      materials: [],
    });
  }

  const materialKey = (courseId: string, baseId: string) => `${courseId}:${baseId}`;
  const grouped = new Map<
    string,
    { metadata: MaterialMeta; chunks: string[]; content_type: string }
  >();

  for (const row of rows ?? []) {
    const baseId = baseCanvasItemId(row.canvas_item_id);
    const key = materialKey(row.course_id, baseId);
    const existing = grouped.get(key);
    if (existing) {
      existing.chunks.push(row.content_text ?? "");
    } else {
      grouped.set(key, {
        metadata: (row.metadata as MaterialMeta) ?? {},
        chunks: [row.content_text ?? ""],
        content_type: row.content_type ?? "page",
      });
    }
  }

  for (const [key, value] of Array.from(grouped.entries())) {
    const { metadata, chunks, content_type } = value;
    const [courseId, baseId] = key.split(":");
    const course = byCourse.get(courseId);
    if (!course) continue;
    const first = chunks[0] ?? "";
    const preview =
      first.slice(0, 200).replace(/\s+/g, " ").trim() + (first.length > 200 ? "…" : "");
    course.materials.push({
      canvas_item_id: baseId,
      content_type,
      metadata,
      chunk_count: chunks.length,
      preview,
    });
  }

  const courses = Array.from(byCourse.values());
  for (const c of courses) {
    c.materials.sort((a, b) =>
      (a.metadata?.title ?? a.canvas_item_id).localeCompare(
        b.metadata?.title ?? b.canvas_item_id,
        undefined,
        { sensitivity: "base" }
      )
    );
  }
  return NextResponse.json({ courses });
}
