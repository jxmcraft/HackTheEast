import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseEnv, getServiceRoleEnv } from "./env";

export function createClient(): SupabaseClient | null {
  const env = getSupabaseEnv();
  if (!env) return null;
  const cookieStore = cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components can't set cookies; middleware will refresh sessions.
        }
      },
    },
  });
}

/** Like createClient() but throws if env is missing. Use in API routes for a non-null client type. */
export function createClientOrThrow(): SupabaseClient {
  const client = createClient();
  if (!client) throw new Error("Supabase env not configured");
  return client;
}

/**
 * Service-role Supabase client for background jobs (no request context).
 * Use only in server-side background tasks (e.g. sync ingest).
 */
export function createServiceRoleClient() {
  const { url, serviceRoleKey } = getServiceRoleEnv();
  return createSupabaseClient(url, serviceRoleKey);
}

export async function getSession(): Promise<Session | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export async function getUser(): Promise<User | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

