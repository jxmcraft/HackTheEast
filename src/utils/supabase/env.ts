export function getSupabaseEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

/** Use in server code when Supabase is required. Throws if env vars are missing. */
export function getSupabaseEnvOrThrow(): { url: string; anonKey: string } {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Missing Supabase env vars: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  return env;
}

/** Service role client for server-side background jobs (e.g. sync). Requires SUPABASE_SERVICE_ROLE_KEY. */
export function getServiceRoleEnv(): { url: string; serviceRoleKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (required for background sync). Set in .env.local."
    );
  }
  return { url, serviceRoleKey: key };
}

