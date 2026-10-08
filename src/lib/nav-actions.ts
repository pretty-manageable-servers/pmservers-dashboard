'use client';

import { useRouter } from 'next/navigation';
import { projectHref, useProject } from './project';

/** Open a resource in the side sheet, or open a create dialog, by changing the URL. */
export function useNavActions() {
  const router = useRouter();
  const { project } = useProject();
  return {
    openResource: (path: string, id: string) =>
      router.push(projectHref(path, project.id, { r: id })),
    create: (path: string, kind: 'vm' | 'ai') =>
      router.push(projectHref(path, project.id, { new: kind })),
  };
}
