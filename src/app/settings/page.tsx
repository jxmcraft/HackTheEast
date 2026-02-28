import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, canvas_api_url, canvas_api_key")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-sm text-[var(--muted-foreground)]">
        Signed in as {profile?.email ?? user.email}
      </p>
      <SettingsForm
        canvasApiUrl={profile?.canvas_api_url ?? ""}
        canvasApiKey={profile?.canvas_api_key ?? ""}
      />
    </main>
  );
}
