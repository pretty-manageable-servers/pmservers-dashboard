'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from './ConfirmDialog';
import { useCreateSshKey, useDeleteSshKey, useSshKeys } from '@/lib/api/hooks';
import type { SshKey } from '@/lib/api/types';
import { canGenerateSshKey, downloadText, generateSshKey } from '@/lib/sshkey';
import { validateName, validateSshKey } from '@/lib/validation';

/** Saved public keys. The account keeps public keys only. A private key never leaves the browser. */
export function SshKeysCard() {
  const keys = useSshKeys();
  const create = useCreateSshKey();
  const del = useDeleteSshKey();
  const [name, setName] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [touched, setTouched] = useState(false);
  const [canGenerate, setCanGenerate] = useState(false);
  const [file, setFile] = useState<string | null>(null);
  const [removing, setRemoving] = useState<SshKey | null>(null);

  useEffect(() => {
    canGenerateSshKey().then(setCanGenerate);
  }, []);

  const nameErr = validateName(name);
  const keyErr = validateSshKey(publicKey);

  const generate = async () => {
    if (nameErr) {
      setTouched(true);
      return;
    }
    try {
      const pair = await generateSshKey(`${name}@pmservers`);
      setPublicKey(pair.publicKey);
      setFile(`pms-${name}`);
      downloadText(`pms-${name}`, pair.privateKey);
    } catch {
      toast.error('Could not make a key in this browser. Paste a public key instead.');
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (nameErr || keyErr) return;
    create.mutate(
      { name, public_key: publicKey.trim() },
      {
        onSuccess: () => {
          setName('');
          setPublicKey('');
          setFile(null);
          setTouched(false);
        },
      },
    );
  };

  return (
    <section className="ucard" style={{ padding: 20, gap: 12 }}>
      <div>
        <b>SSH keys</b>
        <div className="muted" style={{ fontSize: 13 }}>
          We keep public keys only. The database jump host accepts these keys for `pms db connect`.
        </div>
      </div>
      {keys.isError ? (
        <span className="err-t">{keys.error.message}</span>
      ) : keys.data && keys.data.length > 0 ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {keys.data.map((k) => (
            <li
              key={k.id}
              style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
            >
              <b>{k.name}</b>
              <span className="mono muted" style={{ flex: '1 1 240px', wordBreak: 'break-all' }}>
                {k.fingerprint}
              </span>
              <button className="btn sm danger" type="button" onClick={() => setRemoving(k)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        keys.data && <span className="muted">No saved keys yet.</span>
      )}
      <form onSubmit={submit} noValidate className="field" style={{ margin: 0 }}>
        <label htmlFor="sk-name">Key name</label>
        <input
          id="sk-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-laptop"
          autoComplete="off"
          aria-invalid={touched && !!nameErr}
        />
        {touched && nameErr && <span className="err-t">{nameErr}</span>}
        <label htmlFor="sk-key">Public key</label>
        <textarea
          id="sk-key"
          value={publicKey}
          onChange={(e) => setPublicKey(e.target.value)}
          placeholder="ssh-ed25519 AAAA… you@laptop"
          aria-invalid={touched && !!keyErr}
        />
        {touched && keyErr && <span className="err-t">{keyErr}</span>}
        {file && (
          <span className="hint" role="status">
            The private key was downloaded as <b>{file}</b>. We do not keep it and cannot show it
            again. Run <code>chmod 600 {file}</code> before you use it.
          </span>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" type="submit" disabled={create.isPending}>
            Save key
          </button>
          {canGenerate && (
            <button className="btn" type="button" onClick={generate}>
              Generate a key pair
            </button>
          )}
        </div>
      </form>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete ${removing?.name ?? 'key'}?`}
        description="You cannot use this key to connect after you delete it."
        confirmLabel="Delete key"
        pending={del.isPending}
        onConfirm={() =>
          removing && del.mutate(removing.id, { onSuccess: () => setRemoving(null) })
        }
      />
    </section>
  );
}
