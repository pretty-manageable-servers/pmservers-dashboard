'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Menu, Sun, X } from 'lucide-react';
import { TABS } from './nav';
import { projectHref } from '@/lib/project';
import { toggleTheme } from '@/lib/theme';

const FOCUSABLE = 'a[href], button:not([disabled])';

export function MobileNav({
  counts,
  projectId,
}: {
  counts: Record<string, number | undefined>;
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();
  const menuRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  // Close the drawer when the page changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // While open: lock body scroll, trap Tab, close on Escape, and return focus on close.
  useEffect(() => {
    if (!open) return;
    const menuButton = menuRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      const drawer = drawerRef.current;
      if (e.key !== 'Tab' || !drawer) return;
      const items = drawer.querySelectorAll<HTMLElement>(FOCUSABLE);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      const inside = active instanceof Node && drawer.contains(active);
      if (e.shiftKey && (!inside || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      menuButton?.focus();
    };
  }, [open]);

  const close = () => setOpen(false);

  // The drawer is portaled to body. The bar has backdrop-filter, which would
  // otherwise trap a fixed element inside the 56px bar.
  const drawer = open
    ? createPortal(
        <>
          <div className="mnav-scrim" onClick={close} />
          <aside
            ref={drawerRef}
            id={panelId}
            className="mnav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <div className="mnav-head">
              <button
                ref={closeRef}
                className="iconbtn"
                type="button"
                aria-label="Close menu"
                onClick={close}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <nav className="mnav-list" aria-label="Sections">
              {TABS.map((t) => {
                const n = counts[t.id];
                const content = (
                  <>
                    <t.icon size={16} aria-hidden="true" />
                    {t.label}
                    {t.soon ? (
                      <span className="soon">Coming soon</span>
                    ) : n ? (
                      <span className="c">{n}</span>
                    ) : null}
                  </>
                );
                if (t.soon) {
                  return (
                    <span key={t.id} className="mnav-link" aria-disabled="true">
                      {content}
                    </span>
                  );
                }
                return (
                  <Link
                    key={t.id}
                    className="mnav-link"
                    href={projectHref(t.path, projectId)}
                    aria-current={pathname === t.path ? 'page' : undefined}
                    onClick={close}
                  >
                    {content}
                  </Link>
                );
              })}
            </nav>
            <hr className="mnav-sep" />
            <a
              className="mnav-link"
              href="https://docs.pmservers.org"
              target="_blank"
              rel="noreferrer"
              onClick={close}
            >
              <BookOpen size={16} aria-hidden="true" />
              Docs
            </a>
            <button className="mnav-link" type="button" onClick={() => toggleTheme()}>
              <Sun size={16} aria-hidden="true" />
              Change theme
            </button>
          </aside>
        </>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={menuRef}
        className="iconbtn menu-btn"
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
      >
        <Menu aria-hidden="true" />
      </button>
      {drawer}
    </>
  );
}
