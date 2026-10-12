'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { copyText } from './CopyField';
import { Modal } from './Modal';
import { EmptyState, ErrorState } from './States';
import {
  useCreateBucket,
  useDeleteBucket,
  useStorageBuckets,
  useUpdateBucket,
} from '@/lib/api/hooks';
import type { Bucket, Storage } from '@/lib/api/types';
import { formatBytes } from '@/lib/databases';
import {
  BUCKET_RULES,
  BUCKET_STATUS_LABEL,
  canCreateBuckets,
  isBucketBusy,
  publicUrl,
  validateBucketName,
} from '@/lib/storage';

/** The buckets of the account: the list, the public switch, create and delete. */
export function StorageBuckets({ s, account }: { s: Storage; account?: string }) {
  const buckets = useStorageBuckets(account);
  const update = useUpdateBucket(account);
  const del = useDeleteBucket(account);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Bucket | null>(null);
  const full = s.buckets_count >= s.buckets_limit;
  const canCreate = canCreateBuckets(s.status) && !full;
  const createHint = !canCreateBuckets(s.status)
    ? 'You cannot make buckets now. Object storage must be active or read-only.'
    : full
      ? `You can have ${s.buckets_limit} buckets. Delete one first.`
      : null;

  return (
    <section className="ucard" style={{ padding: 20, gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <b>Buckets</b>
          <div className="muted" style={{ fontSize: 13 }}>
            A bucket holds your files. {s.buckets_count} of {s.buckets_limit} buckets used.
          </div>
        </div>
        <button
          className="btn primary"
          type="button"
          disabled={!canCreate}
          onClick={() => setCreating(true)}
        >
          <Plus aria-hidden="true" />
          Create bucket
        </button>
      </div>
      {createHint && <span className="hint">{createHint}</span>}

      {buckets.isLoading ? (
        <div className="skeleton" style={{ height: 120 }} role="status" aria-label="Loading" />
      ) : buckets.isError ? (
        <ErrorState error={buckets.error} onRetry={() => buckets.refetch()} />
      ) : buckets.data?.length === 0 ? (
        <EmptyState text="No buckets yet. Create a bucket to store files." />
      ) : (
        <table className="rtable">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Size</th>
              <th scope="col">Objects</th>
              <th scope="col">Public read</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {buckets.data?.map((b) => {
              const busy = isBucketBusy(b.status);
              return (
                <tr key={b.name}>
                  <td data-label="Name">
                    <b className="mono">{b.name}</b>
                    {b.status_message && (
                      <div className={b.status === 'failed' ? 'err-t' : 'hint'}>
                        {b.status_message}
                      </div>
                    )}
                    {b.public_read && (
                      <div
                        className="hint"
                        style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}
                      >
                        <span className="mono" style={{ wordBreak: 'break-all' }}>
                          {publicUrl(b.name)}
                        </span>
                        <button
                          className="btn sm"
                          type="button"
                          aria-label={`Copy the public URL of ${b.name}`}
                          onClick={() => copyText(publicUrl(b.name))}
                        >
                          Copy
                        </button>
                      </div>
                    )}
                  </td>
                  <td data-label="Size" className="num">
                    {formatBytes(b.used_bytes)}
                  </td>
                  <td data-label="Objects" className="num">
                    {b.object_count}
                  </td>
                  <td data-label="Public read">
                    <label className="switch">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={b.public_read}
                        disabled={busy || update.isPending}
                        aria-label={`Public read for ${b.name}`}
                        onChange={(e) =>
                          update.mutate({ name: b.name, public_read: e.target.checked })
                        }
                      />
                      <span>{b.public_read ? 'On' : 'Off'}</span>
                    </label>
                  </td>
                  <td data-label="Status">
                    <span className={`dot ${b.status}`}>{BUCKET_STATUS_LABEL[b.status]}</span>
                  </td>
                  <td>
                    <button
                      className="btn sm danger"
                      type="button"
                      aria-label={`Delete bucket ${b.name}`}
                      disabled={busy}
                      onClick={() => setDeleting(b)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <CreateBucketDialog open={creating} onOpenChange={setCreating} account={account} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'bucket'}?`}
        description="A bucket must be empty. Delete all its files first, or the delete fails. You cannot undo this."
        confirmLabel="Delete bucket"
        pending={del.isPending}
        onConfirm={() =>
          deleting && del.mutate(deleting.name, { onSuccess: () => setDeleting(null) })
        }
      />
    </section>
  );
}

function CreateBucketDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  account?: string;
}) {
  const create = useCreateBucket(account);
  const [name, setName] = useState('');
  const [publicRead, setPublicRead] = useState(false);
  const [touched, setTouched] = useState(false);
  const nameErr = name ? validateBucketName(name) : 'Enter a bucket name.';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (create.isPending || nameErr) return;
    create.mutate(
      { name, public_read: publicRead },
      {
        onSuccess: () => {
          setName('');
          setPublicRead(false);
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
      title="Create bucket"
      description="Bucket names are unique in all of PMServers."
    >
      <form id="bucket-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="bucket-name">Name</label>
          <input
            id="bucket-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-bucket"
            autoComplete="off"
            aria-invalid={touched && !!nameErr}
            aria-describedby="bucket-rules"
          />
          <ul id="bucket-rules" className="hint" style={{ margin: 0, paddingLeft: 18 }}>
            {BUCKET_RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {touched && nameErr && (
            <span className="err-t" role="alert">
              {nameErr}
            </span>
          )}
          {create.isError && (
            <span className="err-t" role="alert">
              {create.error.message}
            </span>
          )}
        </div>
        <div className="field">
          <label className="hint" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={publicRead}
              onChange={(e) => setPublicRead(e.target.checked)}
            />
            Public read. Anyone with a link can read the files.
          </label>
          {publicRead && name && !nameErr && (
            <span className="hint">
              Public URL: <span className="mono">{publicUrl(name)}</span>
            </span>
          )}
        </div>
      </form>
      <footer>
        <span className="cost">Counts against the bucket limit</span>
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
          form="bucket-form"
          type="submit"
          disabled={create.isPending}
        >
          Create bucket
        </button>
      </footer>
    </Modal>
  );
}
