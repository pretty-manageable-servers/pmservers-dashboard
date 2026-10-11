'use client';

import { useState } from 'react';
import { Modal } from './Modal';
import {
  CredentialField,
  EnvEditor,
  ImageField,
  PortsField,
  RuntimeField,
  SizeField,
  useCredentialChoice,
} from './ContainerFields';
import { useCatalog, useCreateContainer } from '@/lib/api/hooks';
import { chooseId } from '@/lib/catalog';
import {
  envMap,
  parsePorts,
  validateContainerName,
  validateEnv,
  validateImage,
  validatePorts,
  type EnvRow,
} from '@/lib/containers';
import { useProject } from '@/lib/project';
import type { Runtime } from '@/lib/api/types';

export function CreateContainerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { project } = useProject();
  const catalog = useCatalog();
  const create = useCreateContainer(project.id);
  const [name, setName] = useState('worker-1');
  const [image, setImage] = useState('');
  const [pickedSize, setSize] = useState<string | null>(null);
  const size = chooseId(pickedSize, catalog.data?.container_sizes);
  const [picked, setPicked] = useState<string | null>(null);
  const { chosen } = useCredentialChoice(image, picked);
  const [env, setEnv] = useState<EnvRow[]>([]);
  const [runtime, setRuntime] = useState<Runtime>('gvisor');
  const [portsText, setPortsText] = useState('');
  const [tunnelToken, setTunnelToken] = useState('');
  const [tunnelPort, setTunnelPort] = useState('');
  const [touched, setTouched] = useState(false);

  const nameErr = validateContainerName(name);
  const imageErr = validateImage(image);
  const envErr = validateEnv(env);
  const portsErr = validatePorts(portsText);
  const declaredPorts = parsePorts(portsText) ?? [];
  const tunnelErr = tunnelToken && (!tunnelPort || !declaredPorts.includes(Number(tunnelPort)))
    ? 'Choose a tunnel port that is also declared in Ports.'
    : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (nameErr || imageErr || envErr || portsErr || tunnelErr || !size) return;
    create.mutate(
      {
        name,
        type: 'worker',
        image,
        size,
        registry_credential_id: chosen,
        env: envMap(env),
        runtime,
        ports: parsePorts(portsText) ?? [],
        ...(tunnelToken ? { tunnel_port: Number(tunnelPort), tunnel_token: tunnelToken } : {}),
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Create container"
      description="A worker that runs all the time. It takes about one minute to start."
    >
      <form id="ct-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="ct-name">Name</label>
          <input
            id="ct-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={touched && !!nameErr}
            autoComplete="off"
          />
          {touched && nameErr && <span className="err-t">{nameErr}</span>}
        </div>
        <ImageField
          id="ct-image"
          image={image}
          setImage={setImage}
          error={imageErr}
          touched={touched}
        />
        <SizeField size={size} setSize={setSize} />
        <CredentialField id="ct-cred" image={image} chosen={chosen} setPicked={setPicked} />
        <RuntimeField id="ct-runtime" runtime={runtime} setRuntime={setRuntime} />
        <PortsField
          id="ct-ports"
          value={portsText}
          setValue={setPortsText}
          error={portsErr}
          touched={touched}
        />
        <div className="field">
          <span className="fl">Managed Cloudflare Tunnel (optional)</span>
          <label htmlFor="ct-tunnel-port">Origin port</label>
          <select id="ct-tunnel-port" value={tunnelPort} onChange={(e) => setTunnelPort(e.target.value)}>
            <option value="">Choose a declared port</option>
            {declaredPorts.map((port) => <option key={port} value={port}>{port}</option>)}
          </select>
          <label htmlFor="ct-tunnel-token">Connector token</label>
          <input id="ct-tunnel-token" type="password" value={tunnelToken}
            onChange={(e) => setTunnelToken(e.target.value)} autoComplete="new-password"
            placeholder="Paste or type the Cloudflare token" />
          {touched && tunnelErr ? <span className="err-t">{tunnelErr}</span> : (
            <span className="hint">Encrypted by PMS and hidden after saving. Your tunnel can reach any service in this project. Use a separate project to limit this.</span>
          )}
        </div>
        <EnvEditor rows={env} setRows={setEnv} error={envErr} touched={touched} />
      </form>
      <footer>
        <span className="cost">
          {tunnelToken ? 'Connector uses 0.05 vCPU and 128 MiB from your compute allowance' : 'Counts against project limits'}
        </span>
        <button className="btn" type="button" onClick={() => onOpenChange(false)}>
          Cancel
        </button>
        <button className="btn primary" form="ct-form" type="submit" disabled={create.isPending}>
          Create container
        </button>
      </footer>
    </Modal>
  );
}
