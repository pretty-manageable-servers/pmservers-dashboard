'use client';

import { useState } from 'react';
import { Modal } from './Modal';
import { useCatalog, useCreateVm } from '@/lib/api/hooks';
import { chooseId } from '@/lib/catalog';
import { useProject } from '@/lib/project';
import { validateName, validateSshKey } from '@/lib/validation';

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
  const [touched, setTouched] = useState(false);

  const nameErr = validateName(name);
  const keyErr = validateSshKey(key);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (nameErr || keyErr || !size || !image) return;
    create.mutate(
      { name, size, image, disk_gb: 10, ssh_public_key: key.trim() },
      { onSuccess: () => onOpenChange(false) },
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
        </div>
      </form>
      <footer>
        <span className="cost">Counts against project limits</span>
        <button className="btn" type="button" onClick={() => onOpenChange(false)}>
          Cancel
        </button>
        <button className="btn primary" form="vm-form" type="submit" disabled={create.isPending}>
          Create VM
        </button>
      </footer>
    </Modal>
  );
}
