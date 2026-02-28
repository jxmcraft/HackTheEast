import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { SettingsFormFull } from "./SettingsFormFull";
import type { LearningMode } from "@/components/settings/LearningModeSelector";
import type { AvatarStyle } from "@/components/settings/AvatarCustomizer";

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: prefs }, { data: profile }] = await Promise.all([
    supabase.from("user_preferences").select("learning_mode, avatar_style, avatar_name").eq("id", user.id).single(),
    supabase.from("profiles").select("email, canvas_api_url, canvas_api_key, last_canvas_sync_at").eq("id", user.id).single(),
  ]);

  const preferences = {
    learning_mode: (prefs?.learning_mode ?? "text") as LearningMode,
    avatar_style: (prefs?.avatar_style ?? "encouraging") as AvatarStyle,
    avatar_name: prefs?.avatar_name ?? null,
  };

  if (!prefs?.learning_mode) {
    await supabase.from("user_preferences").upsert(
      { id: user.id, learning_mode: "text", avatar_style: "encouraging" },
      { onConflict: "id" }
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-sm text-[var(--muted-foreground)]">
        Signed in as {profile?.email ?? user.email}
      </p>
      <SettingsFormFull
        preferences={preferences}
        canvasApiUrl={profile?.canvas_api_url ?? ""}
        canvasApiKey={profile?.canvas_api_key ?? ""}
        lastCanvasSyncAt={profile?.last_canvas_sync_at ?? null}
      />
    </main>
  );
}
