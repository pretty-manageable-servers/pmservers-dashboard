import type { Container, ContainerUpdate, Runtime } from './api/types';

/** Client checks for containers. The API checks again. Keep them the same as the API. */

export const CONTAINER_NAME = /^[a-z][a-z0-9-]{0,62}$/;
const IMAGE =
  /^(?:(?<host>[a-z0-9.-]+(?::[0-9]{1,5})?)\/)?(?<path>[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*)(?::[A-Za-z0-9_][A-Za-z0-9_.-]{0,127})?(?:@sha256:[a-f0-9]{64})?$/;
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
export const MAX_ENV = 50;
const MAX_ENV_BYTES = 32 * 1024;

export function validateContainerName(name: string): string | null {
  return CONTAINER_NAME.test(name)
    ? null
    : 'Use 1 to 63 lowercase letters, numbers or dashes. Start with a letter.';
}

export const MAX_PORTS = 5;

/** Read "8080, 9000" as a list of numbers. Returns null if a part is not a whole number. */
export function parsePorts(text: string): number[] | null {
  const parts = text
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const ports = parts.map((p) => (/^[0-9]{1,5}$/.test(p) ? Number(p) : NaN));
  return ports.some(Number.isNaN) ? null : ports;
}

export function validatePorts(text: string): string | null {
  const ports = parsePorts(text);
  if (!ports) return 'Enter port numbers with commas. Example: 8080, 9000';
  if (ports.length > MAX_PORTS) return `You can open ${MAX_PORTS} ports at most.`;
  if (ports.some((p) => p < 1 || p > 65535)) return 'A port must be from 1 to 65535.';
  if (new Set(ports).size !== ports.length) return 'A port is in the list two times.';
  return null;
}

export const portsText = (ports: number[]) => ports.join(', ');

export function validateImage(image: string): string | null {
  if (image.length > 512) return 'The image reference is too long.';
  return IMAGE.test(image) ? null : 'Enter a valid image. Example: ghcr.io/owner/app:1.0';
}

const dockerHub = (host: string) =>
  host === 'index.docker.io' || host === 'registry-1.docker.io' ? 'docker.io' : host;

/**
 * The registry host of an image, or null if the image is not valid.
 * Docker rule: the first part is a host only if it has `.` or `:` or is `localhost`.
 */
export function imageHost(image: string): string | null {
  if (validateImage(image)) return null;
  const host = IMAGE.exec(image)?.groups?.host;
  if (host && (host.includes('.') || host.includes(':') || host === 'localhost'))
    return dockerHub(host);
  return 'docker.io';
}

/** The same as the API: `https://GHCR.io/` is `ghcr.io`. */
export function normalizeHost(host: string): string {
  return dockerHub(
    host
      .trim()
      .toLowerCase()
      .replace(/^https:\/\//, '')
      .replace(/\/+$/, ''),
  );
}

export interface EnvRow {
  name: string;
  value: string;
}

/** Check env rows. Rows with an empty name and value are ignored. */
export function validateEnv(rows: EnvRow[]): string | null {
  const used = rows.filter((r) => r.name || r.value);
  if (used.length > MAX_ENV) return `You can set ${MAX_ENV} environment variables.`;
  const seen = new Set<string>();
  let total = 0;
  for (const r of used) {
    if (!ENV_NAME.test(r.name)) return `The variable name "${r.name}" is not valid.`;
    if (seen.has(r.name)) return `The variable ${r.name} is set two times.`;
    seen.add(r.name);
    total += r.name.length + new TextEncoder().encode(r.value).length;
  }
  return total > MAX_ENV_BYTES ? 'Environment variables are too large (32 KiB at most).' : null;
}

export const envMap = (rows: EnvRow[]) =>
  Object.fromEntries(rows.filter((r) => r.name || r.value).map((r) => [r.name, r.value]));

/** Credentials that can pull this image: the host must match. */
export function credentialsFor<T extends { host: string }>(image: string, items: T[]): T[] {
  const host = imageHost(image);
  return host ? items.filter((c) => c.host === host) : [];
}

export const runtimeLabel = (r: string) => (r === 'native' ? 'Native' : 'gVisor');

export const sizeLabel = (s: { vcpu: number | null; memory_mib: number | null }) =>
  s.vcpu === null || s.memory_mib === null ? '' : `${s.vcpu} vCPU · ${s.memory_mib} MiB`;

/** The env edit of the dialog: typed values of current names, removed names and new rows. */
export type EnvEdit = {
  names: string[];
  values: Record<string, string>;
  removed: string[];
  added: EnvRow[];
};

/** `env_set` and `env_unset` for the PATCH body. Empty parts are left out. */
export function envChanges(edit: EnvEdit): {
  env_set?: Record<string, string>;
  env_unset?: string[];
} {
  const set: Record<string, string> = {};
  for (const name of edit.names) {
    if (edit.values[name] && !edit.removed.includes(name)) set[name] = edit.values[name];
  }
  Object.assign(set, envMap(edit.added));
  // A removed name that is added again is a change of its value.
  const unset = edit.removed.filter((n) => !(n in set));
  const out: { env_set?: Record<string, string>; env_unset?: string[] } = {};
  if (Object.keys(set).length) out.env_set = set;
  if (unset.length) out.env_unset = unset;
  return out;
}

/** Check the new rows. A new name must not be a kept name. Count the total. */
export function validateEnvEdit(edit: EnvEdit): string | null {
  const kept = edit.names.filter((n) => !edit.removed.includes(n));
  const added = edit.added.filter((r) => r.name || r.value);
  const bad = validateEnv(added);
  if (bad) return bad;
  const clash = added.find((r) => kept.includes(r.name));
  if (clash) return `The variable ${clash.name} exists. Type a value in its row to change it.`;
  return kept.length + added.length > MAX_ENV
    ? `You can set ${MAX_ENV} environment variables.`
    : null;
}

/** Only the fields that changed. Env uses `env_set` and `env_unset`, so other variables keep their values. */
export function changedFields(
  c: Container,
  next: {
    image: string;
    size: string;
    credential: string | null;
    runtime: Runtime;
    ports: number[];
    env: { env_set?: Record<string, string>; env_unset?: string[] };
  },
): ContainerUpdate {
  const body: ContainerUpdate = { detach_tunnel: false };
  if (next.image !== c.image) body.image = next.image;
  if (next.size !== c.size) body.size = next.size;
  if (next.credential !== c.registry_credential_id) body.registry_credential_id = next.credential;
  if (next.runtime !== c.runtime) body.runtime = next.runtime;
  if (next.ports.join() !== c.ports.join()) body.ports = next.ports;
  if (next.env.env_set) body.env_set = next.env.env_set;
  if (next.env.env_unset) body.env_unset = next.env.env_unset;
  return body;
}
