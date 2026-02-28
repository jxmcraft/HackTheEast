"use server";

import { revalidatePath } from "next/cache";
import { createClientOrThrow } from "@/utils/supabase/server";
import type { AvatarStyle } from "@/components/settings/AvatarCustomizer";

export async function updatePreferences(formData: FormData) {
  const avatarStyle = String(formData.get("avatar_style") ?? "encouraging").trim() as AvatarStyle;
  const avatarName = String(formData.get("avatar_name") ?? "").trim() || null;
  if (!["strict", "encouraging", "socratic"].includes(avatarStyle)) throw new Error("Invalid avatar_style");

  const supabase = createClientOrThrow();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("user_preferences").upsert(
    {
      id: user.id,
      learning_mode: "text", // fixed; learning method removed from settings
      avatar_style: avatarStyle,
      avatar_name: avatarName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function updateCanvasCredentials(formData: FormData) {
  const canvasApiUrl = String(formData.get("canvas_api_url") ?? "").trim() || null;
  const canvasApiKey = String(formData.get("canvas_api_key") ?? "").trim() || null;

  const supabase = createClientOrThrow();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({
      canvas_api_url: canvasApiUrl,
      canvas_api_key: canvasApiKey,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }
  revalidatePath("/settings");
}

export async function setLastCanvasSyncAt() {
  const supabase = createClientOrThrow();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("profiles")
    .update({ last_canvas_sync_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) {
    throw new Error(error.message);
  }
  revalidatePath("/settings");
}
