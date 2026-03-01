/**
 * POST /api/reels/generate
 * Generates Instagram 15-second reels (video generation). Uses MINIMAX_API_KEY for voice + video.
 * Body: optional { courseId?, topic?, canvasItemId? }. If omitted, picks random content from
 * what the user is learning (recent lessons or course materials).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClientOrThrow } from "@/utils/supabase/server";
import { retrieveRelevantMaterials, prepareContextForLLM } from "@/lib/ai/retrieval";
import { createReelScript, createReelVisualPrompt } from "@/lib/reels/scriptFromContent";
import { generateReelCoverImage } from "@/lib/reels/reelCoverImage";
import { generateVideoFromPrompt } from "@/lib/video/minimaxVideoService";
import { generateAudioMinimax } from "@/lib/audio/minimaxTtsService";
import { uploadAudioToStorage, uploadVideoToStorage, uploadImageToStorage } from "@/lib/audio/elevenlabsService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

function baseCanvasItemId(id: string): string {
  return id.replace(/-chunk-\d+$/, "");
}

type PickedContent = { courseId: string; topic?: string; canvasItemId?: string };

/** Pick random content from user's learning: recent lessons first, then random course material. */
async function pickRandomLearningContent(
  supabase: Awaited<ReturnType<typeof createClientOrThrow>>,
  userId: string
): Promise<PickedContent | null> {
  // 1) Recent lessons (course + topic) — what they're actively learning
  const { data: lessons } = await supabase
    .from("lessons")
    .select("course_id_canvas, topic")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (lessons?.length) {
    const picked = lessons[Math.floor(Math.random() * lessons.length)];
    const topic = (picked as { topic?: string }).topic?.trim();
    const courseId = (picked as { course_id_canvas?: number }).course_id_canvas;
    if (courseId != null && topic) {
      return { courseId: String(courseId), topic };
    }
  }

  // 2) Any course with materials — pick random course and random material
  const { data: userCourses } = await supabase
    .from("courses")
    .select("id, canvas_id")
    .eq("user_id", userId);

  if (!userCourses?.length) return null;

  const courseIds = userCourses.map((c) => c.id);
  const { data: rows } = await supabase
    .from("course_materials")
    .select("course_id, canvas_item_id")
    .in("course_id", courseIds);

  if (!rows?.length) return null;

  const byBaseId = new Map<string, { course_id: string; canvas_item_id: string }>();
  for (const r of rows) {
    const baseId = baseCanvasItemId((r as { canvas_item_id: string }).canvas_item_id);
    if (!byBaseId.has(baseId)) {
      byBaseId.set(baseId, {
        course_id: (r as { course_id: string }).course_id,
        canvas_item_id: baseId,
      });
    }
  }
  const materials = Array.from(byBaseId.values());
  const mat = materials[Math.floor(Math.random() * materials.length)];
  const course = userCourses.find((c) => c.id === mat.course_id);
  if (!course) return null;

  return {
    courseId: String((course as { canvas_id: number }).canvas_id),
    canvasItemId: mat.canvas_item_id,
  };
}

async function getContentByTopic(courseId: string, topic: string, userId: string): Promise<{ content: string; title: string }> {
  const materials = await retrieveRelevantMaterials({
    courseId,
    topic,
    userId,
    limit: 8,
  });
  const content = prepareContextForLLM(materials);
  const title = materials[0]?.metadata?.title as string | undefined;
  return { content, title: title ?? topic };
}

async function getContentByMaterial(
  courseCanvasId: number,
  canvasItemId: string,
  userId: string
): Promise<{ content: string; title: string }> {
  const supabase = createClientOrThrow();
  const baseId = baseCanvasItemId(canvasItemId);

  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("id, name")
    .eq("user_id", userId)
    .eq("canvas_id", courseCanvasId)
    .single();

  if (courseErr || !course) {
    throw new Error("Course not found");
  }

  const { data: rows, error: matErr } = await supabase
    .from("course_materials")
    .select("canvas_item_id, content_text, metadata")
    .eq("course_id", course.id)
    .like("canvas_item_id", `${baseId}%`)
    .order("canvas_item_id", { ascending: true });

  if (matErr || !rows?.length) {
    throw new Error("Material not found");
  }

  const meta = (rows[0]?.metadata as { title?: string } | null) ?? {};
  const title = meta.title ?? baseId;
  const content = rows.map((r) => r.content_text ?? "").join("\n").trim();
  return { content, title };
}

