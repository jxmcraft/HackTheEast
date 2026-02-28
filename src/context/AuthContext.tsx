"use client";

import React, { createContext, useContext, useMemo } from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { useAuthState, useSignOut } from "@/hooks/useAuth";

type AuthContextValue = {
  user: SupabaseUser | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, session, loading } = useAuthState();
  const { signOut } = useSignOut();

  const value = useMemo<AuthContextValue>(
    () => ({ user, session, loading, signOut }),
    [user, session, loading, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

