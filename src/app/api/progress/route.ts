/**
 * Phase 5: Learning progress API.
 * GET: progress by course, recent sessions, memory summary, streak.
 */

import { NextResponse } from "next/server";
import { createClientOrThrow } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Compute current streak (consecutive days with at least one study session ending today or yesterday). */
function computeStreak(sessionDates: string[]): number {
  const daySet = new Set(sessionDates);
  const today = new Date();
  let streak = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  while (daySet.has(toLocalDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function GET() {
  const supabase = createClientOrThrow();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [
    { data: progressRows },
    { data: sessionRows },
    { data: memoryRows },
    { data: lessons },
  ] = await Promise.all([
    supabase
      .from("learning_progress")
      .select("id, course_id, topic, status, interactions_count, last_activity")
      .eq("user_id", user.id)
      .order("last_activity", { ascending: false }),
    supabase
      .from("study_sessions")
      .select("id, course_id, topic, started_at, ended_at, lessons_generated, questions_asked, rating")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(20),
    supabase
      .from("user_memories")
      .select("id, memory_type, importance_score")
      .eq("user_id", user.id),
    supabase
      .from("lessons")
      .select("id, status, created_at")
      .eq("user_id", user.id),
  ]);

  const progressList = (progressRows ?? []) as Array<{
    id: string;
    course_id: string;
    topic: string;
    status: string;
    interactions_count: number;
    last_activity: string;
  }>;
  const sessions = (sessionRows ?? []) as Array<{
    id: string;
    course_id: string | null;
    topic: string | null;
    started_at: string;
    ended_at: string | null;
    lessons_generated: number;
    questions_asked: number;
    rating: number | null;
  }>;
  const memories = (memoryRows ?? []) as Array<{ id: string; memory_type: string; importance_score: number }>;
  const lessonList = (lessons ?? []) as Array<{ id: string; status: string; created_at: string }>;

  const completedLessons = lessonList.filter((l) => l.status === "completed");
  const sessionDates = sessions.map((s) => toLocalDateKey(new Date(s.started_at)));
  const streak = computeStreak(sessionDates);

  const totalStudyMinutes = sessions.reduce((acc, s) => {
    if (s.ended_at) {
      const start = new Date(s.started_at).getTime();
      const end = new Date(s.ended_at).getTime();
      acc += Math.max(0, (end - start) / (60 * 1000));
    }
    return acc;
  }, 0);

  const topicsMastered = progressList.filter((p) => p.status === "mastered").length;
  const topicsStruggling = progressList.filter((p) => p.status === "struggling").length;

  const progressByCourse = progressList.reduce<
    Record<
      string,
      {
        courseId: string;
        topics: Array<{ topic: string; status: string; interactions_count: number; last_activity: string }>;
        mastered: number;
        inProgress: number;
        struggling: number;
        notStarted: number;
      }
    >
  >((acc, p) => {
    const cid = p.course_id;
    if (!acc[cid]) {
      acc[cid] = {
        courseId: cid,
        topics: [],
        mastered: 0,
        inProgress: 0,
        struggling: 0,
        notStarted: 0,
      };
    }
    acc[cid].topics.push({
      topic: p.topic,
      status: p.status,
      interactions_count: p.interactions_count,
      last_activity: p.last_activity,
    });
    if (p.status === "mastered") acc[cid].mastered += 1;
    else if (p.status === "in_progress") acc[cid].inProgress += 1;
    else if (p.status === "struggling") acc[cid].struggling += 1;
    else acc[cid].notStarted += 1;
    return acc;
  }, {});

  const memorySummary = {
    total: memories.length,
    byType: memories.reduce<Record<string, number>>((acc, m) => {
      acc[m.memory_type] = (acc[m.memory_type] ?? 0) + 1;
      return acc;
    }, {}),
  };

  return NextResponse.json({
    overall: {
      totalStudyMinutes: Math.round(totalStudyMinutes),
      lessonsCompleted: completedLessons.length,
      topicsMastered,
      topicsStruggling,
      currentStreakDays: streak,
    },
    progressByCourse: Object.values(progressByCourse),
    recentSessions: sessions.slice(0, 10).map((s) => ({
      id: s.id,
      courseId: s.course_id,
      topic: s.topic,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      lessonsGenerated: s.lessons_generated,
      questionsAsked: s.questions_asked,
      rating: s.rating,
    })),
    memorySummary,
  });
}
