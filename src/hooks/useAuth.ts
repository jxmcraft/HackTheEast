"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import type { AuthError, SignInCredentials, SignUpCredentials } from "@/types/auth";

type AuthState = {
  user: SupabaseUser | null;
  session: Session | null;
  loading: boolean;
  error: AuthError | null;
};

const toAuthError = (e: unknown): AuthError => {
  if (e instanceof Error) return { message: e.message };
  if (typeof e === "object" && e) {
    const maybe = e as Partial<{ message: unknown; status: unknown }>;
    if (typeof maybe.message === "string") {
      const status = typeof maybe.status === "number" ? maybe.status : undefined;
      return { message: maybe.message, status };
    }
  }
  return { message: "Unknown error" };
};

export function useAuthState(): AuthState {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: !!supabase,
    error: null,
  });

  useEffect(() => {
    if (!supabase) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) throw error;
        setState((s) => ({
          ...s,
          session: data.session,
          user: data.session?.user ?? null,
          loading: false,
          error: null,
        }));
      } catch (e) {
        if (!mounted) return;
        setState((s) => ({ ...s, loading: false, error: toAuthError(e) }));
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({
        ...s,
        session,
        user: session?.user ?? null,
        loading: false,
      }));
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  return state;
}

export function useUser() {
  return useAuthState().user;
}

export function useSignIn() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  const signIn = useCallback(
    async ({ email, password }: SignInCredentials) => {
      if (!supabase) throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local");
      setLoading(true);
      setError(null);
      try {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      } catch (e) {
        setError(toAuthError(e));
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  return { signIn, loading, error };
}

export function useSignUp() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  const signUp = useCallback(
    async ({ email, password, full_name }: SignUpCredentials) => {
      if (!supabase) throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local");
      setLoading(true);
      setError(null);
      try {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: full_name ? { full_name } : undefined,
          },
        });
        if (signUpError) throw signUpError;
      } catch (e) {
        setError(toAuthError(e));
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  return { signUp, loading, error };
}

export function useSignOut() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    } catch (e) {
      setError(toAuthError(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  return { signOut, loading, error };
}

export function usePasswordReset() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  const requestPasswordReset = useCallback(
    async (email: string, redirectTo?: string) => {
      if (!supabase) throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local");
      setLoading(true);
      setError(null);
      try {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email,
          redirectTo ? { redirectTo } : undefined
        );
        if (resetError) throw resetError;
      } catch (e) {
        setError(toAuthError(e));
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  return { requestPasswordReset, loading, error };
}

