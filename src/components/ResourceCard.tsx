import { TYPE_ICON } from './icons';
import { StatusDot } from './StatusDot';
import { timeAgo } from '@/lib/utils';
import type { AiKey, Container, Database } from '@/lib/api/types';
import { runtimeLabel, sizeLabel } from '@/lib/containers';
import { sizeLabel as dbSizeLabel, storageLine } from '@/lib/databases';

export type Resource =
  ({ kind: 'ct' } & Container) | ({ kind: 'db' } & Database) | ({ kind: 'ai' } & AiKey);

const LABEL = { ct: 'Container', db: 'Database', ai: 'API key' };

export function infoLine(r: Resource): string {
  if (r.kind === 'ct') return `${sizeLabel(r)} · ${runtimeLabel(r.runtime)} · ${r.image}`;
  if (r.kind === 'db')
    return `Postgres${r.vector ? ' + vector' : ''} · ${dbSizeLabel(r)} · ${storageLine(r)}`;
  return `${r.prefix}… · $${r.spend_usd.toFixed(2)} of $${r.budget_usd}`;
}

export function ResourceCard({ r, onOpen }: { r: Resource; onOpen: () => void }) {
  const failed =
    (r.kind === 'ct' || r.kind === 'db') &&
    (r.status === 'failed' ||
      r.status === 'unknown' ||
      r.status === 'suspended' ||
      r.status === 'read_only');
  return (
    <button className="card" type="button" onClick={onOpen}>
      <div className="top">
        <span className="ricon">{TYPE_ICON[r.kind]}</span>
        <div style={{ minWidth: 0 }}>
          <div className="nm">{r.name}</div>
          <div className="ty">
            {LABEL[r.kind]} · {timeAgo(r.created_at)}
          </div>
        </div>
        <span className="st">
          <StatusDot status={r.status} />
        </span>
      </div>
      <div className="info">{infoLine(r)}</div>
      {failed && 'status_message' in r && r.status_message ? (
        <div className="err">{r.status_message}</div>
      ) : null}
    </button>
  );
}

export function NewCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="card new" type="button" onClick={onClick}>
      <span aria-hidden="true" style={{ fontSize: 18 }}>
        ＋
      </span>
      {label}
    </button>
  );
}
