'use client';

import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import {
  useCreateRegistryCredential,
  useDeleteRegistryCredential,
  useRegistryCredentials,
} from '@/lib/api/hooks';
import type { RegistryCredential } from '@/lib/api/types';
import { normalizeHost } from '@/lib/containers';
import { timeAgo } from '@/lib/utils';

const HOST = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?$/;

/** Tokens for private registries. The token is write-only: we never show it again. */
export function RegistryCredentialsCard() {
  const creds = useRegistryCredentials();
  const create = useCreateRegistryCredential();
  const del = useDeleteRegistryCredential();
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [touched, setTouched] = useState(false);
  const [removing, setRemoving] = useState<RegistryCredential | null>(null);

  const nameErr = name.trim() && name.trim().length <= 64 ? null : 'Use 1 to 64 characters.';
  const hostErr = HOST.test(normalizeHost(host))
    ? null
    : 'Enter a registry host, for example ghcr.io.';
  const userErr = username.trim() ? null : 'Enter the user name.';
  const tokenErr = token ? null : 'Enter a token or password.';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (nameErr || hostErr || userErr || tokenErr) return;
    create.mutate(
      { name: name.trim(), host: normalizeHost(host), username: username.trim(), token },
      {
        onSuccess: () => {
          setName('');
          setHost('');
          setUsername('');
          setToken('');
          setTouched(false);
        },
      },
    );
  };

  const err = (e: string | null) => touched && e && <span className="err-t">{e}</span>;

  return (
    <section className="ucard" style={{ padding: 20, gap: 12 }}>
      <div>
        <b>Registry credentials</b>
        <div className="muted" style={{ fontSize: 13 }}>
          Pull private container images. Pick a credential when you create a container. Its host
          must match the image host. We never show the token again.
        </div>
      </div>
      {creds.isError ? (
        <span className="err-t">{creds.error.message}</span>
      ) : creds.data && creds.data.length > 0 ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {creds.data.map((c) => (
            <li
              key={c.id}
              style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
            >
              <b>{c.name}</b>
              <span className="mono muted" style={{ flex: '1 1 240px', wordBreak: 'break-all' }}>
                {c.username}@{c.host} · {timeAgo(c.created_at)} ago
              </span>
              <button className="btn sm danger" type="button" onClick={() => setRemoving(c)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        creds.data && <span className="muted">No registry credentials yet.</span>
      )}
      <form onSubmit={submit} noValidate className="field" style={{ margin: 0 }}>
        <label htmlFor="rc-name">Name</label>
        <input
          id="rc-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ghcr-bots"
          autoComplete="off"
          aria-invalid={touched && !!nameErr}
        />
        {err(nameErr)}
        <label htmlFor="rc-host">Registry host</label>
        <input
          id="rc-host"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="ghcr.io"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={touched && !!hostErr}
        />
        {err(hostErr)}
        <label htmlFor="rc-user">User name</label>
        <input
          id="rc-user"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
          aria-invalid={touched && !!userErr}
        />
        {err(userErr)}
        <label htmlFor="rc-token">Token or password</label>
        <input
          id="rc-token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="new-password"
          aria-invalid={touched && !!tokenErr}
        />
        {touched && tokenErr ? (
          <span className="err-t">{tokenErr}</span>
        ) : (
          <span className="hint">Use a token that can only read packages.</span>
        )}
        <div>
          <button className="btn" type="submit" disabled={create.isPending}>
            Save credential
          </button>
        </div>
      </form>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete ${removing?.name ?? 'credential'}?`}
        description="You cannot delete a credential that a container uses."
        confirmLabel="Delete credential"
        pending={del.isPending}
        onConfirm={() =>
          removing && del.mutate(removing.id, { onSuccess: () => setRemoving(null) })
        }
      />
    </section>
  );
}
