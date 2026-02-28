/**
 * POST /api/sync
 * Fetch courses and assignments from Canvas, persist them, and ingest each course
 * into agent memory (course_materials: pages, files, links, PDF/PPTX).
 * When SUPABASE_SERVICE_ROLE_KEY is set: returns 202 and runs ingest in background; poll GET /api/sync/status for progress.
 * Otherwise: runs full sync in request and returns 200 when done.
 */

import { appendFileSync } from "fs";
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { getCanvasCredentialsFromProfile } from "@/lib/canvas-credentials";
import {
  startSyncProgress,
  resumeSyncProgress,
  updateSyncProgress,
  completeSyncProgress,
  failSyncProgress,
  getSyncProgress,
  getResumeCourseIndex,
} from "@/lib/sync-progress-db";
import type { CanvasCourse, CanvasAssignment } from "@/lib/canvas";
import { getServiceRoleEnv } from "@/utils/supabase/env";

// #region agent log
(() => { try { appendFileSync("/Users/symok/Desktop/HTE/.cursor/debug-1f53d4.log", JSON.stringify({ sessionId: "1f53d4", hypothesisId: "H1-server", location: "sync/route", message: "sync route module loaded", timestamp: Date.now() }) + "\n"); } catch (_) {} })();
// #endregion

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/** GET: Return stored courses and assignments from Supabase (persisted after sync). */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: userCourses, error: coursesErr } = await supabase
    .from("courses")
    .select("id, name, canvas_id, course_code")
    .eq("user_id", user.id)
    .order("name");

  if (coursesErr) {
    return NextResponse.json({ error: coursesErr.message }, { status: 500 });
  }

  const courseIds = (userCourses ?? []).map((c) => c.id);
  const { data: assignRows, error: assignErr } = await supabase
    .from("assignments")
    .select("id, name, description, due_date, course_id, canvas_assignment_id")
    .in("course_id", courseIds)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (assignErr) {
    return NextResponse.json({ error: assignErr.message }, { status: 500 });
  }

  const byCourseId = new Map((userCourses ?? []).map((c) => [c.id, c]));

  const assignments = (assignRows ?? []).map((a) => {
    const course = byCourseId.get(a.course_id);
    return {
      id: a.canvas_assignment_id,
      name: a.name,
      description: a.description,
      due_at: a.due_date ?? null,
      course_id: course?.canvas_id ?? 0,
    };
  });

  return NextResponse.json({
    courses: (userCourses ?? []).map((c) => ({
      id: c.canvas_id,
      name: c.name,
      course_code: c.course_code ?? undefined,
    })),
    assignments,
  });
}

