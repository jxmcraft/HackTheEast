import { NextRequest, NextResponse } from "next/server";
import { createClientOrThrow } from "@/utils/supabase/server";
import { getRecommendedNextSteps } from "@/lib/memory/recommendations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = createClientOrThrow();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id") ?? undefined;
  const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10) || 10));

  const recommendations = await getRecommendedNextSteps(supabase, user.id, courseId, limit);
  return NextResponse.json({ recommendations });
}
