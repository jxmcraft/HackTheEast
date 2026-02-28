import { NextRequest, NextResponse } from "next/server";
import { createClientOrThrow } from "@/utils/supabase/server";
import { generateAudioMinimax } from "@/lib/audio/minimaxTtsService";
import { uploadAudioToStorage } from "@/lib/audio/elevenlabsService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/lessons/[id]/audio-visual/add-narrator
 * Generate narrator audio for an existing slide deck (mode=slides) that has script but no audio_url.
 * Uses MiniMax TTS and updates lesson_audio_visual. Returns the new audioUrl.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lessonId } = await params;
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

  const { data: row, error: fetchErr } = await supabase
    .from("lesson_audio_visual")
    .select("script, audio_url")
    .eq("lesson_id", lessonId)
    .eq("mode", "slides")
    .single();

  if (fetchErr || !row) {
    return NextResponse.json(
      { error: "No slide deck found for this lesson" },
      { status: 404 }
    );
  }

  const script = typeof row.script === "string" ? row.script.trim() : "";
  if (!script) {
    return NextResponse.json(
      { error: "Slide deck has no script to generate audio from" },
      { status: 400 }
    );
  }

  let voiceId: string | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    voiceId = typeof (body as { voiceId?: string }).voiceId === "string"
      ? (body as { voiceId: string }).voiceId
      : undefined;
  } catch {
    // ignore
  }

  const audioBuffer = await generateAudioMinimax(script, voiceId);
  if (!audioBuffer) {
    return NextResponse.json(
      { error: "Narrator audio generation failed. Check MINIMAX_API_KEY and try again." },
      { status: 502 }
    );
  }

  let audioUrl: string;
  try {
    audioUrl = await uploadAudioToStorage(audioBuffer, lessonId);
  } catch (uploadErr) {
    const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
    console.error("[add-narrator] Upload failed:", msg);
    return NextResponse.json(
      { error: `Audio upload failed: ${msg}` },
      { status: 502 }
    );
  }

  const { error: updateErr } = await supabase
    .from("lesson_audio_visual")
    .update({
      audio_url: audioUrl,
      voice_id: voiceId ?? null,
      generated_at: new Date().toISOString(),
    })
    .eq("lesson_id", lessonId)
    .eq("mode", "slides");

  if (updateErr) {
    console.error("[add-narrator] Failed to update row:", updateErr.message);
    return NextResponse.json(
      { error: "Failed to save narrator audio" },
      { status: 500 }
    );
  }

  return NextResponse.json({ audioUrl });
}
