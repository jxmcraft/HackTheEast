import { createClient } from "@/utils/supabase/server";
import type { CanvasConfig } from "@/lib/canvas";

/**
 * Get Canvas API URL and token from the current user's profile.
 * Returns undefined if not authenticated or profile has no Canvas credentials (then callers use env).
 */
export async function getCanvasCredentialsFromProfile(): Promise<Partial<CanvasConfig> | undefined> {
  const supabase = createClient();
  if (!supabase) return undefined;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return undefined;

  const { data: profile } = await supabase
    .from("profiles")
    .select("canvas_api_url, canvas_api_key")
    .eq("id", user.id)
    .single();

  if (!profile?.canvas_api_url || !profile?.canvas_api_key) return undefined;
  return {
    baseUrl: profile.canvas_api_url,
    token: profile.canvas_api_key,
  };
}
