'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen, ChevronsUpDown, LogOut, Plus, Search, Sun } from 'lucide-react';
import { Logo } from './icons';
import { TABS } from './nav';
import { MobileNav } from './MobileNav';
import {
  DropMenu,
  DropMenuContent,
  DropMenuItem,
  DropMenuLabel,
  DropMenuSeparator,
  DropMenuTrigger,
} from './DropMenu';
import { useSession } from '@/lib/auth';
import { projectHref, useProject } from '@/lib/project';
import { toggleTheme } from '@/lib/theme';
import { useAiKeys } from '@/lib/api/hooks';

export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { user, signOut } = useSession();
  const { project, projects } = useProject();
  const pathname = usePathname();
  const router = useRouter();
  const keys = useAiKeys(project.id);
  const counts: Record<string, number | undefined> = {
    ai: keys.data?.length,
  };
  const initial = (user?.email[0] ?? '?').toUpperCase();
  const name = user?.email.split('@')[0] ?? '';

  // Use the hamburger menu when the tabs do not fit on one line.
  const tabsRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const nav = tabsRef.current;
    if (!nav) return;
    const check = () => setCollapsed(nav.scrollWidth > nav.clientWidth + 1);
    const observer = new ResizeObserver(check);
    observer.observe(nav);
    for (const child of Array.from(nav.children)) observer.observe(child);
    check();
    return () => observer.disconnect();
  }, []);

  const switchTo = (id: string) => {
    router.push(projectHref(pathname === '/' ? '/overview' : pathname, id));
  };

  return (
    <header className={collapsed ? 'bar collapsed' : 'bar'}>
      <div className="bar-in">
        <div className="row1">
          <MobileNav counts={counts} projectId={project.id} />
          <Link href={projectHref('/overview', project.id)} aria-label="PMS Cloud home">
            <Logo />
          </Link>
          <span className="slash hide-sm">/</span>
          <span className="crumb hide-sm">
            <span className="av">{initial}</span>
            {name}
            <span className="tag">Free</span>
          </span>
          <span className="slash">/</span>
          <DropMenu>
            <DropMenuTrigger asChild>
              <button className="crumb" type="button">
                {project.name}
                <ChevronsUpDown aria-hidden="true" />
              </button>
            </DropMenuTrigger>
            <DropMenuContent>
              <DropMenuLabel>Projects</DropMenuLabel>
              {projects.map((p) => (
                <DropMenuItem
                  key={p.id}
                  on={p.id === project.id}
                  hint={p.id === project.id ? '✓' : p.role === 'member' ? 'Shared' : ''}
                  onSelect={() => switchTo(p.id)}
                >
                  {p.name}
                </DropMenuItem>
              ))}
              <DropMenuSeparator />
              <DropMenuItem onSelect={() => router.push('/projects/new')}>
                <Plus size={14} aria-hidden="true" />
                New project
              </DropMenuItem>
            </DropMenuContent>
          </DropMenu>
          <span className="grow" />
          <button
            className="kbtn"
            type="button"
            onClick={onOpenPalette}
            aria-label="Search and commands"
          >
            <Search aria-hidden="true" />
            <span className="t">Search or run a command</span>
            <span className="kbd">⌘K</span>
          </button>
          <a
            className="iconbtn hide-sm"
            aria-label="Docs"
            href="https://docs.pmservers.org"
            target="_blank"
            rel="noreferrer"
          >
            <BookOpen aria-hidden="true" />
          </a>
          <button
            className="iconbtn hide-sm"
            type="button"
            aria-label="Change theme"
            onClick={() => toggleTheme()}
          >
            <Sun aria-hidden="true" />
          </button>
          <DropMenu>
            <DropMenuTrigger asChild>
              <button className="me" type="button" aria-label="Account menu">
                {initial}
              </button>
            </DropMenuTrigger>
            <DropMenuContent align="end">
              <DropMenuLabel>{user?.email}</DropMenuLabel>
              <DropMenuItem onSelect={() => router.push(projectHref('/settings', project.id))}>
                Settings
              </DropMenuItem>
              <DropMenuItem onSelect={() => toggleTheme()}>Change theme</DropMenuItem>
              <DropMenuSeparator />
              <DropMenuItem onSelect={() => signOut().then(() => router.replace('/login'))}>
                <LogOut size={15} aria-hidden="true" />
                Sign out
              </DropMenuItem>
            </DropMenuContent>
          </DropMenu>
        </div>
        <nav
          ref={tabsRef}
          className="tabs"
          aria-label="Sections"
          aria-hidden={collapsed || undefined}
          inert={collapsed || undefined}
        >
          {TABS.map((t) => {
            const n = counts[t.id];
            if (t.soon) {
              return (
                <span key={t.id} className="tab-soon" aria-disabled="true" title="Coming soon">
                  <t.icon size={16} aria-hidden="true" />
                  {t.label}
                  <span className="soon">Coming soon</span>
                </span>
              );
            }
            return (
              <Link
                key={t.id}
                href={projectHref(t.path, project.id)}
                aria-current={pathname === t.path ? 'page' : undefined}
              >
                <t.icon size={16} aria-hidden="true" />
                {t.label}
                {n ? <span className="c">{n}</span> : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
