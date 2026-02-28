import { NextRequest, NextResponse } from "next/server";
import { createClientOrThrow } from "@/utils/supabase/server";
import { COURSE_FILES_BUCKET } from "@/lib/canvas/uploadStorage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    .select("id")
    .eq("user_id", user.id)
    .eq("canvas_id", courseCanvasId)
    .single();

  if (courseErr || !course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const { data: fileRow, error: fileErr } = await supabase
    .from("course_material_files")
    .select("storage_path, file_name, content_type")
    .eq("course_id", course.id)
    .eq("canvas_item_id", baseItemId)
    .maybeSingle();

  if (fileErr) {
    return NextResponse.json({ error: fileErr.message }, { status: 500 });
  }

  if (!fileRow?.storage_path) {
    return NextResponse.json({ error: "Original file not found in Supabase" }, { status: 404 });
  }

  const { data: fileData, error: downloadErr } = await supabase.storage
    .from(COURSE_FILES_BUCKET)
    .download(fileRow.storage_path);

  if (downloadErr || !fileData) {
    return NextResponse.json(
      { error: downloadErr?.message ?? "Failed to download original file" },
      { status: 500 }
    );
  }

  const arrayBuffer = await fileData.arrayBuffer();
  const safeName = (fileRow.file_name ?? baseItemId)
    .replace(/[^a-z0-9-_.]+/gi, "_")
    .replace(/^_+|_+$/g, "");

  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": fileRow.content_type ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeName || "original_file"}"`,
    },
  });
}
