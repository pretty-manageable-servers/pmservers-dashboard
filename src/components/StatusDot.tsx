import { statusLabel, type Status } from '@/lib/status';

export function StatusDot({ status }: { status: Status }) {
  return <span className={`dot ${status}`}>{statusLabel(status)}</span>;
}
