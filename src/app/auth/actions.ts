"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type LoginResult = { error: string | null; next?: string };

export async function login(formData: FormData): Promise<LoginResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/sync-dashboard");

  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/b4376a79-f653-4c48-8ff8-e5fbe86d419a", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "auth/actions.ts:login:entry", message: "login called", data: { hasEmail: !!email, hasPassword: !!password, next }, timestamp: Date.now(), hypothesisId: "H1" }) }).catch(() => {});
  // #endregion

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Server configuration error." };
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/b4376a79-f653-4c48-8ff8-e5fbe86d419a", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "auth/actions.ts:login:afterSignIn", message: "after signInWithPassword", data: { hasError: !!error, errorMessage: error?.message ?? null }, timestamp: Date.now(), hypothesisId: "H2" }) }).catch(() => {});
  // #endregion

  if (error) {
    return { error: error.message };
  }

  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/b4376a79-f653-4c48-8ff8-e5fbe86d419a", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "auth/actions.ts:login:success", message: "returning success", data: { next: next || "/sync-dashboard" }, timestamp: Date.now(), hypothesisId: "H3" }) }).catch(() => {});
  // #endregion

  // Return success and let the client redirect so the response (with Set-Cookie) reaches the browser.
  return { error: null, next: next || "/sync-dashboard" };
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!email || !password) {
    redirect(`/signup?error=${encodeURIComponent("Email and password are required.")}`);
    return;
  }

  const supabase = createClient();
  if (!supabase) {
    redirect(`/signup?error=${encodeURIComponent("Server configuration error.")}`);
    return;
  }
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
    return;
  }

  redirect("/login");
}

export async function signout() {
  const supabase = createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}

