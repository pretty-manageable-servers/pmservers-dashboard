import type { components } from '@/lib/api/schema';

export type Status = components['schemas']['Status'];

const BUSY: Status[] = ['pending', 'provisioning', 'deleting'];

export const isBusy = (s: Status) => BUSY.includes(s);

export const statusLabel = (s: Status): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Poll every 3 s while any item changes state. Stop when all are stable. */
export function pollInterval(items: { status: Status }[] | undefined): number | false {
  return items?.some((i) => isBusy(i.status)) ? 3000 : false;
}
