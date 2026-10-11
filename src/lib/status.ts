import type { components } from '@/lib/api/schema';

export type Status = components['schemas']['ContainerStatus'];

const BUSY: Status[] = ['provisioning', 'deleting'];

export const isBusy = (s: Status) => BUSY.includes(s);

export const statusLabel = (s: Status): string => s.charAt(0).toUpperCase() + s.slice(1);
