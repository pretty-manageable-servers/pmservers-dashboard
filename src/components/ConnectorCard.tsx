'use client';

import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { useDeleteConnector, useUpdateConnector } from '@/lib/api/hooks';
import type { Connector, ConnectorKind } from '@/lib/api/types';
import { CONNECTOR_NAME, statusInfo, tokenError } from '@/lib/connectors';
import { timeAgo } from '@/lib/utils';

const HELP: Record<ConnectorKind, { summary: string; token: string; steps: string }> = {
  tailscale: {
    summary: 'Private access for your team, on your tailnet.',
    token: 'Auth key',
    steps:
      'Create an auth key in the Tailscale admin console. We recommend a tagged, reusable and ephemeral key. Paste it here. PMS keeps it encrypted and never shows it again.',
  },
  cloudflared: {
    summary: 'Public web access through Cloudflare.',
    token: 'Connector token',
    steps:
      'Create a tunnel in the Cloudflare Zero Trust dashboard and copy its connector token. Paste it here. PMS keeps it encrypted and never shows it again. Then set a public hostname for each target below, in your own Cloudflare dashboard, to the origin shown in the table.',
  },
};

/** The age of the last check, for example "Checked 5m ago". */
const checkedText = (iso: string) => {
  const ago = timeAgo(iso);
  return ago === 'now' ? 'Checked just now' : `Checked ${ago} ago`;
};

/** One connector: its status, its token (write only), and Enable, Replace token or Disable. */
export function ConnectorCard({
  kind,
  projectId,
  connector,
}: {
  kind: ConnectorKind;
  projectId: string;
  connector: Connector | undefined;
}) {
  const update = useUpdateConnector(projectId);
  const del = useDeleteConnector(projectId);
  const [token, setToken] = useState('');
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const help = HELP[kind];
  const name = CONNECTOR_NAME[kind];
  const inputId = `${kind}-token`;
  const clientError = touched ? tokenError(kind, token) : null;
  const deleting = connector?.status === 'deleting';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setServerError(null);
    if (tokenError(kind, token)) return;
    update.mutate(
      { kind, body: { token: token.trim() } },
      {
        onSuccess: () => {
          setToken('');
          setTouched(false);
        },
        onError: (err) => setServerError(err.message),
      },
    );
  };

  return (
    <section className="ucard" style={{ padding: 20, gap: 12 }} aria-labelledby={`${kind}-title`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 id={`${kind}-title`} style={{ fontSize: 16, margin: 0 }}>
            {name}
          </h2>
          <span className="muted" style={{ fontSize: 13 }}>
            {help.summary}
          </span>
        </div>
        {connector ? (
          <span className={`dot ${statusInfo(connector.status).className}`} role="status">
            {statusInfo(connector.status).label}
          </span>
        ) : (
          <span className="badge">Not enabled</span>
        )}
      </div>
      {connector?.message && (
        <span className="hint" style={{ margin: 0 }}>
          {connector.message}
          {connector.observed_at ? ` · ${checkedText(connector.observed_at)}` : ''}
        </span>
      )}
      <span className="hint" style={{ margin: 0 }}>
        {help.steps}
      </span>
      {!deleting && (
        <form onSubmit={submit} noValidate className="field" style={{ margin: 0 }}>
          <label htmlFor={inputId}>
            {connector ? `New ${help.token.toLowerCase()} (optional)` : help.token}
          </label>
          <input
            id={inputId}
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={connector ? 'Paste a new one to replace it' : 'Paste it here'}
            aria-invalid={!!clientError || !!serverError}
          />
          {clientError ? (
            <span className="err-t">{clientError}</span>
          ) : serverError ? (
            <span className="err-t" role="alert">
              {serverError}
            </span>
          ) : (
            <span className="hint">Write only. You will not see it again after you save.</span>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" type="submit" disabled={update.isPending}>
              {connector ? 'Replace token' : 'Enable'}
            </button>
            {connector && (
              <button
                className="btn danger"
                type="button"
                disabled={update.isPending || del.isPending}
                onClick={() => setConfirm(true)}
              >
                Disable
              </button>
            )}
          </div>
        </form>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Disable ${name}?`}
        description={
          kind === 'tailscale'
            ? 'The Tailscale device leaves your tailnet. Anyone who uses its addresses loses access.'
            : 'The tunnel stops. Public hostnames in your Cloudflare dashboard stop working.'
        }
        confirmLabel="Disable"
        pending={del.isPending}
        onConfirm={() => del.mutate(kind, { onSuccess: () => setConfirm(false) })}
      />
    </section>
  );
}
