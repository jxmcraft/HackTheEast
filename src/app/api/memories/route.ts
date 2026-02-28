/**
 * Phase 5: Learning memories API.
 * GET: list user memories (with optional filter/sort).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClientOrThrow } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = createClientOrThrow();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? undefined;
  const sort = searchParams.get("sort") ?? "importance"; // importance | date
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10) || 100));

  let query = supabase
    .from("user_memories")
    .select("id, memory_type, content, importance_score, source_lesson_id, created_at, last_accessed")
    .eq("user_id", user.id);

  if (type) {
    query = query.eq("memory_type", type);
  }

  if (sort === "date") {
    query = query.order("created_at", { ascending: false });
  } else {
    query = query.order("importance_score", { ascending: false }).order("created_at", { ascending: false });
  }

  const { data, error } = await query.limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ memories: data ?? [] });
}
