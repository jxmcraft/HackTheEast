/**
 * Phase 5: Retrieve and format memories for LLM context injection.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type UserMemoryRow = {
  id: string;
  memory_type: string;
  content: string;
  importance_score: number;
  source_lesson_id: string | null;
  created_at: string;
};

/**
 * Fetch highest-importance memories for the user, ordered by importance and last_accessed.
 */
export async function getContextualMemories(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 5
): Promise<UserMemoryRow[]> {
  const { data, error } = await supabase
    .from("user_memories")
    .select("id, memory_type, content, importance_score, source_lesson_id, created_at")
    .eq("user_id", userId)
    .order("importance_score", { ascending: false })
    .order("last_accessed", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as UserMemoryRow[];
}

/**
 * Format memories for inclusion in an LLM system prompt.
 */
export function formatMemoriesForPrompt(memories: UserMemoryRow[]): string {
  if (memories.length === 0) return "";
  const lines = memories.map(
    (m) => `- (Importance: ${m.importance_score}) [${m.memory_type}] ${m.content}`
  );
  return `Previous Learning History:\n${lines.join("\n")}`;
}
