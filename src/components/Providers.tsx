'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider, useSession } from '@/lib/auth';
import { useEventStream } from '@/lib/api/events';
import { env } from '@/lib/env';

async function startMocks() {
  if (!env.apiMock) return;
  const { worker } = await import('@/mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
}

function EventStream() {
  const { user } = useSession();
  useEventStream(!!user);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!env.apiMock);
  const [client] = useState(
    () =>
      new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );

  useEffect(() => {
    if (!env.apiMock) return;
    startMocks().then(() => setReady(true));
  }, []);

  if (!ready) return null;
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <EventStream />
        {children}
        <Toaster position="bottom-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
