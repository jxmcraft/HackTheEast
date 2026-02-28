/**
 * StudyBuddy uploads: list (GET) and create (POST).
 * POST: parse PDF/DOCX/PPTX, extract key points, save to DB (when signed in) or return for client storage.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { parseFile } from "@/lib/studybuddy/parseUpload";
import { extractKeyPointsWithLLM, fallbackKeyPoints } from "@/lib/studybuddy/extractKeyPoints";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export async function GET() {
  try {
    const supabase = createClient();
    if (!supabase) {
      return NextResponse.json({ uploads: [] });
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ uploads: [] });
    }

    const { data, error } = await supabase
      .from("studybuddy_uploads")
      .select("id, name, file_type, extracted_text, key_points, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      // Table missing or schema cache: return empty list so UI doesn't break
      if (/schema cache|relation.*does not exist|relation.*not found/i.test(error.message)) {
        return NextResponse.json({ uploads: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ uploads: data ?? [] });
  } catch {
    return NextResponse.json({ uploads: [] });
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 15 MB)" }, { status: 400 });
  }
  const mime = file.type || "";
  const name = file.name.replace(/[^\w\s.-]/gi, "_").trim() || "document";
  if (!ALLOWED_TYPES.includes(mime) && !/\.(pdf|docx|pptx)$/i.test(name)) {
    return NextResponse.json({ error: "Only PDF, DOCX, and PPTX are allowed" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/b4376a79-f653-4c48-8ff8-e5fbe86d419a", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "uploads/route.ts:POST",
      message: "Before parseFile",
      data: { bufferType: buffer?.constructor?.name, bufferLen: buffer?.length, mime, name },
      timestamp: Date.now(),
      hypothesisId: "A",
    }),
  }).catch(() => {});
  // #endregion
  let parsed: Awaited<ReturnType<typeof parseFile>>;
  try {
    parsed = await parseFile(buffer, mime, name);
  } catch (e) {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/b4376a79-f653-4c48-8ff8-e5fbe86d419a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "uploads/route.ts:POST:catch",
        message: "parseFile error",
        data: { errMsg: e instanceof Error ? e.message : String(e), errName: e instanceof Error ? e.name : "" },
        timestamp: Date.now(),
        hypothesisId: "A",
      }),
    }).catch(() => {});
    // #endregion
    const msg = e instanceof Error ? e.message : "Failed to parse file";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/b4376a79-f653-4c48-8ff8-e5fbe86d419a", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "uploads/route.ts:POST",
      message: "After parseFile",
      data: { pagesCount: parsed?.pages?.length },
      timestamp: Date.now(),
      hypothesisId: "A",
      runId: "post-fix",
    }),
  }).catch(() => {});
  // #endregion

  let keyPoints: { pageNumber: number; points: string[] }[];
  try {
    keyPoints = await extractKeyPointsWithLLM(parsed.pages, name);
  } catch {
    keyPoints = fallbackKeyPoints(parsed.pages);
  }

  const payload = {
    name,
    file_type: name.endsWith(".pdf") ? "pdf" : name.endsWith(".docx") ? "docx" : "pptx",
    extracted_text: parsed.extractedText.slice(0, 300_000),
    key_points: keyPoints,
  };

  if (!user) {
    return NextResponse.json({
      saved: false,
      message: "Sign in to save uploads to your account. Here is the extracted data for this session.",
      upload: { id: `local-${Date.now()}`, ...payload, created_at: new Date().toISOString() },
    });
  }

  const { data: row, error } = await supabase
    .from("studybuddy_uploads")
    .insert({
      user_id: user.id,
      name: payload.name,
      file_type: payload.file_type,
      extracted_text: payload.extracted_text,
      key_points: payload.key_points,
    })
    .select("id, name, file_type, key_points, created_at")
    .single();

  if (error) {
    if (/schema cache|relation.*does not exist|relation.*not found/i.test(error.message)) {
      return NextResponse.json({
        saved: false,
        message: "Uploads table is not set up yet. Using this session only.",
        upload: { id: `local-${Date.now()}`, ...payload, created_at: new Date().toISOString() },
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ saved: true, upload: row });
}