export async function POST(request: NextRequest) {
  const supabase = createClientOrThrow();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { courseId?: string; topic?: string; canvasItemId?: string } = {};
  try {
    const raw = await request.json();
    if (raw && typeof raw === "object") body = raw as typeof body;
  } catch {
    // empty body is ok — we'll pick random content
  }

  let courseId = String(body.courseId ?? "").trim();
  let topic = String(body.topic ?? "").trim();
  let canvasItemId = String(body.canvasItemId ?? "").trim();

  if (!courseId || (!topic && !canvasItemId)) {
    const picked = await pickRandomLearningContent(supabase, user.id);
    if (!picked) {
      return NextResponse.json(
        { error: "No content to generate from. Sync your Canvas and complete some lessons, then try again." },
        { status: 400 }
      );
    }
    courseId = picked.courseId;
    topic = picked.topic ?? "";
    canvasItemId = picked.canvasItemId ?? "";
  }

  const courseNum = Number(courseId);
  if (Number.isNaN(courseNum)) {
    return NextResponse.json({ error: "Invalid courseId" }, { status: 400 });
  }

  let content: string;
  let title: string;

  if (canvasItemId) {
    try {
      const result = await getContentByMaterial(courseNum, canvasItemId, user.id);
      content = result.content;
      title = result.title;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 404 });
    }
  } else if (topic) {
    try {
      const result = await getContentByTopic(courseId, topic, user.id);
      content = result.content;
      title = result.title;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } else {
    return NextResponse.json(
      { error: "Provide either topic or canvasItemId to generate a reel from canvas content." },
      { status: 400 }
    );
  }

  if (!content || content.length < 50) {
    return NextResponse.json(
      { error: "Not enough content to generate a reel. Sync more materials or choose a different topic." },
      { status: 400 }
    );
  }

  try {
    const script = await createReelScript(content, topic || undefined);
    // Flow: generate MP3 and MP4 separately, upload both; client plays them together with one button (no ffmpeg).
    if (!script?.trim()) {
      return NextResponse.json({ error: "Failed to generate reel script." }, { status: 500 });
    }

    if (!process.env.MINIMAX_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "MiniMax is not configured. Add MINIMAX_API_KEY to generate Instagram 15-second reels (video generation)." },
        { status: 503 }
      );
    }

    // Step 1: Generate MP3 (voiceover) and upload for download
    const mp3Buffer = await generateAudioMinimax(script);
    if (!mp3Buffer || mp3Buffer.length === 0) {
      return NextResponse.json(
        { error: "MiniMax voice generation failed. Check MINIMAX_API_KEY and quota." },
        { status: 502 }
      );
    }

    const reelId = `reel_${courseId}_${Date.now()}`;
    const audioUrl = await uploadAudioToStorage(mp3Buffer, reelId);

    const words = script.split(/\s+/).filter(Boolean).length;
    const durationSec = Math.ceil((words / 2.5));

    let videoUrl = "";
    let imageUrl = "";
    const reelTitle = title || "Study reel";

    // Step 2: Generate MP4 (video), upload raw file — client will play MP4 + MP3 together (no ffmpeg)
    try {
      const visualPrompt = await createReelVisualPrompt(reelTitle, script);
      const mp4Buffer = await generateVideoFromPrompt(visualPrompt, { duration: 10, resolution: "768P" });
      if (mp4Buffer && mp4Buffer.length > 0) {
        videoUrl = await uploadVideoToStorage(mp4Buffer, reelId);
      }
    } catch (minimaxErr) {
      console.warn("[reels/generate] MiniMax video skipped:", minimaxErr instanceof Error ? minimaxErr.message : minimaxErr);
    }

    // Fallback: upload cover image so client can show image + play MP3 with one button
    if (!videoUrl) {
      try {
        const coverImage = await generateReelCoverImage(reelTitle, script);
        if (coverImage && coverImage.length > 0) {
          imageUrl = await uploadImageToStorage(coverImage, reelId);
        }
      } catch (imgErr) {
        console.warn("[reels/generate] Cover image skipped:", imgErr instanceof Error ? imgErr.message : imgErr);
      }
    }

    return NextResponse.json({
      script,
      audioUrl,
      videoUrl: videoUrl || undefined,
      imageUrl: imageUrl || undefined,
      title: reelTitle,
      durationSec,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[reels/generate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
