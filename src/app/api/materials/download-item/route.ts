import { NextRequest, NextResponse } from "next/server";
import { createClientOrThrow } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function baseCanvasItemId(canvasItemId: string): string {
  return canvasItemId.replace(/-chunk-\d+$/, "");
}

type MaterialMeta = {
  title?: string;
  [key: string]: unknown;
};

export async function GET(request: NextRequest) {
  const supabase = createClientOrThrow();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const courseCanvasIdRaw = request.nextUrl.searchParams.get("course_canvas_id");
  const canvasItemIdRaw = request.nextUrl.searchParams.get("canvas_item_id");
  const courseCanvasId = Number(courseCanvasIdRaw);
  if (!courseCanvasIdRaw || Number.isNaN(courseCanvasId) || !canvasItemIdRaw) {
    return NextResponse.json(
      { error: "course_canvas_id and canvas_item_id are required" },
      { status: 400 }
    );
  }

  const baseItemId = baseCanvasItemId(canvasItemIdRaw);

  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("id, name")
    .eq("user_id", user.id)
    .eq("canvas_id", courseCanvasId)
    .single();

  if (courseErr || !course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const { data: rows, error: matErr } = await supabase
    .from("course_materials")
    .select("canvas_item_id, content_text, metadata")
    .eq("course_id", course.id)
    .like("canvas_item_id", `${baseItemId}%`)
    .order("canvas_item_id", { ascending: true });

  if (matErr) {
    return NextResponse.json({ error: matErr.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }

  const firstMeta = (rows[0]?.metadata as MaterialMeta | null) ?? {};
  const title = firstMeta.title ?? baseItemId;
  const fullText = rows.map((row) => row.content_text ?? "").join("\n").trim();
  const safeTitle = String(title).replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "");

  return new NextResponse(fullText || "(No text content)", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeTitle || "material"}.txt"`,
    },
  });
}
