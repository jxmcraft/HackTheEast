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
    .select("studybuddy_data, studybuddy_user_profile, studybuddy_avatar_profile")
    .eq("id", user.id)
    .single();

  const legacyData = (prefs?.studybuddy_data as StudyBuddyUser | null) ?? null;
  const userProfile = (prefs?.studybuddy_user_profile as StudyBuddyUser["userProfile"] | null) ?? null;
  const avatarProfile = (prefs?.studybuddy_avatar_profile as StudyBuddyUser["avatarProfile"] | null) ?? null;
  const studybuddy_data =
    userProfile && avatarProfile
      ? {
          userProfile,
          avatarProfile,
          struggles: Array.isArray((legacyData as StudyBuddyUser | null)?.struggles)
            ? (legacyData as StudyBuddyUser).struggles
            : [],
          lastTopic: (legacyData as StudyBuddyUser | null)?.lastTopic ?? "neural_networks",
          lastSection: (legacyData as StudyBuddyUser | null)?.lastSection ?? "intro",
          completedSections: Array.isArray((legacyData as StudyBuddyUser | null)?.completedSections)
            ? (legacyData as StudyBuddyUser).completedSections
            : [],
          practiceResults: Array.isArray((legacyData as StudyBuddyUser | null)?.practiceResults)
            ? (legacyData as StudyBuddyUser).practiceResults
            : [],
        }
      : legacyData;
  const hasData =
    studybuddy_data &&
    typeof studybuddy_data === "object" &&
    ((studybuddy_data.userProfile?.name ?? "").trim().length > 0 ||
      (studybuddy_data.avatarProfile?.avatarName ?? "").trim().length > 0 ||
      Object.keys(studybuddy_data.avatarProfile?.avatarConfig || {}).length > 0);

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
    userProfile: {
      name: payload.userProfile?.name ?? "",
      sex: payload.userProfile?.sex ?? "",
      birthday: payload.userProfile?.birthday ?? "",
      email: payload.userProfile?.email ?? "",
      profilePicture: payload.userProfile?.profilePicture ?? "",
    },
    avatarProfile: {
      avatarName: payload.avatarProfile?.avatarName ?? "",
      avatarConfig: payload.avatarProfile?.avatarConfig ?? {},
      teachingStylePrompt: payload.avatarProfile?.teachingStylePrompt ?? "",
      tutorVoice:
        payload.avatarProfile?.tutorVoice || payload.avatarProfile?.avatarConfig?.voiceId || "English_expressive_narrator",
    },
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
      .update({
        studybuddy_data,
        studybuddy_user_profile: studybuddy_data.userProfile,
        studybuddy_avatar_profile: studybuddy_data.avatarProfile,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    if (error) {
      console.error("StudyBuddy sync update error:", error);
      return NextResponse.json({ error: error.message || "Failed to save" }, { status: 500 });
    }
  } else {
    const { error } = await supabase.from("user_preferences").insert({
      id: user.id,
      studybuddy_data,
      studybuddy_user_profile: studybuddy_data.userProfile,
      studybuddy_avatar_profile: studybuddy_data.avatarProfile,
    });
    if (error) {
      console.error("StudyBuddy sync insert error:", error);
      return NextResponse.json({ error: error.message || "Failed to save" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, linked: true });
}
