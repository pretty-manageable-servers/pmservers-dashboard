'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { Modal } from './Modal';
import { StorageSecretDialog } from './StorageSecretDialog';
import { EmptyState, ErrorState } from './States';
import {
  useCreateStorageKey,
  useDeleteStorageKey,
  useResetStorageKey,
  useStorageBuckets,
  useStorageKeys,
} from '@/lib/api/hooks';
import type {
  Bucket,
  Storage,
  StorageKey,
  StorageKeyPermission,
  StorageKeyWithSecret,
} from '@/lib/api/types';
import { PERMISSION_LABEL, canCreateKeys, keyBucketsLabel, validateKeyName } from '@/lib/storage';

type Pending = { mode: 'reset' | 'delete'; key: StorageKey } | null;

/** The access keys of the account: the list, create, reset and delete. The secret is shown one time. */
export function StorageKeys({ s, account }: { s: Storage; account?: string }) {
  const keys = useStorageKeys(account);
  const buckets = useStorageBuckets(account);
  const del = useDeleteStorageKey(account);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  // The one-time secret. It stays in this component only. Closing the dialog clears it.
  const [secret, setSecret] = useState<StorageKeyWithSecret | null>(null);
  const [secretTitle, setSecretTitle] = useState('');
  const reset = useResetStorageKey(account, (k) => {
    setPending(null);
    setSecretTitle('Key reset');
    setSecret(k);
  });
  const full = s.keys_count >= s.keys_limit;
  const canCreate = canCreateKeys(s.status) && !full;
  const createHint = !canCreateKeys(s.status)
    ? 'Access keys can be made when object storage is active.'
    : full
      ? `You can have ${s.keys_limit} access keys. Delete one first.`
      : null;
  const firstBucket = buckets.data?.[0]?.name;

  return (
    <section className="ucard" style={{ padding: 20, gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <b>Access keys</b>
          <div className="muted" style={{ fontSize: 13 }}>
            Your apps and tools use a key to reach your buckets. {s.keys_count} of {s.keys_limit}{' '}
            keys used.
          </div>
        </div>
        <button
          className="btn primary"
          type="button"
          disabled={!canCreate}
          onClick={() => setCreating(true)}
        >
          <Plus aria-hidden="true" />
          Create key
        </button>
      </div>
      {createHint && <span className="hint">{createHint}</span>}

      {keys.isLoading ? (
        <div className="skeleton" style={{ height: 120 }} role="status" aria-label="Loading" />
      ) : keys.isError ? (
        <ErrorState error={keys.error} onRetry={() => keys.refetch()} />
      ) : keys.data?.length === 0 ? (
        <EmptyState text="No access keys yet. Create a key to use object storage from your apps." />
      ) : (
        <table className="rtable">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Key ID</th>
              <th scope="col">Permission</th>
              <th scope="col">Buckets</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {keys.data?.map((k) => (
              <tr key={k.key_id}>
                <td data-label="Name">
                  <b>{k.name}</b>
                </td>
                <td data-label="Key ID">
                  <span className="mono" style={{ wordBreak: 'break-all' }}>
                    {k.key_id}
                  </span>
                </td>
                <td data-label="Permission">{PERMISSION_LABEL[k.permission]}</td>
                <td data-label="Buckets">{keyBucketsLabel(k.buckets)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                      className="btn sm"
                      type="button"
                      aria-label={`Reset ${k.name}`}
                      disabled={reset.isPending}
                      onClick={() => setPending({ mode: 'reset', key: k })}
                    >
                      Reset
                    </button>
                    <button
                      className="btn sm danger"
                      type="button"
                      aria-label={`Delete key ${k.name}`}
                      onClick={() => setPending({ mode: 'delete', key: k })}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <CreateKeyDialog
        open={creating}
        onOpenChange={setCreating}
        account={account}
        buckets={buckets.data ?? []}
        onCreated={(k) => {
          setSecretTitle('Key created');
          setSecret(k);
        }}
      />

      <ConfirmDialog
        open={pending?.mode === 'reset'}
        onOpenChange={(o) => !o && setPending(null)}
        title={`Reset ${pending?.key.name ?? 'key'}?`}
        description="The key gets a new key ID and a new secret. The old key stops working at once. Apps that use it lose access until you give them the new secret."
        confirmLabel="Reset key"
        pending={reset.isPending}
        onConfirm={() => pending && reset.mutate(pending.key.key_id)}
      />

      <ConfirmDialog
        open={pending?.mode === 'delete'}
        onOpenChange={(o) => !o && setPending(null)}
        title={`Delete ${pending?.key.name ?? 'key'}?`}
        description="Apps that use this key lose access at once. You cannot undo this."
        confirmLabel="Delete key"
        pending={del.isPending}
        onConfirm={() =>
          pending &&
          del.mutate(
            { id: pending.key.key_id, name: pending.key.name },
            { onSuccess: () => setPending(null) },
          )
        }
      />

      <StorageSecretDialog
        secret={secret}
        title={secretTitle}
        bucket={firstBucket}
        onClose={() => setSecret(null)}
      />
    </section>
  );
}

function CreateKeyDialog({
  open,
  onOpenChange,
  account,
  buckets,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  account?: string;
  buckets: Bucket[];
  onCreated: (k: StorageKeyWithSecret) => void;
}) {
  const create = useCreateStorageKey(account, onCreated);
  const [name, setName] = useState('');
  const [permission, setPermission] = useState<StorageKeyPermission>('read_write');
  const [scope, setScope] = useState<'all' | 'chosen'>('all');
  const [chosen, setChosen] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const nameErr = validateKeyName(name);
  const scopeErr = scope === 'chosen' && chosen.length === 0 ? 'Choose at least one bucket.' : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (create.isPending || nameErr || scopeErr) return;
    create.mutate(
      {
        name: name.trim(),
        permission,
        buckets: scope === 'all' ? 'all' : chosen,
      },
      {
        onSuccess: () => {
          setName('');
          setPermission('read_write');
          setScope('all');
          setChosen([]);
          setTouched(false);
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !create.isPending && onOpenChange(o)}
      title="Create access key"
      description="You see the secret access key only once. Keep it safe."
    >
      <form id="storage-key-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="sk-name">Name</label>
          <input
            id="sk-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ci-deploy"
            maxLength={64}
            autoComplete="off"
            aria-invalid={touched && !!nameErr}
          />
          {touched && nameErr && <span className="err-t">{nameErr}</span>}
        </div>
        <div className="field" role="radiogroup" aria-label="Permission">
          <span className="fl">Permission</span>
          <div className="opts">
            {(Object.keys(PERMISSION_LABEL) as StorageKeyPermission[]).map((p) => (
              <label className="opt" key={p}>
                <input
                  type="radio"
                  name="sk-permission"
                  value={p}
                  checked={permission === p}
                  onChange={() => setPermission(p)}
                />
                <span>
                  <b>{PERMISSION_LABEL[p]}</b>
                  <small>
                    {p === 'read_write' ? 'Upload, download, delete' : 'Download and list only'}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="field" role="radiogroup" aria-label="Buckets">
          <span className="fl">Buckets</span>
          <div className="opts">
            <label className="opt">
              <input
                type="radio"
                name="sk-scope"
                value="all"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
              />
              <span>
                <b>All buckets</b>
                <small>Also the buckets you make later</small>
              </span>
            </label>
            <label className="opt">
              <input
                type="radio"
                name="sk-scope"
                value="chosen"
                checked={scope === 'chosen'}
                disabled={buckets.length === 0}
                onChange={() => setScope('chosen')}
              />
              <span>
                <b>Chosen buckets</b>
                <small>
                  {buckets.length === 0 ? 'Make a bucket first' : 'Pick the buckets below'}
                </small>
              </span>
            </label>
          </div>
          {scope === 'chosen' && buckets.length > 0 && (
            <div className="mlist">
              {buckets.map((b) => (
                <label key={b.name}>
                  <input
                    type="checkbox"
                    checked={chosen.includes(b.name)}
                    onChange={(e) =>
                      setChosen(
                        e.target.checked ? [...chosen, b.name] : chosen.filter((x) => x !== b.name),
                      )
                    }
                  />
                  <span className="mono">{b.name}</span>
                </label>
              ))}
            </div>
          )}
          {touched && scopeErr && <span className="err-t">{scopeErr}</span>}
          {create.isError && (
            <span className="err-t" role="alert">
              {create.error.message}
            </span>
          )}
        </div>
      </form>
      <footer>
        <span className="cost">Counts against the key limit</span>
        <button
          className="btn"
          type="button"
          disabled={create.isPending}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </button>
        <button
          className="btn primary"
          form="storage-key-form"
          type="submit"
          disabled={create.isPending}
        >
          Create key
        </button>
      </footer>
    </Modal>
  );
}
