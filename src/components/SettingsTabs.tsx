'use client';

import Link from 'next/link';
import { projectHref, useProject } from '@/lib/project';

/** The tabs of the project settings. Each tab keeps the project in the URL. */
export function SettingsTabs({ current }: { current: 'general' | 'tokens' }) {
  const { project } = useProject();
  return (
    <nav className="tabs" aria-label="Settings sections">
      <Link
        href={projectHref('/settings', project.id)}
        aria-current={current === 'general' ? 'page' : undefined}
      >
        General
      </Link>
      <Link
        href={projectHref('/settings/tokens', project.id)}
        aria-current={current === 'tokens' ? 'page' : undefined}
      >
        API tokens
      </Link>
    </nav>
  );
}
