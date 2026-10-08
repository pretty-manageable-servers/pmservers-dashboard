'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthLayout, GitHubIcon } from './AuthLayout';
import { useSession } from '@/lib/auth';

export function CredentialsForm({ mode }: { mode: 'login' | 'signup' }) {
  const { signInWithPassword, signUp, signInWithGitHub } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = isLogin ? await signInWithPassword(email, password) : await signUp(email, password);
    setBusy(false);
    if (err) return setError(err);
    if (isLogin) router.replace('/');
    else setNotice('Check your email. We sent a link to confirm your account.');
  };

  const oauth = (start: () => Promise<string | null>) => async () => {
    const err = await start();
    if (err) setError(err);
    else if (process.env.NEXT_PUBLIC_AUTH_MOCK === '1') router.replace('/');
  };

  return (
    <AuthLayout>
      <form onSubmit={submit}>
        <div>
          <h1>{isLogin ? 'Sign in' : 'Create your account'}</h1>
          <p>{isLogin ? 'Welcome back to the console.' : 'Get a project and start in a minute.'}</p>
        </div>
        <button className="btn" type="button" onClick={oauth(signInWithGitHub)}>
          <GitHubIcon />
          Continue with GitHub
        </button>
        <div className="or">or</div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password" style={{ display: 'flex', justifyContent: 'space-between' }}>
            Password
            {isLogin && (
              <Link
                href="/reset-password"
                className="lnk"
                style={{ fontWeight: 400, fontSize: 12.5 }}
              >
                Forgot?
              </Link>
            )}
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={isLogin ? undefined : 8}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {!isLogin && <span className="hint">Use at least 8 characters.</span>}
        </div>
        {error && (
          <div className="errbox" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="muted">
            {notice}
          </div>
        )}
        <button className="btn primary" type="submit" disabled={busy}>
          {isLogin ? 'Sign in' : 'Sign up'}
        </button>
        <div className="fine">
          {isLogin ? (
            <>
              No account? <Link href="/signup">Sign up</Link>
            </>
          ) : (
            <>
              Have an account? <Link href="/login">Sign in</Link>
            </>
          )}
        </div>
      </form>
    </AuthLayout>
  );
}
