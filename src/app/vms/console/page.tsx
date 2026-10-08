'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import '@xterm/xterm/css/xterm.css';
import { RequireAuth } from '@/lib/auth';
import { openConsole } from '@/lib/api/console';
import { projectHref } from '@/lib/project';

type State = 'connecting' | 'open' | 'closed';

const CLOSE_MESSAGES: Record<number, string> = {
  4401: 'The console link ran out of time. Connect again.',
  4404: 'We could not find this VM.',
  1011: 'The console could not open. The VM may still be starting.',
};
const CLOSE_DEFAULT = 'The console closed. The VM may have stopped, or another console opened.';

function Console() {
  const params = useSearchParams();
  const project = params.get('project') ?? '';
  const vm = params.get('vm') ?? '';
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>('connecting');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!project || !vm || !box.current) return;
    const el = box.current;
    let ws: WebSocket | null = null;
    let stopped = false;
    let cleanup = () => {};

    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
      ]);
      if (stopped) return;
      const term = new Terminal({
        cursorBlink: true,
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: 13,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(el);
      fit.fit();
      term.focus();
      const onResize = () => fit.fit();
      window.addEventListener('resize', onResize);
      const encoder = new TextEncoder();
      const input = term.onData((d) => {
        if (ws?.readyState === WebSocket.OPEN) ws.send(encoder.encode(d));
      });
      cleanup = () => {
        window.removeEventListener('resize', onResize);
        input.dispose();
        term.dispose();
      };

      try {
        ws = await openConsole(project, vm);
      } catch (e) {
        setState('closed');
        setMessage(e instanceof Error ? e.message : 'We could not open the console.');
        return;
      }
      if (stopped) {
        ws.close();
        return;
      }
      ws.onopen = () => {
        setState('open');
        // Send a newline so the prompt shows.
        ws?.send(encoder.encode('\n'));
      };
      ws.onmessage = (m) => {
        if (m.data instanceof ArrayBuffer) term.write(new Uint8Array(m.data));
        else term.write(String(m.data));
      };
      ws.onclose = (e) => {
        if (stopped) return;
        setState('closed');
        setMessage(CLOSE_MESSAGES[e.code] ?? CLOSE_DEFAULT);
      };
    })();

    return () => {
      stopped = true;
      ws?.close();
      cleanup();
    };
  }, [project, vm, attempt]);

  const reconnect = useCallback(() => {
    setState('connecting');
    setMessage('');
    setAttempt((n) => n + 1);
  }, []);

  if (!project || !vm) {
    return (
      <div className="grid min-h-screen place-items-center muted">
        This page needs a project and a VM.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: 12, gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link className="btn sm" href={projectHref('/vms', project, { r: vm })}>
          Back to VM
        </Link>
        <span className="muted" role="status">
          {state === 'connecting' && 'Connecting…'}
          {state === 'open' && 'Connected'}
          {state === 'closed' && message}
        </span>
        {state === 'closed' && (
          <button className="btn sm" type="button" onClick={reconnect}>
            Connect again
          </button>
        )}
      </div>
      <div ref={box} style={{ flex: 1, minHeight: 0, background: '#000', padding: 8 }} />
    </div>
  );
}

export default function ConsolePage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center muted">Loading…</div>}>
      <RequireAuth>
        <Console />
      </RequireAuth>
    </Suspense>
  );
}
