'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { useAccess, useCatalog, useRegistryCredentials } from '@/lib/api/hooks';
import { credentialsFor, imageHost, type EnvRow } from '@/lib/containers';
import { projectHref, useProject } from '@/lib/project';
import type { Runtime } from '@/lib/api/types';

/** The credential to use: the picked one only if its host matches the image. */
export function useCredentialChoice(image: string, picked: string | null) {
  const all = useRegistryCredentials().data ?? [];
  const usable = credentialsFor(image, all);
  return { usable, chosen: usable.find((c) => c.id === picked)?.id ?? null };
}

export function ImageField(props: {
  id: string;
  image: string;
  setImage: (v: string) => void;
  error: string | null;
  touched: boolean;
}) {
  return (
    <div className="field">
      <label htmlFor={props.id}>Image</label>
      <input
        id={props.id}
        value={props.image}
        onChange={(e) => props.setImage(e.target.value.trim())}
        placeholder="ghcr.io/owner/app:1.0"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={props.touched && !!props.error}
      />
      {props.touched && props.error ? (
        <span className="err-t">{props.error}</span>
      ) : (
        <span className="hint">
          Images must be linux/amd64 and run as a non-root user. Example: ghcr.io/owner/app:1.0
        </span>
      )}
    </div>
  );
}

export function SizeField({ size, setSize }: { size: string; setSize: (v: string) => void }) {
  const catalog = useCatalog();
  return (
    <div className="field" role="radiogroup" aria-label="Size">
      <span className="fl">Size</span>
      <div className="opts">
        {catalog.data?.container_sizes.map((s) => (
          <label className="opt" key={s.id}>
            <input
              type="radio"
              name="ct-size"
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
  );
}

export function CredentialField(props: {
  id: string;
  image: string;
  chosen: string | null;
  setPicked: (v: string | null) => void;
}) {
  const { project } = useProject();
  const { usable } = useCredentialChoice(props.image, props.chosen);
  const host = imageHost(props.image);
  return (
    <div className="field">
      <label htmlFor={props.id}>Registry credential</label>
      <select
        id={props.id}
        value={props.chosen ?? ''}
        onChange={(e) => props.setPicked(e.target.value || null)}
      >
        <option value="">None (public image)</option>
        {usable.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} · {c.username}@{c.host}
          </option>
        ))}
      </select>
      <span className="hint">
        {host ? `Only credentials for ${host} show here. ` : ''}
        <Link href={projectHref('/settings', project.id)}>Add a credential</Link>
      </span>
    </div>
  );
}

/** A select for the runtime. Shown only when the account can use the native runtime. */
export function RuntimeField(props: {
  id: string;
  runtime: Runtime;
  setRuntime: (v: Runtime) => void;
}) {
  const access = useAccess();
  if (access.data?.runtime !== 'native') return null;
  return (
    <div className="field">
      <label htmlFor={props.id}>Runtime</label>
      <select
        id={props.id}
        value={props.runtime}
        onChange={(e) => props.setRuntime(e.target.value as Runtime)}
      >
        <option value="gvisor">gVisor (isolated, the default)</option>
        <option value="native">Native (faster, less isolated)</option>
      </select>
    </div>
  );
}

export function EnvEditor(props: {
  rows: EnvRow[];
  setRows: (rows: EnvRow[]) => void;
  error: string | null;
  touched: boolean;
}) {
  const { rows, setRows } = props;
  const change = (i: number, patch: Partial<EnvRow>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="field">
      <span className="fl">Environment variables</span>
      {rows.map((r, i) => (
        <div className="env-row" key={i}>
          <input
            aria-label={`Variable ${i + 1} name`}
            value={r.name}
            onChange={(e) => change(i, { name: e.target.value.trim() })}
            placeholder="NAME"
            autoComplete="off"
            spellCheck={false}
            className="mono"
          />
          <input
            aria-label={`Variable ${i + 1} value`}
            type="password"
            value={r.value}
            onChange={(e) => change(i, { value: e.target.value })}
            placeholder="value"
            autoComplete="new-password"
          />
          <button
            className="iconbtn"
            type="button"
            aria-label={`Remove variable ${i + 1}`}
            onClick={() => setRows(rows.filter((_, j) => j !== i))}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
      <div>
        <button
          className="btn sm"
          type="button"
          onClick={() => setRows([...rows, { name: '', value: '' }])}
        >
          Add variable
        </button>
      </div>
      {props.touched && props.error ? (
        <span className="err-t">{props.error}</span>
      ) : (
        <span className="hint">We keep values encrypted. We never show them again.</span>
      )}
    </div>
  );
}
