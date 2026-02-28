/**
 * User bookmarks: lesson bookmarks, progress (understood/need_review), notes.
 * GET: list for user (optional lessonId filter). POST: create.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClientOrThrow } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const supabase = createClientOrThrow();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get("lessonId");
    const type = searchParams.get("type");
    let q = supabase
      .from("user_bookmarks")
      .select("id, lesson_id, type, content, meta, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (lessonId) q = q.eq("lesson_id", lessonId);
    if (type) q = q.eq("type", type);
    const { data, error } = await q.limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, items: data ?? [] });
  } catch (err) {
    console.error("bookmarks GET error:", err);
    return NextResponse.json({ error: "Failed to load bookmarks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClientOrThrow();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const type = body.type as string;
    const lessonId = body.lessonId as string | null;
    const content = (body.content as string) ?? "";
    const meta = body.meta as Record<string, unknown> | undefined;
    if (!["highlight", "note", "bookmark"].includes(type)) {
      return NextResponse.json({ error: "type must be highlight, note, or bookmark" }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("user_bookmarks")
      .insert({
        user_id: user.id,
        lesson_id: lessonId || null,
        type,
        content: content.slice(0, 10000),
        meta: meta ?? null,
      })
      .select("id, lesson_id, type, content, meta, created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, item: data });
  } catch (err) {
    console.error("bookmarks POST error:", err);
    return NextResponse.json({ error: "Failed to save bookmark" }, { status: 500 });
  }
}
