import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("lessons")
    .select("id, course_id_canvas, course_name, topic, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const courseIdCanvas = Number(body.course_id_canvas);
  const courseName = String(body.course_name ?? "").trim();
  const topic = String(body.topic ?? "").trim();
  const context = String(body.context ?? "").trim() || null;
  if (!Number.isInteger(courseIdCanvas) || !topic) {
    return NextResponse.json({ error: "course_id_canvas and topic required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lessons")
    .insert({
      user_id: user.id,
      course_id_canvas: courseIdCanvas,
      course_name: courseName || null,
      topic,
      context,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
