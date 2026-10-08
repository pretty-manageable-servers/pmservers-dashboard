'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { env } from './env';
import { getSupabase } from './supabase';
import { configureApi } from './api/client';

export interface SessionUser {
  id: string;
  email: string;
  provider: string;
}

interface AuthValue {
  loading: boolean;
  user: SessionUser | null;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signInWithGitHub: () => Promise<string | null>;
  sendResetEmail: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const MOCK_KEY = 'pms-mock-session';
const MOCK_USER: SessionUser = {
  id: '5b1c0e2a-8d41-4f3e-9a77-1e0c3d2b6f90',
  email: 'robert@example.com',
  provider: 'github',
};

function readMock(): SessionUser | null {
  try {
    return localStorage.getItem(MOCK_KEY) ? MOCK_USER : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    if (env.authMock) {
      setUser(readMock());
      setLoading(false);
      return;
    }
    const sb = getSupabase();
    const apply = (
      s: { user: { id: string; email?: string; app_metadata: { provider?: string } } } | null,
    ) =>
      setUser(
        s
          ? {
              id: s.user.id,
              email: s.user.email ?? '',
              provider: s.user.app_metadata.provider ?? 'email',
            }
          : null,
      );
    sb.auth.getSession().then(({ data }) => {
      apply(data.session);
      setLoading(false);
    });
    const { data } = sb.auth.onAuthStateChange((_e, session) => apply(session));
    return () => data.subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    if (env.authMock) {
      try {
        localStorage.removeItem(MOCK_KEY);
      } catch {}
      setUser(null);
      return;
    }
    await getSupabase().auth.signOut();
    setUser(null);
  }, []);

  useEffect(() => {
    configureApi({
      getToken: async () => {
        if (env.authMock) return 'mock-token';
        const { data } = await getSupabase().auth.getSession();
        return data.session?.access_token ?? null;
      },
      onUnauthorized: () => {
        signOut().then(() => window.location.assign('/login'));
      },
    });
  }, [signOut]);

  const value = useMemo<AuthValue>(() => {
    const redirect = () => `${window.location.origin}/auth/callback`;
    const mockIn = async () => {
      try {
        localStorage.setItem(MOCK_KEY, '1');
      } catch {}
      setUser(MOCK_USER);
      return null;
    };
    return {
      loading,
      user,
      signInWithPassword: async (email, password) => {
        if (env.authMock) return mockIn();
        const { error } = await getSupabase().auth.signInWithPassword({ email, password });
        return error?.message ?? null;
      },
      signUp: async (email, password) => {
        if (env.authMock) return mockIn();
        const { error } = await getSupabase().auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirect() },
        });
        return error?.message ?? null;
      },
      signInWithGitHub: async () => {
        if (env.authMock) return mockIn();
        const { error } = await getSupabase().auth.signInWithOAuth({
          provider: 'github',
          options: { redirectTo: redirect() },
        });
        return error?.message ?? null;
      },
      sendResetEmail: async (email) => {
        if (env.authMock) return null;
        const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        return error?.message ?? null;
      },
      updatePassword: async (password) => {
        if (env.authMock) return null;
        const { error } = await getSupabase().auth.updateUser({ password });
        return error?.message ?? null;
      },
      signOut,
    };
  }, [loading, user, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSession(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useSession must be used inside AuthProvider');
  return v;
}

/** Show a loading state, then go to /login if there is no session. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { loading, user } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);
  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center muted" role="status">
        Loading…
      </div>
    );
  }
  return <>{children}</>;
}
