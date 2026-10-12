'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from './Modal';
import {
  CredentialField,
  ImageField,
  PortsField,
  RuntimeField,
  SizeField,
  useCredentialChoice,
} from './ContainerFields';
import { useUpdateContainer } from '@/lib/api/hooks';
import {
  changedFields,
  envChanges,
  parsePorts,
  portsText as formatPorts,
  validateEnvEdit,
  validateImage,
  validatePorts,
  type EnvRow,
} from '@/lib/containers';
import { useProject } from '@/lib/project';
import type { Container, Runtime } from '@/lib/api/types';

export function EditContainerDialog({
  container: c,
  onOpenChange,
}: {
  container: Container;
  onOpenChange: (o: boolean) => void;
}) {
  const { project } = useProject();
  const update = useUpdateContainer(project.id);
  const [image, setImage] = useState(c.image);
  const [size, setSize] = useState(c.size);
  const [picked, setPicked] = useState<string | null>(c.registry_credential_id);
  const { chosen } = useCredentialChoice(image, picked);
  const [runtime, setRuntime] = useState<Runtime>(c.runtime);
  const [portsText, setPortsText] = useState(formatPorts(c.ports));
  // The API never returns values. Each current name has an empty value. A typed value changes it.
  const [values, setValues] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [added, setAdded] = useState<EnvRow[]>([]);
  const [touched, setTouched] = useState(false);

  const imageErr = validateImage(image);
  const edit = { names: c.env_names, values, removed, added };
  const envErr = validateEnvEdit(edit);
  const portsErr = validatePorts(portsText);
  const body = changedFields(c, {
    image,
    size,
    credential: chosen,
    runtime,
    ports: parsePorts(portsText) ?? c.ports,
    env: envChanges(edit),
  });
  const nothing = Object.keys(body).length === 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (imageErr || envErr || portsErr || nothing) return;
    update.mutate({ id: c.id, body }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      title={`Edit ${c.name}`}
      description="App changes restart the container."
    >
      <form id="ct-edit-form" onSubmit={submit} noValidate>
        <ImageField
          id="ct-edit-image"
          image={image}
          setImage={setImage}
          error={imageErr}
          touched={touched}
        />
        <SizeField size={size} setSize={setSize} />
        <CredentialField id="ct-edit-cred" image={image} chosen={chosen} setPicked={setPicked} />
        <RuntimeField id="ct-edit-runtime" runtime={runtime} setRuntime={setRuntime} />
        <PortsField
          id="ct-edit-ports"
          value={portsText}
          setValue={setPortsText}
          error={portsErr}
          touched={touched}
        />
        <div className="field">
          <span className="fl">Environment variables</span>
          {c.env_names.map((name) => {
            const gone = removed.includes(name);
            return (
              <div className="env-row" key={name}>
                <span
                  className="mono"
                  style={gone ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}
                >
                  {name}
                </span>
                <input
                  aria-label={`${name} value`}
                  type="password"
                  value={values[name] ?? ''}
                  onChange={(e) => setValues({ ...values, [name]: e.target.value })}
                  placeholder="Unchanged (hidden)"
                  autoComplete="new-password"
                  disabled={gone}
                />
                <button
                  className="btn sm"
                  type="button"
                  aria-label={`${gone ? 'Undo remove' : 'Remove'} ${name}`}
                  onClick={() =>
                    setRemoved(gone ? removed.filter((n) => n !== name) : [...removed, name])
                  }
                >
                  {gone ? 'Undo' : 'Remove'}
                </button>
              </div>
            );
          })}
          {added.map((r, i) => (
            <div className="env-row" key={i}>
              <input
                aria-label={`New variable ${i + 1} name`}
                value={r.name}
                onChange={(e) =>
                  setAdded(
                    added.map((x, j) => (j === i ? { ...x, name: e.target.value.trim() } : x)),
                  )
                }
                placeholder="NAME"
                autoFocus={i === added.length - 1 && !r.name}
                autoComplete="off"
                spellCheck={false}
                className="mono"
              />
              <input
                aria-label={`New variable ${i + 1} value`}
                type="password"
                value={r.value}
                onChange={(e) =>
                  setAdded(added.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
                }
                placeholder="value"
                autoComplete="new-password"
              />
              <button
                className="iconbtn"
                type="button"
                aria-label={`Remove new variable ${i + 1}`}
                onClick={() => setAdded(added.filter((_, j) => j !== i))}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
          <div>
            <button
              className="btn sm"
              type="button"
              onClick={() => setAdded([...added, { name: '', value: '' }])}
            >
              Add variable
            </button>
          </div>
          {/* Show env errors at once, so a clash is clear before Save. */}
          {envErr ? (
            <span className="err-t">{envErr}</span>
          ) : (
            <span className="hint">Values are hidden. Leave a value empty to keep it.</span>
          )}
        </div>
      </form>
      <footer>
        <span className="cost">{nothing ? 'No changes' : 'App changes restart the container'}</span>
        <button className="btn" type="button" onClick={() => onOpenChange(false)}>
          Cancel
        </button>
        <button
          className="btn primary"
          form="ct-edit-form"
          type="submit"
          disabled={update.isPending || nothing || !!envErr}
        >
          Save changes
        </button>
      </footer>
    </Modal>
  );
}
