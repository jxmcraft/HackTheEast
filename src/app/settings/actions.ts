"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export async function updateCanvasCredentials(formData: FormData) {
  const canvasApiUrl = String(formData.get("canvas_api_url") ?? "").trim() || null;
  const canvasApiKey = String(formData.get("canvas_api_key") ?? "").trim() || null;

  const supabase = createClient();
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

  if (error) throw error;
  revalidatePath("/settings");
}
