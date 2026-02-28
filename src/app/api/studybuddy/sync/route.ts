/**
 * StudyBuddy sync with account (Supabase user_preferences)
 * GET: load StudyBuddy data for the current user
 * POST: save StudyBuddy data for the current user
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { StudyBuddyUser } from "@/lib/studybuddyStorage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Auth not configured", linked: false },
      { status: 503 }
    );
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ linked: false });
  }

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("studybuddy_data")
    .eq("id", user.id)
    .single();

  const studybuddy_data = (prefs?.studybuddy_data as StudyBuddyUser | null) ?? null;
  const hasData =
    studybuddy_data &&
    typeof studybuddy_data === "object" &&
    (studybuddy_data.name != null || Object.keys(studybuddy_data.avatarConfig || {}).length > 0);

  return NextResponse.json({
    linked: true,
    email: user.email ?? undefined,
    data: hasData ? studybuddy_data : null,
  });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Auth not configured" },
      { status: 503 }
    );
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = body as StudyBuddyUser;
  const studybuddy_data = {
    name: payload.name ?? "",
    avatarConfig: payload.avatarConfig ?? {},
    personalityPrompt: payload.personalityPrompt ?? "",
    struggles: Array.isArray(payload.struggles) ? payload.struggles : [],
    lastTopic: payload.lastTopic ?? "neural_networks",
    lastSection: payload.lastSection ?? "intro",
    completedSections: Array.isArray(payload.completedSections) ? payload.completedSections : [],
    practiceResults: Array.isArray(payload.practiceResults) ? payload.practiceResults : [],
  };

  const { data: existing } = await supabase
    .from("user_preferences")
    .select("id")
    .eq("id", user.id)
    .single();

  if (existing) {
    const { error } = await supabase
      .from("user_preferences")
      .update({ studybuddy_data, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) {
      console.error("StudyBuddy sync update error:", error);
      return NextResponse.json({ error: error.message || "Failed to save" }, { status: 500 });
    }
  } else {
    const { error } = await supabase.from("user_preferences").insert({
      id: user.id,
      studybuddy_data,
    });
    if (error) {
      console.error("StudyBuddy sync insert error:", error);
      return NextResponse.json({ error: error.message || "Failed to save" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, linked: true });
}
