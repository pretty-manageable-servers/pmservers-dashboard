import type { Database, DatabaseStatus } from './api/types';

/** Client check for the database name. The API checks again. Same rule as containers. */
export const DATABASE_NAME = /^[a-z][a-z0-9-]{0,62}$/;

export function validateDatabaseName(name: string): string | null {
  return DATABASE_NAME.test(name)
    ? null
    : 'Use 1 to 63 lowercase letters, numbers or dashes. Start with a letter.';
}

/** What the customer can do about a state. The API status_message is shown too. */
export const DATABASE_STATUS_HELP: Partial<Record<DatabaseStatus, string>> = {
  read_only: 'Your databases use all of the storage limit. Writes fail. Delete data to make space.',
  suspended:
    'Your databases use much more than the storage limit, so new connections are blocked. Contact support.',
};

export const isDatabaseBusy = (s: DatabaseStatus) => s === 'provisioning' || s === 'deleting';

export function formatBytes(bytes: number | null): string {
  const units = ['B', 'KiB', 'MiB', 'GiB'];
  let v = bytes ?? 0;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${i === 0 ? v : v.toFixed(v < 10 ? 2 : 1)} ${units[i]}`;
}

export const storageLine = (d: Pick<Database, 'used_bytes' | 'storage_limit_bytes'>) =>
  `${formatBytes(d.used_bytes)} of ${formatBytes(d.storage_limit_bytes)}`;

export const storagePercent = (d: Pick<Database, 'used_bytes' | 'storage_limit_bytes'>) =>
  d.storage_limit_bytes ? ((d.used_bytes ?? 0) / d.storage_limit_bytes) * 100 : 0;

export function sizeLabel(d: { vcpu: number | null; memory_mib: number | null }): string {
  if (d.vcpu == null || d.memory_mib == null) return '';
  return `${d.vcpu} vCPU · ${d.memory_mib} MiB`;
}
