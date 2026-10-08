import { TYPE_ICON } from './icons';
import { Sparkline } from './Sparkline';
import { StatusDot } from './StatusDot';
import { timeAgo } from '@/lib/utils';
import { useVmMetrics } from '@/lib/api/hooks';
import { useProject } from '@/lib/project';
import type { AiKey, Vm } from '@/lib/api/types';

export type Resource = ({ kind: 'vm' } & Vm) | ({ kind: 'ai' } & AiKey);

const LABEL = { vm: 'Virtual machine', ai: 'API key' };

export function infoLine(r: Resource): string {
  if (r.kind === 'vm') return `${r.size} · ${r.image}${r.private_ip ? ` · ${r.private_ip}` : ''}`;
  return `${r.prefix}… · $${r.spend_usd.toFixed(2)} of $${r.budget_usd}`;
}

function VmSpark({ id }: { id: string }) {
  const { project } = useProject();
  const m = useVmMetrics(project.id, id, true);
  return m.data ? <Sparkline values={m.data} /> : null;
}

export function ResourceCard({ r, onOpen }: { r: Resource; onOpen: () => void }) {
  const failed = r.kind === 'vm' && r.status === 'failed';
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
      {failed && r.kind === 'vm' && r.status_message ? (
        <div className="err">{r.status_message}</div>
      ) : r.kind === 'vm' && r.status === 'running' ? (
        <VmSpark id={r.id} />
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