export async function POST() {
  try {
    // #region agent log
    try { appendFileSync("/Users/symok/Desktop/HTE/.cursor/debug-1f53d4.log", JSON.stringify({ sessionId: "1f53d4", hypothesisId: "H1-server", location: "sync/route:POST", message: "POST /api/sync entered", data: {}, timestamp: Date.now() }) + "\n"); } catch (_) {}
    fetch('http://127.0.0.1:7816/ingest/dcfe79ee-b938-4a53-8e78-211d2e2b322f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1f53d4'},body:JSON.stringify({sessionId:'1f53d4',hypothesisId:'H1-server',location:'sync/route:POST',message:'POST /api/sync entered',data:{},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const { syncCourses, syncAssignments } = await import("@/lib/canvas");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const credentials = await getCanvasCredentialsFromProfile();
    if (!credentials?.baseUrl || !credentials?.token) {
      return NextResponse.json(
        { error: "Canvas credentials are not configured. Set the Canvas API URL and token in Settings." },
        { status: 400 }
      );
    }

    let canvasCourses: CanvasCourse[];
    let canvasAssignments: CanvasAssignment[];
    try {
      canvasCourses = await syncCourses(credentials);
      canvasAssignments = await syncAssignments(credentials);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Canvas sync failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    for (const c of canvasCourses) {
      const { error: courseErr } = await supabase
        .from("courses")
        .upsert(
          {
            name: c.name,
            canvas_id: c.id,
            user_id: user.id,
            course_code: c.course_code ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "canvas_id,user_id" }
        );
      if (courseErr) {
        return NextResponse.json({ error: courseErr.message }, { status: 500 });
      }
    }

    const { data: userCourses } = await supabase
      .from("courses")
      .select("id, canvas_id")
      .eq("user_id", user.id)
      .in("canvas_id", canvasCourses.map((c) => c.id));

    const canvasIdToUuid = new Map<number, string>();
    for (const row of userCourses ?? []) {
      canvasIdToUuid.set(row.canvas_id, row.id);
    }

    for (const a of canvasAssignments) {
      const courseUuid = canvasIdToUuid.get(a.course_id);
      if (!courseUuid) continue;
      const dueDate = a.due_at ? new Date(a.due_at).toISOString() : null;
      const { error: assignErr } = await supabase.from("assignments").upsert(
        {
          course_id: courseUuid,
          canvas_assignment_id: a.id,
          name: a.name,
          description: a.description ?? null,
          due_date: dueDate,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "course_id,canvas_assignment_id" }
      );
      if (assignErr) {
        return NextResponse.json({ error: assignErr.message }, { status: 500 });
      }
    }

    await supabase
      .from("profiles")
      .update({ last_canvas_sync_at: new Date().toISOString() })
      .eq("id", user.id);

    let hasServiceRole = false;
    try {
      getServiceRoleEnv();
      hasServiceRole = true;
    } catch {
      // Run ingest in request when service role not configured
    }

    if (hasServiceRole) {
      const resume = await getResumeCourseIndex(supabase, user.id);
      const startFromIndex = resume.startFromIndex;
      if (startFromIndex > 0) {
        await resumeSyncProgress(supabase, user.id, canvasCourses.length, startFromIndex);
      } else {
        await startSyncProgress(supabase, user.id, canvasCourses.length);
      }
      const credentialsCopy = { ...credentials };
      const canvasIdToUuidMap = new Map(canvasIdToUuid);
      const startedAt = new Date().toISOString();
      let totalMaterialsStored = resume.materialsStored;
      let totalChunksCreated = resume.chunksCreated;
      void (async () => {
        const { ingestCourseMaterials } = await import("@/lib/canvas/ingest");
        const { storeCourseMaterials } = await import("@/lib/canvas/store");
        const serviceSupabase = createServiceRoleClient();
        const ingestResults: { courseId: number; materialsStored: number; chunksCreated: number }[] = [];
        try {
          for (let i = startFromIndex; i < canvasCourses.length; i++) {
            const progress = await getSyncProgress(serviceSupabase, user.id);
            if (progress?.sync_status !== "running") break;
            const c = canvasCourses[i];
            const courseUuid = canvasIdToUuidMap.get(c.id);
            if (!courseUuid) continue;
            await updateSyncProgress(serviceSupabase, user.id, {
              phase: "ingest",
              courseIndex: i,
              courseTotal: canvasCourses.length,
              message: `Ingesting ${c.name}…`,
              currentCourseMaterials: 0,
              currentCourseChunks: 0,
            });
            let currentCourseMaterials = 0;
            let currentCourseChunks = 0;
            try {
              await ingestCourseMaterials(
                String(c.id),
                credentialsCopy.token!,
                credentialsCopy.baseUrl!,
                {
                  onItemRead: (msg, idx, total) => {
                    void updateSyncProgress(serviceSupabase, user.id, {
                      message: `Ingesting ${c.name}: ${msg} (${idx + 1}/${total})`,
                    });
                  },
                  onMaterialIngested: async (material) => {
                    const prevM = totalMaterialsStored;
                    const prevC = totalChunksCreated;
                    const { materialsStored, chunksCreated } = await storeCourseMaterials(courseUuid, [material], {
                      supabase: serviceSupabase,
                      onProgress: (mCurr, cCurr) => {
                        void updateSyncProgress(serviceSupabase, user.id, {
                          materialsStored: prevM + mCurr,
                          chunksCreated: prevC + cCurr,
                          currentCourseMaterials: mCurr,
                          currentCourseChunks: cCurr,
                        });
                      },
                    });
                    totalMaterialsStored += materialsStored;
                    totalChunksCreated += chunksCreated;
                    currentCourseMaterials += materialsStored;
                    currentCourseChunks += chunksCreated;
                    await updateSyncProgress(serviceSupabase, user.id, {
                      materialsStored: totalMaterialsStored,
                      chunksCreated: totalChunksCreated,
                      currentCourseMaterials,
                      currentCourseChunks,
                    });
                  },
                }
              );
              ingestResults.push({ courseId: c.id, materialsStored: currentCourseMaterials, chunksCreated: currentCourseChunks });
              await updateSyncProgress(serviceSupabase, user.id, {
                materialsStored: totalMaterialsStored,
                chunksCreated: totalChunksCreated,
              });
            } catch (e) {
              console.warn(
                `Ingest failed for course ${c.id} (${c.name}):`,
                e instanceof Error ? e.message : e
              );
            }
          }
          await completeSyncProgress(serviceSupabase, user.id, {
            courses: canvasCourses.map((co) => ({ id: co.id, name: co.name, course_code: co.course_code })),
            assignments: canvasAssignments.map((a) => ({
              id: a.id,
              name: a.name,
              description: a.description,
              due_at: a.due_at,
              course_id: a.course_id,
            })),
            ingest: ingestResults,
          });
        } catch (err) {
          await failSyncProgress(
            serviceSupabase,
            user.id,
            err instanceof Error ? err.message : "Background sync failed"
          );
        }
      })();
      return NextResponse.json(
        { jobId: startedAt, message: "Sync started in the background. Poll GET /api/sync/status for progress." },
        { status: 202 }
      );
    }

    // No service role: run ingest in request (progress still stored in Supabase for other tabs/polling)
    await startSyncProgress(supabase, user.id, canvasCourses.length);
    const { ingestCourseMaterials } = await import("@/lib/canvas/ingest");
    const { storeCourseMaterials } = await import("@/lib/canvas/store");
    const ingestResults: { courseId: number; materialsStored: number; chunksCreated: number }[] = [];
    let totalMaterialsStored = 0;
    let totalChunksCreated = 0;
    for (let i = 0; i < canvasCourses.length; i++) {
      const c = canvasCourses[i];
      const courseUuid = canvasIdToUuid.get(c.id);
      if (!courseUuid) continue;
      await updateSyncProgress(supabase, user.id, {
        phase: "ingest",
        courseIndex: i,
        courseTotal: canvasCourses.length,
        message: `Ingesting ${c.name}…`,
        currentCourseMaterials: 0,
        currentCourseChunks: 0,
      });
      let currentCourseMaterials = 0;
      let currentCourseChunks = 0;
      try {
        await ingestCourseMaterials(
          String(c.id),
          credentials.token!,
          credentials.baseUrl!,
          {
            onItemRead: (msg, idx, total) => {
              void updateSyncProgress(supabase, user.id, {
                message: `Ingesting ${c.name}: ${msg} (${idx + 1}/${total})`,
              });
            },
            onMaterialIngested: async (material) => {
              const prevM = totalMaterialsStored;
              const prevC = totalChunksCreated;
              const { materialsStored, chunksCreated } = await storeCourseMaterials(courseUuid, [material], {
                supabase,
                onProgress: (mCurr, cCurr) => {
                  void updateSyncProgress(supabase, user.id, {
                    materialsStored: prevM + mCurr,
                    chunksCreated: prevC + cCurr,
                    currentCourseMaterials: mCurr,
                    currentCourseChunks: cCurr,
                  });
                },
              });
              totalMaterialsStored += materialsStored;
              totalChunksCreated += chunksCreated;
              currentCourseMaterials += materialsStored;
              currentCourseChunks += chunksCreated;
              await updateSyncProgress(supabase, user.id, {
                materialsStored: totalMaterialsStored,
                chunksCreated: totalChunksCreated,
                currentCourseMaterials,
                currentCourseChunks,
              });
            },
          }
        );
        ingestResults.push({ courseId: c.id, materialsStored: currentCourseMaterials, chunksCreated: currentCourseChunks });
        await updateSyncProgress(supabase, user.id, {
          materialsStored: totalMaterialsStored,
          chunksCreated: totalChunksCreated,
        });
      } catch (e) {
        console.warn(
          `Ingest failed for course ${c.id} (${c.name}):`,
          e instanceof Error ? e.message : e
        );
      }
    }
    await completeSyncProgress(supabase, user.id, {
      courses: canvasCourses.map((co) => ({ id: co.id, name: co.name, course_code: co.course_code })),
      assignments: canvasAssignments.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        due_at: a.due_at,
        course_id: a.course_id,
      })),
      ingest: ingestResults,
    });

    return NextResponse.json({
      courses: canvasCourses.map((c) => ({
        id: c.id,
        name: c.name,
        course_code: c.course_code,
      })),
      assignments: canvasAssignments.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        due_at: a.due_at,
        course_id: a.course_id,
      })),
      ingest: ingestResults,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    // #region agent log
    try { appendFileSync("/Users/symok/Desktop/HTE/.cursor/debug-1f53d4.log", JSON.stringify({ sessionId: "1f53d4", hypothesisId: "H1-server", location: "sync/route:POST", message: "POST /api/sync caught", data: { message }, timestamp: Date.now() }) + "\n"); } catch (_) {}
    fetch('http://127.0.0.1:7816/ingest/dcfe79ee-b938-4a53-8e78-211d2e2b322f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1f53d4'},body:JSON.stringify({sessionId:'1f53d4',hypothesisId:'H1-server',location:'sync/route:POST',message:'POST /api/sync caught',data:{message},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.error("[POST /api/sync]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
