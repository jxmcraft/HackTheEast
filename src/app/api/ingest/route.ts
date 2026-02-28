import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/utils/supabase/server";
import { createClientOrThrow } from "@/utils/supabase/server";
import { getCanvasCredentialsFromProfile } from "@/lib/canvas-credentials";
import { CanvasAPIClient, ingestCourseMaterials } from "@/lib/canvas/ingest";
import { storeCourseMaterials } from "@/lib/canvas/store";
import { makeUploadCourseFile } from "@/lib/canvas/uploadStorage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET: Return available courses from Canvas for the authenticated user.
 * Uses Canvas credentials from the user's profile.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const credentials = await getCanvasCredentialsFromProfile();
    if (!credentials?.baseUrl || !credentials?.token) {
      return NextResponse.json(
        { error: "Canvas credentials are not configured. Set the Canvas API URL and token in Settings." },
        { status: 400 }
      );
    }
    const client = new CanvasAPIClient(credentials.baseUrl, credentials.token);
    const courses = await client.getCourses();
    return NextResponse.json(courses);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch courses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST: Trigger ingestion for a Canvas course.
 * Body: { courseId: string (Canvas course id), accessToken: string, baseUrl?: string }
 * If baseUrl is omitted, profile Canvas URL is used.
 * Resolves course to internal UUID (from public.courses); creates course row if missing.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const courseId = body?.courseId ?? body?.course_id;
    const accessToken = body?.accessToken ?? body?.access_token;
    let baseUrl = body?.baseUrl ?? body?.base_url;

    if (!courseId || !accessToken) {
      return NextResponse.json(
        { error: "Missing courseId or accessToken in the request body." },
        { status: 400 }
      );
    }

    if (!baseUrl) {
      const credentials = await getCanvasCredentialsFromProfile();
      baseUrl = credentials?.baseUrl;
      if (!baseUrl) {
        return NextResponse.json(
          { error: "Missing baseUrl. Provide baseUrl in the request body or set the Canvas API URL in Settings." },
          { status: 400 }
        );
      }
    }

    const supabase = createClientOrThrow();
    const canvasId = Number(courseId);
    if (Number.isNaN(canvasId)) {
      return NextResponse.json({ error: "courseId must be a numeric Canvas course ID." }, { status: 400 });
    }

    let courseUuid: string;
    const { data: existing } = await supabase
      .from("courses")
      .select("id")
      .eq("canvas_id", canvasId)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (existing) {
      courseUuid = existing.id;
    } else {
      const client = new CanvasAPIClient(baseUrl, accessToken);
      const courses = await client.getCourses();
      const course = courses.find((c) => c.id === canvasId);
      const name = course?.name ?? `Course ${courseId}`;
      const { data: inserted, error: insertErr } = await supabase
        .from("courses")
        .insert({
          name,
          canvas_id: canvasId,
          user_id: session.user.id,
        })
        .select("id")
        .single();
      if (insertErr || !inserted) {
        return NextResponse.json(
          { error: "Could not find or create the course. Ensure you are enrolled and the courses table exists." },
          { status: 400 }
        );
      }
      courseUuid = inserted.id;
    }

    const materials = await ingestCourseMaterials(courseId, accessToken, baseUrl, {
      uploadFile: makeUploadCourseFile(supabase, courseUuid),
    });
    const { materialsStored, chunksCreated } = await storeCourseMaterials(courseUuid, materials);

    return NextResponse.json({
      success: true,
      materialsStored,
      chunksCreated,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to ingest course materials.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
