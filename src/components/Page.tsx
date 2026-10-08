import { Suspense } from 'react';
import { AppShell } from './AppShell';

/** Wraps a protected page. Suspense is needed for useSearchParams in a static export. */
export function Page({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center muted" role="status">
          Loading…
        </div>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
