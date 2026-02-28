/**
 * Phase 5: When student marks lesson progress (understood / need_review), update
 * learning_progress, record study session, and run memory extraction in background.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClientOrThrow } from "@/utils/supabase/server";
import { extractMemoriesFromLesson, saveMemories } from "@/lib/memory/extractor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function contentToSummary(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") return content.slice(0, 2000);
  if (typeof content === "object") {
    const o = content as Record<string, unknown>;
    if (typeof o.body === "string") return o.body.slice(0, 2000);
    if (typeof o.script === "string") return o.script.slice(0, 2000);
    if (Array.isArray(o.slides)) {
      const text = (o.slides as Array<{ title?: string; content?: string }>)
        .map((s) => [s.title, s.content].filter(Boolean).join(" "))
        .join("\n");
      return text.slice(0, 2000);
    }
    return JSON.stringify(content).slice(0, 2000);
  }
  return String(content).slice(0, 2000);
}

export async function POST(request: NextRequest) {
  const supabase = createClientOrThrow();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const lessonId = typeof body.lessonId === "string" ? body.lessonId.trim() : null;
  const progress = body.progress === "understood" || body.progress === "need_review" ? body.progress : null;
  if (!lessonId || !progress) {
    return NextResponse.json(
      { error: "lessonId and progress (understood | need_review) required" },
      { status: 400 }
    );
  }

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, topic, course_id_canvas, content, created_at")
    .eq("id", lessonId)
    .eq("user_id", user.id)
    .single();

  if (lessonError || !lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const courseId = String(lesson.course_id_canvas);
  const status = progress === "understood" ? "mastered" : "struggling";
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("learning_progress")
    .select("id, interactions_count")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .eq("topic", lesson.topic)
    .maybeSingle();

  if (existing?.id) {
    const { error: updateErr } = await supabase
      .from("learning_progress")
      .update({
        status,
        last_activity: now,
        interactions_count: (existing.interactions_count ?? 0) + 1,
      })
      .eq("id", existing.id);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  } else {
    const { error: insertErr } = await supabase.from("learning_progress").insert({
      user_id: user.id,
      course_id: courseId,
      topic: lesson.topic,
      status,
      last_activity: now,
      interactions_count: 1,
    });
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  await supabase.from("study_sessions").insert({
    user_id: user.id,
    course_id: courseId,
    topic: lesson.topic,
    started_at: lesson.created_at,
    ended_at: new Date().toISOString(),
    lessons_generated: 1,
    questions_asked: 0,
  });

  const { data: chatRows } = await supabase
    .from("lesson_chat")
    .select("role, content")
    .eq("lesson_id", lessonId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const chatHistory = (chatRows ?? []).map((r) => ({
    role: r.role as "user" | "tutor",
    content: r.content ?? "",
  }));

  const contentSummary = contentToSummary(lesson.content);
  const lessonForExtraction = {
    id: lesson.id,
    topic: lesson.topic,
    contentSummary: contentSummary || lesson.topic,
  };

  extractMemoriesFromLesson(lessonForExtraction, chatHistory)
    .then((memories) => saveMemories(supabase, user.id, memories))
    .catch((err) => console.error("Memory extraction failed:", err));

  return NextResponse.json({ success: true });
}
