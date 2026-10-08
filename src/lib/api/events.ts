import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, unwrap } from './client';
import { keys } from './hooks';
import { env } from '@/lib/env';
import type { StreamEvent } from './types';

const MIN_DELAY = 1000;
const MAX_DELAY = 30_000;

/** Wait time before reconnect n (0, 1, 2, ...): 1 s, 2 s, 4 s, up to 30 s. */
export const backoffDelay = (n: number) => Math.min(MAX_DELAY, MIN_DELAY * 2 ** n);

/** Refresh the data that one event can change. */
export function applyEvent(qc: QueryClient, e: StreamEvent) {
  const p = e.project_id;
  for (const key of [keys.vms(p), keys.aiKeys(p), keys.events(p), keys.usage(p)]) {
    qc.invalidateQueries({ queryKey: key });
  }
  const text = `${e.resource_name} ${e.message}`;
  if (e.level === 'success') toast.success(text);
  else if (e.level === 'error') toast.error(text);
  else if (e.level === 'warning') toast.warning(text);
}

/** Keep one event stream open while `enabled`. Get a new ticket on each connect. */
export function useEventStream(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let stopped = false;

    const retry = () => {
      if (stopped) return;
      timer = setTimeout(connect, backoffDelay(failures++));
    };

    async function connect() {
      try {
        const { ticket } = unwrap(await api.POST('/v1/events/ticket'));
        if (stopped) return;
        const base = env.apiUrl || window.location.origin;
        const url = new URL('/v1/events/stream', base);
        url.searchParams.set('ticket', ticket);
        const opened = new EventSource(url);
        source = opened;
        opened.onopen = () => {
          // Events can be missed while we were away. Load everything again.
          if (failures > 0) qc.invalidateQueries();
          failures = 0;
        };
        opened.addEventListener('event', (m) => {
          try {
            applyEvent(qc, JSON.parse((m as MessageEvent<string>).data) as StreamEvent);
          } catch {}
        });
        opened.onerror = () => {
          // The ticket is used once and lasts 60 s. Close and get a new one.
          opened.close();
          if (source === opened) source = null;
          retry();
        };
      } catch {
        retry();
      }
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      source?.close();
    };
  }, [enabled, qc]);
}
