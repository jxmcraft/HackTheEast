import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/sync-dashboard";

  if (code) {
    try {
      const supabase = createClient();
      if (!supabase) return NextResponse.redirect(new URL("/auth/signin?error=callback_failed", url.origin));
      await supabase.auth.exchangeCodeForSession(code);
    } catch {
      return NextResponse.redirect(new URL("/auth/signin?error=callback_failed", url.origin));
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}

