'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { useCatalog, useCreateSshKey, useCreateVm, useSshKeys } from '@/lib/api/hooks';
import { chooseId } from '@/lib/catalog';
import { useProject } from '@/lib/project';
import { canGenerateSshKey, downloadText, generateSshKey } from '@/lib/sshkey';
import { validateName, validateSshKey } from '@/lib/validation';

const NEW_KEY = 'new';

export function CreateVmDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { project } = useProject();
  const catalog = useCatalog();
  const create = useCreateVm(project.id);
  const [name, setName] = useState('worker-1');
  const [pickedSize, setSize] = useState<string | null>(null);
  const [pickedImage, setImage] = useState<string | null>(null);
  const size = chooseId(pickedSize, catalog.data?.vm_sizes);
  const image = chooseId(pickedImage, catalog.data?.vm_images);
  const [key, setKey] = useState('');
  const saved = useSshKeys().data ?? [];
  const saveKey = useCreateSshKey();
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [saveToAccount, setSaveToAccount] = useState(true);
  // Use a saved key unless the user chose "New key". The first saved key is the default.
  const savedChoice =
    pickedKey === NEW_KEY ? undefined : (saved.find((k) => k.id === pickedKey) ?? saved[0]);
  const [touched, setTouched] = useState(false);
  const [canGenerate, setCanGenerate] = useState(false);
  // The private key stays in this state only. It is never sent to the API.
  const [generated, setGenerated] = useState<{ file: string; privateKey: string } | null>(null);

  useEffect(() => {
    canGenerateSshKey().then(setCanGenerate);
  }, []);

  useEffect(() => {
    if (!open) setGenerated(null);
  }, [open]);

  const nameErr = validateName(name);
  const publicKey = (savedChoice ? savedChoice.public_key : key).trim();
  const keyErr = validateSshKey(publicKey);

  const generate = async () => {
    try {
      const pair = await generateSshKey(`${name}@pmservers`);
      const file = `pms-${name}`;
      setKey(pair.publicKey);
      setGenerated({ file, privateKey: pair.privateKey });
      downloadText(file, pair.privateKey);
    } catch {
      toast.error('Could not make a key in this browser. Paste a public key instead.');
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (nameErr || keyErr || !size || !image) return;
    create.mutate(
      { name, size, image, disk_gb: 10, ssh_public_key: publicKey },
      {
        onSuccess: () => {
          if (!savedChoice && saveToAccount) saveKey.mutate({ name, public_key: publicKey });
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Create virtual machine"
      description="It takes about one minute to start."
    >
      <form id="vm-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="vm-name">Name</label>
          <div className="prefix">
            <input
              id="vm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={touched && !!nameErr}
              autoComplete="off"
            />
            <span>.{project.name}.vm</span>
          </div>
          {touched && nameErr && <span className="err-t">{nameErr}</span>}
        </div>
        <div className="field" role="radiogroup" aria-label="Size">
          <span className="fl">Size</span>
          <div className="opts">
            {catalog.data?.vm_sizes.map((s) => (
              <label className="opt" key={s.id}>
                <input
                  type="radio"
                  name="size"
                  value={s.id}
                  checked={size === s.id}
                  onChange={() => setSize(s.id)}
                />
                <span>
                  <b>{s.id}</b>
                  <small>
                    {s.vcpu} vCPU · {s.memory_gib} GiB
                  </small>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="field" role="radiogroup" aria-label="Image">
          <span className="fl">Image</span>
          <div className="opts">
            {catalog.data?.vm_images.map((i) => {
              return (
                <label className="opt" key={i.id}>
                  <input
                    type="radio"
                    name="image"
                    value={i.id}
                    checked={image === i.id}
                    onChange={() => setImage(i.id)}
                  />
                  <span>
                    <b style={{ fontFamily: 'var(--font-ui)' }}>{i.name}</b>
                    <small>{i.version}</small>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="field">
          {saved.length > 0 && (
            <>
              <label htmlFor="vm-saved-key">SSH key</label>
              <select
                id="vm-saved-key"
                value={savedChoice?.id ?? NEW_KEY}
                onChange={(e) => setPickedKey(e.target.value)}
              >
                {saved.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} · {k.fingerprint}
                  </option>
                ))}
                <option value={NEW_KEY}>New key…</option>
              </select>
            </>
          )}
          {savedChoice ? (
            <span className="hint">We add this saved key to the default user.</span>
          ) : (
            <>
              <label htmlFor="vm-key">SSH public key</label>
              <textarea
                id="vm-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="ssh-ed25519 AAAA… you@laptop"
                aria-invalid={touched && !!keyErr}
              />
              {touched && keyErr ? (
                <span className="err-t">{keyErr}</span>
              ) : (
                <span className="hint">We add it to the default user.</span>
              )}
              {canGenerate && (
                <div>
                  <button className="btn sm" type="button" onClick={generate}>
                    Generate a key pair
                  </button>
                </div>
              )}
              <label className="hint" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={saveToAccount}
                  onChange={(e) => setSaveToAccount(e.target.checked)}
                />
                Save this public key to my account for next time
              </label>
            </>
          )}
          {generated && !savedChoice && (
            <span className="hint" role="status">
              The private key was downloaded as <b>{generated.file}</b>. We do not keep it and
              cannot show it again.{' '}
              <button
                className="btn sm"
                type="button"
                onClick={() => downloadText(generated.file, generated.privateKey)}
              >
                Download again
              </button>
              <br />
              Then run <code>chmod 600 {generated.file}</code> and connect with{' '}
              <code>ssh -i {generated.file} …</code>
            </span>
          )}
        </div>
      </form>
      <footer>
        <span className="cost">Counts against project limits</span>
        <button className="btn" type="button" onClick={() => onOpenChange(false)}>
          Cancel
        </button>
        <button
          className="btn primary"
          form="vm-form"
          type="submit"
          disabled={create.isPending || !size || !image}
        >
          Create VM
        </button>
      </footer>
    </Modal>
  );
}
