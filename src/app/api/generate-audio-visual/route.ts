import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v3";
import { getUser } from "@/utils/supabase/server";
import { createClientOrThrow } from "@/utils/supabase/server";
import { generateAudioVisualLesson } from "@/lib/ai/audioVisualGenerator";

const GenerateRequestSchema = z.object({
  topic: z.string().min(3).max(200),
  courseId: z.string().min(1),
  context: z.string().optional(),
  avatarStyle: z.enum(["strict", "encouraging", "socratic"]).optional(),
  mode: z.enum(["podcast", "slides"]).optional(),
  lessonId: z.string().uuid().optional(),
  voiceId: z.string().max(120).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = GenerateRequestSchema.safeParse(body);
    if (!parsed.success) {
      const msg =
        parsed.error?.issues?.map((i: { message?: string }) => i.message).join("; ") ||
        "Invalid request";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { topic, courseId, context, avatarStyle, mode, lessonId, voiceId } = parsed.data;
    const effectiveMode = mode ?? "podcast";

    const result = await generateAudioVisualLesson({
      topic,
      courseId,
      context,
      userId: user.id,
      avatarStyle,
      mode: effectiveMode,
      voiceId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Generation failed" },
        { status: 500 }
      );
    }

    if (lessonId && result.lesson && result.assets) {
      const supabase = createClientOrThrow();
      const { error: upsertErr } = await supabase
        .from("lesson_audio_visual")
        .upsert(
          {
            lesson_id: lessonId,
            mode: effectiveMode,
            script: result.lesson.script ?? "",
            slides: result.assets.slides ?? [],
            audio_url: result.assets.audioUrl ?? "",
            voice_id: voiceId ?? null,
            generated_at: new Date().toISOString(),
          },
          { onConflict: "lesson_id,mode" }
        );
      if (upsertErr) {
        console.error("[generate-audio-visual] Failed to save lesson_audio_visual:", upsertErr.message);
      }
    } else if (!lessonId) {
      console.warn("[generate-audio-visual] No lessonId provided; audio-visual not saved for reload.");
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[generate-audio-visual] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
