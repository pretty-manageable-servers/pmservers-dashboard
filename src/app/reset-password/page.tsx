'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthLayout } from '@/components/AuthLayout';
import { useSession } from '@/lib/auth';

/** Two jobs: ask for a reset email, and set a new password after the email link. */
export default function ResetPasswordPage() {
  const { user, loading, sendResetEmail, updatePassword } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    // Supabase puts type=recovery in the URL hash on the email link.
    setRecovery(window.location.hash.includes('type=recovery'));
  }, []);
  const settingNew = recovery && !loading && !!user;

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(await sendResetEmail(email));
    setSent(true);
  };
  const setNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = await updatePassword(password);
    if (err) return setError(err);
    router.replace('/');
  };

  return (
    <AuthLayout>
      {settingNew ? (
        <form onSubmit={setNew}>
          <div>
            <h1>Set a new password</h1>
            <p>Choose a password with at least 8 characters.</p>
          </div>
          <div className="field">
            <label htmlFor="np">New password</label>
            <input
              id="np"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <div className="errbox" role="alert">
              {error}
            </div>
          )}
          <button className="btn primary" type="submit">
            Save password
          </button>
        </form>
      ) : (
        <form onSubmit={ask}>
          <div>
            <h1>Reset your password</h1>
            <p>We send a link to your email.</p>
          </div>
          <div className="field">
            <label htmlFor="re">Email</label>
            <input
              id="re"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && (
            <div className="errbox" role="alert">
              {error}
            </div>
          )}
          {sent && !error && (
            <div role="status" className="muted">
              If an account exists, we sent a link to {email}.
            </div>
          )}
          <button className="btn primary" type="submit">
            Send link
          </button>
          <div className="fine">
            <Link href="/login">Back to sign in</Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
