/**
 * Phase 5: Smart recommendations — what to study next.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type RecommendationType = "review" | "new_topic" | "practice";

export type Recommendation = {
  type: RecommendationType;
  topic: string;
  courseId: string;
  reason: string;
  priority: number;
  progressId?: string;
};

type ProgressRow = {
  id: string;
  course_id: string;
  topic: string;
  status: string;
  last_activity: string;
};

/**
 * Get recommended next steps for a user in a course (or across courses if courseId omitted).
 * Prioritizes: struggling topics (review), then in_progress not revisited recently, then new topics.
 */
export async function getRecommendedNextSteps(
  supabase: SupabaseClient,
  userId: string,
  courseId?: string,
  limit: number = 10
): Promise<Recommendation[]> {
  let query = supabase
    .from("learning_progress")
    .select("id, course_id, topic, status, last_activity")
    .eq("user_id", userId)
    .order("last_activity", { ascending: false });

  if (courseId) {
    query = query.eq("course_id", courseId);
  }

  const { data: rows, error } = await query.limit(limit * 2);
  if (error) return [];

  const progress = (rows ?? []) as ProgressRow[];
  const recommendations: Recommendation[] = [];
  const seen = new Set<string>();

  const key = (c: string, t: string) => `${c}:${t}`;

  // 1. Struggling — high priority review
  for (const p of progress) {
    if (p.status !== "struggling") continue;
    const k = key(p.course_id, p.topic);
    if (seen.has(k)) continue;
    seen.add(k);
    recommendations.push({
      type: "review",
      topic: p.topic,
      courseId: p.course_id,
      reason: "You struggled with this before — a quick review can help.",
      priority: 10,
      progressId: p.id,
    });
  }

  // 2. In progress, not revisited in 7+ days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  for (const p of progress) {
    if (p.status !== "in_progress") continue;
    const k = key(p.course_id, p.topic);
    if (seen.has(k)) continue;
    const last = new Date(p.last_activity);
    if (last >= sevenDaysAgo) continue;
    seen.add(k);
    recommendations.push({
      type: "practice",
      topic: p.topic,
      courseId: p.course_id,
      reason: "You haven't practiced this in a while.",
      priority: 7,
      progressId: p.id,
    });
  }

  // 3. Not started (as "new_topic") — only if we have room and know course
  for (const p of progress) {
    if (p.status !== "not_started") continue;
    const k = key(p.course_id, p.topic);
    if (seen.has(k)) continue;
    seen.add(k);
    recommendations.push({
      type: "new_topic",
      topic: p.topic,
      courseId: p.course_id,
      reason: "New topic to explore.",
      priority: 5,
      progressId: p.id,
    });
  }

  recommendations.sort((a, b) => b.priority - a.priority);
  return recommendations.slice(0, limit);
}
