import { statusLabel, type Status } from '@/lib/status';
import type { DatabaseStatus } from '@/lib/api/types';

export function StatusDot({ status }: { status: Status | DatabaseStatus }) {
  const label = status === 'read_only' ? 'Read-only' : statusLabel(status as Status);
  return <span className={`dot ${status}`}>{label}</span>;
}
