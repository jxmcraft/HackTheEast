import { NextRequest, NextResponse } from "next/server";
import { createClientOrThrow } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lessonId } = await params;
  const { searchParams } = new URL(_request.url);
  const mode = searchParams.get("mode");
  if (mode !== "podcast" && mode !== "slides") {
    return NextResponse.json(
      { error: "Query param mode must be 'podcast' or 'slides'" },
      { status: 400 }
    );
  }

  const supabase = createClientOrThrow();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id")
    .eq("id", lessonId)
    .eq("user_id", user.id)
    .single();
  if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

  const { data: row, error } = await supabase
    .from("lesson_audio_visual")
    .select("script, slides, audio_url, voice_id")
    .eq("lesson_id", lessonId)
    .eq("mode", mode)
    .single();

  if (error || !row) {
    return NextResponse.json(
      { error: "No audio-visual saved for this lesson and mode" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    script: row.script ?? "",
    slides: row.slides ?? [],
    audioUrl: row.audio_url ?? "",
    voiceId: row.voice_id ?? undefined,
  });
}
