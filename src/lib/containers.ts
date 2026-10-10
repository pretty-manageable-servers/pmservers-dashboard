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

/** Only the fields that changed. `env` only in "replace" mode, because it replaces all. */
export function changedFields(
  c: Container,
  next: {
    image: string;
    size: string;
    credential: string | null;
    runtime: Runtime;
    env: Record<string, string> | null;
  },
): ContainerUpdate {
  const body: ContainerUpdate = {};
  if (next.image !== c.image) body.image = next.image;
  if (next.size !== c.size) body.size = next.size;
  if (next.credential !== c.registry_credential_id) body.registry_credential_id = next.credential;
  if (next.runtime !== c.runtime) body.runtime = next.runtime;
  if (next.env) body.env = next.env;
  return body;
}
