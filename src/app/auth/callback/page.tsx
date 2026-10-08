'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth';

/** Supabase returns here after OAuth or an email link. The client reads the session from the URL. */
export default function AuthCallbackPage() {
  const { loading, user } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/' : '/login');
  }, [loading, user, router]);
  return (
    <div className="grid min-h-screen place-items-center muted" role="status">
      Signing you in…
    </div>
  );
}
