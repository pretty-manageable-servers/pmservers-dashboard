'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RequireAuth } from '@/lib/auth';
import { LAST_PROJECT_KEY } from '@/lib/project';
import { useProjects } from '@/lib/api/hooks';
import { ErrorState } from '@/components/States';

function Redirect() {
  const router = useRouter();
  const projects = useProjects();
  useEffect(() => {
    if (!projects.data) return;
    if (projects.data.length === 0) return router.replace('/projects/new');
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_PROJECT_KEY);
    } catch {}
    const target = projects.data.find((p) => p.id === last) ?? projects.data[0]!;
    router.replace(`/overview?project=${target.id}`);
  }, [projects.data, router]);
  if (projects.isError)
    return (
      <main className="page">
        <ErrorState error={projects.error} onRetry={() => projects.refetch()} />
      </main>
    );
  return (
    <div className="grid min-h-screen place-items-center muted" role="status">
      Loading…
    </div>
  );
}

export default function HomePage() {
  return (
    <RequireAuth>
      <Redirect />
    </RequireAuth>
  );
}
