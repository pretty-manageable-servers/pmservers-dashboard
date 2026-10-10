'use client';

import { useState } from 'react';
import { Modal } from './Modal';
import {
  CredentialField,
  EnvEditor,
  ImageField,
  RuntimeField,
  SizeField,
  useCredentialChoice,
} from './ContainerFields';
import { useUpdateContainer } from '@/lib/api/hooks';
import { changedFields, envMap, validateEnv, validateImage, type EnvRow } from '@/lib/containers';
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
  const [replaceEnv, setReplaceEnv] = useState(false);
  // The API never returns values. Start with the names and empty values.
  const [env, setEnv] = useState<EnvRow[]>(c.env_names.map((name) => ({ name, value: '' })));
  const [touched, setTouched] = useState(false);

  const imageErr = validateImage(image);
  const envErr = replaceEnv ? validateEnv(env) : null;
  const body = changedFields(c, {
    image,
    size,
    credential: chosen,
    runtime,
    env: replaceEnv ? envMap(env) : null,
  });
  const nothing = Object.keys(body).length === 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (imageErr || envErr || nothing) return;
    update.mutate({ id: c.id, body }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      title={`Edit ${c.name}`}
      description="A change redeploys the container. It restarts."
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
        <div className="field" role="radiogroup" aria-label="Environment variables">
          <span className="fl">Environment variables</span>
          <label className="hint" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="radio"
              name="env-mode"
              checked={!replaceEnv}
              onChange={() => setReplaceEnv(false)}
            />
            Keep the current variables ({c.env_names.length})
          </label>
          <label className="hint" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="radio"
              name="env-mode"
              checked={replaceEnv}
              onChange={() => setReplaceEnv(true)}
            />
            Replace all variables
          </label>
          {replaceEnv && (
            <span className="hint">
              We do not show the current values. Enter all values again. Variables that you remove
              are deleted.
            </span>
          )}
        </div>
        {replaceEnv && <EnvEditor rows={env} setRows={setEnv} error={envErr} touched={touched} />}
      </form>
      <footer>
        <span className="cost">{nothing ? 'No changes' : 'The container restarts'}</span>
        <button className="btn" type="button" onClick={() => onOpenChange(false)}>
          Cancel
        </button>
        <button
          className="btn primary"
          form="ct-edit-form"
          type="submit"
          disabled={update.isPending || nothing}
        >
          Save and redeploy
        </button>
      </footer>
    </Modal>
  );
}
