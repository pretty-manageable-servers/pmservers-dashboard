'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RequireAuth } from '@/lib/auth';
import { LAST_PROJECT_KEY, ProjectContext } from '@/lib/project';
import { useProjects } from '@/lib/api/hooks';
import { TopBar } from './TopBar';
import { CommandPalette } from './CommandPalette';
import { ErrorState } from './States';
import { Overlays } from './Overlays';

function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const projects = useProjects();
  const [palette, setPalette] = useState(false);

  const wanted = params.get('project');
  const project = useMemo(() => {
    const list = projects.data;
    if (!list || list.length === 0) return null;
    const byParam = list.find((p) => p.id === wanted);
    if (byParam) return byParam;
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_PROJECT_KEY);
    } catch {}
    return list.find((p) => p.id === last) ?? list[0] ?? null;
  }, [projects.data, wanted]);

  useEffect(() => {
    if (projects.data && projects.data.length === 0) router.replace('/projects/new');
  }, [projects.data, router]);

  useEffect(() => {
    if (!project) return;
    try {
      localStorage.setItem(LAST_PROJECT_KEY, project.id);
    } catch {}
    if (wanted !== project.id) {
      const p = new URLSearchParams(params.toString());
      p.set('project', project.id);
      router.replace(`${pathname}?${p.toString()}`);
    }
  }, [project, wanted, params, pathname, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (projects.isError) {
    return (
      <main className="page">
        <ErrorState error={projects.error} onRetry={() => projects.refetch()} />
      </main>
    );
  }
  if (!project || !projects.data || wanted !== project.id) {
    return (
      <div className="grid min-h-screen place-items-center muted" role="status">
        Loading…
      </div>
    );
  }

  return (
    <ProjectContext.Provider value={{ project, projects: projects.data }}>
      <TopBar onOpenPalette={() => setPalette(true)} />
      <main className="page">{children}</main>
      <Overlays />
      <CommandPalette open={palette} onOpenChange={setPalette} />
    </ProjectContext.Provider>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <Shell>{children}</Shell>
    </RequireAuth>
  );
}
