"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type LoginResult = { error: string | null; next?: string };

export async function login(formData: FormData): Promise<LoginResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/sync-dashboard");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Server configuration error." };
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  // Return success and let the client redirect so the response (with Set-Cookie) reaches the browser.
  return { error: null, next: next || "/sync-dashboard" };
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  const supabase = createClient();
  if (!supabase) throw new Error("Server configuration error.");
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/login");
}

export async function signout() {
  const supabase = createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}

