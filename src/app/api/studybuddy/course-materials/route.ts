/**
 * GET /api/studybuddy/course-materials?courseId=...&topic=...
 * Returns Canvas course materials relevant to the topic for use in StudyBuddy when opened from a lesson.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClientOrThrow } from "@/utils/supabase/server";
import { retrieveRelevantMaterials, prepareContextForLLM } from "@/lib/ai/retrieval";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = createClientOrThrow();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId")?.trim();
  const topic = searchParams.get("topic")?.trim();
  if (!courseId || !topic) {
    return NextResponse.json(
      { error: "courseId and topic are required" },
      { status: 400 }
    );
  }

  try {
    const materials = await retrieveRelevantMaterials({
      courseId,
      topic,
      userId: user.id,
      limit: 10,
    });
    const content = prepareContextForLLM(materials);
    const seen = new Set<string>();
    const sources: { title: string; url?: string; content_type?: string }[] = [];
    for (const m of materials) {
      const title = (m.metadata?.title as string)?.trim() || (m.metadata?.content_type as string) || "Course material";
      const url = (m.metadata?.url as string)?.trim() || undefined;
      const content_type = (m.metadata?.content_type as string) || undefined;
      const key = `${title}|${url ?? ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        sources.push({ title, url, content_type });
      }
    }
    return NextResponse.json({ content, sources });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load course materials.";
    return NextResponse.json({ error: message, content: "" }, { status: 500 });
  }
}
