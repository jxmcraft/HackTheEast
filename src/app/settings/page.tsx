import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const supabase = createClient();
  if (!supabase) redirect("/login");
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
      <p className="text-sm text-[var(--muted-foreground)]">
        <Link href="/studybuddy" className="text-purple-400 hover:text-purple-300 underline">
          Open StudyBuddy
        </Link>
        {" "}to link your avatar and chatbot to this account.
      </p>
      <SettingsForm
        canvasApiUrl={profile?.canvas_api_url ?? ""}
        canvasApiKey={profile?.canvas_api_key ?? ""}
      />
    </main>
  );
}
