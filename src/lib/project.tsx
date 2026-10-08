'use client';

import { createContext, useCallback, useContext } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Project } from './api/types';

export const LAST_PROJECT_KEY = 'pms-last-project';

interface ProjectValue {
  project: Project;
  projects: Project[];
}

export const ProjectContext = createContext<ProjectValue | null>(null);

export function useProject(): ProjectValue {
  const v = useContext(ProjectContext);
  if (!v) throw new Error('useProject must be used inside AppShell');
  return v;
}

/** Read and write one query parameter, such as `r` for the open resource. */
export function useQueryParam(name: string) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const value = params.get(name);
  const set = useCallback(
    (next: string | null) => {
      const p = new URLSearchParams(params.toString());
      if (next) p.set(name, next);
      else p.delete(name);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [name, params, router, pathname],
  );
  return [value, set] as const;
}

export const projectHref = (path: string, projectId: string, extra?: Record<string, string>) => {
  const p = new URLSearchParams({ project: projectId, ...extra });
  return `${path}?${p.toString()}`;
};
