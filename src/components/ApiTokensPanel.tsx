'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { CopyField } from './CopyField';
import { Modal } from './Modal';
import { EmptyState, ErrorState } from './States';
import { useApiTokens, useCreateApiToken, useRevokeApiToken } from '@/lib/api/hooks';
import type { ApiToken, ApiTokenCreated } from '@/lib/api/types';
import { useProject } from '@/lib/project';
import {
  TOKEN_EXPIRY_OPTIONS,
  TOKEN_LIMIT,
  expiresInDays,
  expiresLabel,
  lastUsedLabel,
  validateTokenName,
} from '@/lib/tokens';
import { timeAgoLong } from '@/lib/utils';

/** API tokens of the project. A token is shown one time, after create. The list never shows it. */
export function ApiTokensPanel() {
  const { project } = useProject();
  const tokens = useApiTokens(project.id);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState<string>('never');
  const [touched, setTouched] = useState(false);
  const [created, setCreated] = useState<ApiTokenCreated | null>(null);
  const [revoking, setRevoking] = useState<ApiToken | null>(null);
  const create = useCreateApiToken(project.id, (t) => {
    setCreating(false);
    setCreated(t);
  });
  const revoke = useRevokeApiToken(project.id);
  const nameErr = validateTokenName(name);

  const openCreate = () => {
    setName('');
    setExpiry('never');
    setTouched(false);
    create.reset();
    setCreating(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (create.isPending || nameErr) return;
    create.mutate({ name: name.trim(), expires_in_days: expiresInDays(expiry) });
  };

  return (
    <section className="ucard" style={{ padding: 20, gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <b>API tokens</b>
          <div className="muted" style={{ fontSize: 13 }}>
            A token lets a script, the CLI or the E2B SDK use this project. It works only for this
            project. Keep it secret. You can have {TOKEN_LIMIT} tokens in a project.
          </div>
        </div>
        <button className="btn primary" type="button" onClick={openCreate}>
          <Plus aria-hidden="true" />
          Create token
        </button>
      </div>

      {tokens.isLoading ? (
        <div className="skeleton" style={{ height: 120 }} role="status" aria-label="Loading" />
      ) : tokens.isError ? (
        <ErrorState error={tokens.error} onRetry={() => tokens.refetch()} />
      ) : tokens.data?.length === 0 ? (
        <EmptyState
          text="No tokens yet. Create a token to use the API or the E2B SDK."
          action="Create token"
          onAction={openCreate}
        />
      ) : (
        <table className="rtable">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Token</th>
              <th scope="col">Expires</th>
              <th scope="col">Last used</th>
              <th scope="col">Created</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {tokens.data?.map((t) => (
              <tr key={t.id}>
                <td data-label="Name">
                  <b>{t.name}</b>
                </td>
                <td data-label="Token">
                  <span className="mono">{t.prefix}…</span>
                </td>
                <td data-label="Expires">{expiresLabel(t)}</td>
                <td data-label="Last used">{lastUsedLabel(t)}</td>
                <td data-label="Created">{timeAgoLong(t.created_at)}</td>
                <td>
                  <button
                    className="btn sm danger"
                    type="button"
                    aria-label={`Revoke ${t.name}`}
                    onClick={() => setRevoking(t)}
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal
        open={creating}
        onOpenChange={(o) => !create.isPending && setCreating(o)}
        title="Create API token"
        description="Use it in scripts, the CLI and the E2B SDK. It works only for this project."
      >
        <form id="token-form" onSubmit={submit} noValidate>
          <div className="field" style={{ padding: '18px 22px 0' }}>
            <label htmlFor="tok-name">Name</label>
            <input
              id="tok-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ci-deploy"
              autoComplete="off"
              aria-invalid={touched && !!nameErr}
            />
            {touched && nameErr && <span className="err-t">{nameErr}</span>}
          </div>
          <div className="field" style={{ padding: '0 22px' }}>
            <label htmlFor="tok-expiry">Expires</label>
            <select id="tok-expiry" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
              {TOKEN_EXPIRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {create.isError && (
              <span className="err-t" role="alert">
                {create.error.message}
              </span>
            )}
          </div>
        </form>
        <footer>
          <span className="cost">Up to {TOKEN_LIMIT} tokens in a project</span>
          <button
            className="btn"
            type="button"
            disabled={create.isPending}
            onClick={() => setCreating(false)}
          >
            Cancel
          </button>
          <button
            className="btn primary"
            form="token-form"
            type="submit"
            disabled={create.isPending}
          >
            Create token
          </button>
        </footer>
      </Modal>

      <Modal
        open={created !== null}
        onOpenChange={(o) => !o && setCreated(null)}
        title="Your new token"
        description="You will not see it again."
      >
        <div style={{ padding: '18px 22px' }}>
          <CopyField value={created?.token ?? ''} label={created?.name} />
          <p className="muted" style={{ fontSize: 12.5, margin: '12px 0 0' }}>
            Copy it now and store it safely. You will not see it again. If you lose it, revoke it
            and create a new token.
          </p>
        </div>
        <footer>
          <span className="cost" />
          <button className="btn primary" type="button" onClick={() => setCreated(null)}>
            Done
          </button>
        </footer>
      </Modal>

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={`Revoke ${revoking?.name ?? 'token'}?`}
        description="Scripts and apps that use this token stop working at once. You cannot undo this."
        confirmLabel="Revoke token"
        pending={revoke.isPending}
        onConfirm={() =>
          revoking &&
          revoke.mutate(
            { id: revoking.id, name: revoking.name },
            { onSuccess: () => setRevoking(null) },
          )
        }
      />
    </section>
  );
}
