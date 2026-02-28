import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

/**
 * Server-side guard for protected Server Components.
 * Use inside a Server Component or Route Handler.
 */
export async function requireUser(options?: { redirectTo?: string }) {
  const supabase = createClient();
  if (!supabase) redirect(options?.redirectTo ?? "/sync-dashboard");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = options?.redirectTo ?? "/sync-dashboard";
    redirect(`/auth/signin?next=${encodeURIComponent(next)}`);
  }

  return user;
}

