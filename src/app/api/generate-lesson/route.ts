/**
 * POST /api/generate-lesson
 * Generate a lesson (text, slides, or audio) with tiered fallback when materials are missing.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClientOrThrow } from "@/utils/supabase/server";
import { generateLessonWithFallback, getCourseUuid } from "@/lib/ai/lessonFallback";
import type { LearningMode } from "@/lib/ai/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type GenerateBody = {
  courseId: string;
  topic: string;
  context?: string;
  mode?: LearningMode;
  lessonId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = createClientOrThrow();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as GenerateBody;
    let courseId = String(body.courseId ?? "").trim();
    let topic = String(body.topic ?? "").trim();
    let contextHint = String(body.context ?? "").trim() || undefined;
    const mode: LearningMode = ["text", "slides", "audio"].includes(body.mode ?? "")
      ? (body.mode as LearningMode)
      : "text";
    const lessonId = typeof body.lessonId === "string" ? body.lessonId : null;

    if (lessonId && (!courseId || !topic)) {
      const { data: lesson } = await supabase
        .from("lessons")
        .select("course_id_canvas, topic, context")
        .eq("id", lessonId)
        .eq("user_id", user.id)
        .single();
      if (lesson) {
        courseId = String(lesson.course_id_canvas);
        topic = String(lesson.topic ?? "").trim();
        if (lesson.context) contextHint = String(lesson.context).trim() || undefined;
      }
    }

    if (!courseId || !topic) {
      return NextResponse.json(
        { error: "courseId and topic are required" },
        { status: 400 }
      );
    }

    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("learning_mode, avatar_style, avatar_name")
      .eq("id", user.id)
      .single();

    const preferences = {
      learning_mode: (prefs?.learning_mode as LearningMode) ?? mode,
      avatar_style: (prefs?.avatar_style as "strict" | "encouraging" | "socratic") ?? "encouraging",
      avatar_name: prefs?.avatar_name ?? null,
    };

    const result = await generateLessonWithFallback({
      topic,
      courseId,
      userId: user.id,
      contextHint,
      mode,
      preferences,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Lesson generation failed" },
        { status: 500 }
      );
    }

    const updatePayload = {
      status: "completed" as const,
      learning_mode: mode,
      content: result.content,
      sources: result.sources,
      fallback_used: result.fallbackUsed,
      retrieval_score: result.retrievalScore ?? null,
      source_count: result.sourceCount ?? null,
      updated_at: new Date().toISOString(),
    };

    let finalLessonId: string;
    if (lessonId) {
      const { error: updateErr } = await supabase
        .from("lessons")
        .update(updatePayload)
        .eq("id", lessonId)
        .eq("user_id", user.id);
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
      finalLessonId = lessonId;
    } else {
      const courseUuid = await getCourseUuid(courseId, user.id);
      const { data: courseRow } = courseUuid
        ? await supabase.from("courses").select("name").eq("id", courseUuid).single()
        : { data: null };
      const { data: inserted, error: insertErr } = await supabase
        .from("lessons")
        .insert({
          user_id: user.id,
          course_id_canvas: Number(courseId),
          course_name: courseRow?.name ?? null,
          topic,
          context: contextHint ?? null,
          status: "completed",
          learning_mode: mode,
          content: result.content,
          sources: result.sources,
          fallback_used: result.fallbackUsed,
          retrieval_score: result.retrievalScore ?? null,
          source_count: result.sourceCount ?? null,
        })
        .select("id")
        .single();
      if (insertErr || !inserted) {
        return NextResponse.json({ error: insertErr?.message ?? "Failed to save lesson" }, { status: 500 });
      }
      finalLessonId = inserted.id;
    }

    return NextResponse.json({
      success: true,
      lessonId: finalLessonId,
      mode,
      content: result.content,
      sources: result.sources,
      fallbackUsed: result.fallbackUsed,
      disclaimer: result.disclaimer ?? null,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lesson generation failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
