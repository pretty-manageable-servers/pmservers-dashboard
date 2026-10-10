'use client';

import { useState } from 'react';
import { Modal } from './Modal';
import { useCatalog, useCreateDatabase } from '@/lib/api/hooks';
import { chooseId } from '@/lib/catalog';
import { validateDatabaseName } from '@/lib/databases';
import { useProject } from '@/lib/project';
import type { DatabaseSecret } from '@/lib/api/types';

export function CreateDatabaseDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (d: DatabaseSecret) => void;
}) {
  const { project } = useProject();
  const catalog = useCatalog();
  const create = useCreateDatabase(project.id);
  const [name, setName] = useState('db-1');
  const [pickedSize, setSize] = useState<string | null>(null);
  const sizes = catalog.data?.database_sizes;
  const size = chooseId(pickedSize, sizes);
  const [vector, setVector] = useState(false);
  const [touched, setTouched] = useState(false);
  const nameErr = validateDatabaseName(name);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (nameErr || !size) return;
    create.mutate(
      { name, size, vector },
      {
        onSuccess: (d) => {
          onOpenChange(false);
          onCreated(d);
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Create database"
      description="Postgres 18. It takes about one minute to start. There are no backups."
    >
      <form id="db-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="db-name">Name</label>
          <input
            id="db-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={touched && !!nameErr}
            autoComplete="off"
          />
          {touched && nameErr && <span className="err-t">{nameErr}</span>}
        </div>
        <div className="field" role="radiogroup" aria-label="Size">
          <span className="fl">Size</span>
          <div className="opts">
            {sizes?.map((s) => (
              <label className="opt" key={s.id}>
                <input
                  type="radio"
                  name="db-size"
                  value={s.id}
                  checked={size === s.id}
                  onChange={() => setSize(s.id)}
                />
                <span>
                  <b>{s.id}</b>
                  <small>
                    {s.vcpu} vCPU · {s.memory_mib} MiB
                  </small>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="hint" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={vector} onChange={(e) => setVector(e.target.checked)} />
            Enable vector (pgvector)
          </label>
        </div>
      </form>
      <footer>
        <span className="cost">Counts against project limits</span>
        <button className="btn" type="button" onClick={() => onOpenChange(false)}>
          Cancel
        </button>
        <button className="btn primary" form="db-form" type="submit" disabled={create.isPending}>
          Create database
        </button>
      </footer>
    </Modal>
  );
}
