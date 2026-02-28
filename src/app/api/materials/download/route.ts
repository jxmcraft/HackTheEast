import { NextRequest, NextResponse } from "next/server";
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

export async function GET(request: NextRequest) {
  const supabase = createClientOrThrow();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const courseCanvasIdRaw = request.nextUrl.searchParams.get("course_canvas_id");
  const courseCanvasId = Number(courseCanvasIdRaw);
  if (!courseCanvasIdRaw || Number.isNaN(courseCanvasId)) {
    return NextResponse.json({ error: "course_canvas_id is required" }, { status: 400 });
  }

  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("id, name, canvas_id")
    .eq("user_id", user.id)
    .eq("canvas_id", courseCanvasId)
    .single();

  if (courseErr || !course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const { data: rows, error: matErr } = await supabase
    .from("course_materials")
    .select("canvas_item_id, content_type, content_text, metadata")
    .eq("course_id", course.id)
    .order("canvas_item_id", { ascending: true });

  if (matErr) {
    return NextResponse.json({ error: matErr.message }, { status: 500 });
  }

  const grouped = new Map<string, { contentType: string; metadata: MaterialMeta; chunks: string[] }>();
  for (const row of rows ?? []) {
    const baseId = baseCanvasItemId(row.canvas_item_id);
    const existing = grouped.get(baseId);
    if (!existing) {
      grouped.set(baseId, {
        contentType: row.content_type ?? "page",
        metadata: (row.metadata as MaterialMeta) ?? {},
        chunks: [row.content_text ?? ""],
      });
    } else {
      existing.chunks.push(row.content_text ?? "");
    }
  }

  const lines: string[] = [];
  lines.push(`Course: ${course.name}`);
  lines.push(`Canvas ID: ${course.canvas_id}`);
  lines.push(`Exported: ${new Date().toISOString()}`);
  lines.push("");

  const materials = Array.from(grouped.entries()).sort((a, b) => {
    const aTitle = a[1].metadata.title ?? a[0];
    const bTitle = b[1].metadata.title ?? b[0];
    return aTitle.localeCompare(bTitle, undefined, { sensitivity: "base" });
  });

  for (const [baseId, material] of materials) {
    const title = material.metadata.title ?? baseId;
    const fullText = material.chunks.join("\n").trim();
    lines.push("=".repeat(80));
    lines.push(`Title: ${title}`);
    lines.push(`Type: ${material.contentType}`);
    if (material.metadata.module_name) lines.push(`Module: ${material.metadata.module_name}`);
    if (material.metadata.url) lines.push(`URL: ${material.metadata.url}`);
    lines.push("-");
    lines.push(fullText || "(No text content)");
    lines.push("");
  }

  const body = lines.join("\n");
  const safeName = course.name.replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName || "course"}_materials.txt"`,
    },
  });
}
