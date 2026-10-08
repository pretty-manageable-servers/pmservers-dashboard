'use client';

import { useState } from 'react';
import { SideSheet } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { CopyField } from './CopyField';
import { Sparkline } from './Sparkline';
import { StatusDot } from './StatusDot';
import { TYPE_ICON } from './icons';
import {
  useCatalog,
  useDeleteAiKey,
  useDeleteVm,
  useRotateAiKey,
  useVmAction,
  useVmMetrics,
} from '@/lib/api/hooks';
import { useProject } from '@/lib/project';
import { isBusy } from '@/lib/status';
import { timeAgo } from '@/lib/utils';
import type { AiKey, Vm } from '@/lib/api/types';

const Kv = ({ rows }: { rows: [string, React.ReactNode][] }) => (
  <dl className="kv">
    {rows.map(([k, v]) => (
      <div key={k} style={{ display: 'contents' }}>
        <dt>{k}</dt>
        <dd>{v}</dd>
      </div>
    ))}
  </dl>
);

export function VmSheet({ vm, onClose }: { vm: Vm; onClose: () => void }) {
  const { project } = useProject();
  const catalog = useCatalog();
  const metrics = useVmMetrics(project.id, vm.id, vm.status === 'running');
  const action = useVmAction(project.id);
  const del = useDeleteVm(project.id);
  const [confirm, setConfirm] = useState(false);
  const busy = isBusy(vm.status);
  const spec = catalog.data?.vm_sizes.find((s) => s.id === vm.size);
  const ssh = `ssh ${vm.ssh_user}@${vm.ssh_host}`;
  const act = (a: 'start' | 'stop' | 'restart') =>
    action.mutate({ id: vm.id, name: vm.name, action: a });

  return (
    <SideSheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={vm.name}
      icon={TYPE_ICON.vm}
      subtitle={`Virtual machine · ${project.name}`}
      status={<StatusDot status={vm.status} />}
    >
      <div className="acts">
        {vm.status === 'running' && (
          <>
            <button
              className="btn sm"
              type="button"
              disabled={action.isPending}
              onClick={() => act('stop')}
            >
              Stop
            </button>
            <button
              className="btn sm"
              type="button"
              disabled={action.isPending}
              onClick={() => act('restart')}
            >
              Restart
            </button>
          </>
        )}
        {vm.status === 'stopped' && (
          <button
            className="btn sm"
            type="button"
            disabled={action.isPending}
            onClick={() => act('start')}
          >
            Start
          </button>
        )}
        <button
          className="btn sm danger"
          type="button"
          disabled={busy}
          onClick={() => setConfirm(true)}
        >
          Delete
        </button>
      </div>
      {vm.status === 'failed' && vm.status_message && (
        <div className="card err" style={{ padding: '12px 14px' }}>
          {vm.status_message}
        </div>
      )}
      <div>
        <div className="lbl" style={{ marginBottom: 8 }}>
          SSH
        </div>
        <CopyField value={ssh} />
      </div>
      {metrics.data && vm.status === 'running' && (
        <div>
          <div className="lbl" style={{ marginBottom: 8 }}>
            CPU, last hour
          </div>
          <Sparkline values={metrics.data} height={60} />
        </div>
      )}
      <Kv
        rows={[
          [
            'Size',
            <>
              <span className="mono">{vm.size}</span>
              {spec ? ` · ${spec.vcpu} vCPU · ${spec.memory_gib} GiB` : ''}
            </>,
          ],
          ['Image', vm.image],
          [
            'Private IP',
            <span className="mono" key="ip">
              {vm.private_ip ?? '—'}
            </span>,
          ],
          ['Disk', `${vm.disk_gb} GB`],
          ['Created', `${timeAgo(vm.created_at)} ago`],
        ]}
      />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${vm.name}?`}
        description="This deletes the VM and its disk. You cannot undo this."
        confirmLabel="Delete VM"
        pending={del.isPending}
        onConfirm={() =>
          del.mutate(
            { id: vm.id, name: vm.name },
            {
              onSuccess: () => {
                setConfirm(false);
                onClose();
              },
            },
          )
        }
      />
    </SideSheet>
  );
}

export function AiKeySheet({
  k,
  onClose,
  onSecret,
}: {
  k: AiKey;
  onClose: () => void;
  onSecret: (s: string) => void;
}) {
  const { project } = useProject();
  const rotate = useRotateAiKey(project.id);
  const del = useDeleteAiKey(project.id);
  const [confirm, setConfirm] = useState<'rotate' | 'revoke' | null>(null);
  const pct = k.budget_usd ? Math.min(100, (k.spend_usd / k.budget_usd) * 100) : 0;

  return (
    <SideSheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={k.name}
      icon={TYPE_ICON.ai}
      subtitle={`API key · ${project.name}`}
      status={<StatusDot status={k.status} />}
    >
      <div className="acts">
        <button className="btn sm" type="button" onClick={() => setConfirm('rotate')}>
          Rotate key
        </button>
        <button className="btn sm danger" type="button" onClick={() => setConfirm('revoke')}>
          Revoke
        </button>
      </div>
      <div>
        <div className="lbl" style={{ marginBottom: 8 }}>
          Spend this month
        </div>
        <div style={{ fontSize: 22, fontWeight: 600 }} className="num">
          ${k.spend_usd.toFixed(2)}{' '}
          <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>
            of ${k.budget_usd.toFixed(2)}
          </span>
        </div>
        <div className="bar-mini">
          <i className={pct > 75 ? 'hi' : ''} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <Kv
        rows={[
          [
            'Key',
            <span className="mono" key="p">
              {k.prefix}••••••••
            </span>,
          ],
          [
            'Models',
            <span key="m" style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
              {k.models.map((m) => (
                <span key={m} className="badge mono">
                  {m}
                </span>
              ))}
            </span>,
          ],
          ['Rate limit', `${k.rate_limit_rpm} requests / min`],
          ['Created', `${timeAgo(k.created_at)} ago`],
        ]}
      />
      <ConfirmDialog
        open={confirm === 'rotate'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Rotate ${k.name}?`}
        description="You get a new key. Apps that use the old key stop working."
        confirmLabel="Rotate key"
        pending={rotate.isPending}
        onConfirm={() =>
          rotate.mutate(k.id, {
            onSuccess: (r) => {
              setConfirm(null);
              onSecret(r.secret);
            },
          })
        }
      />
      <ConfirmDialog
        open={confirm === 'revoke'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Revoke ${k.name}?`}
        description="The key stops working at once. You cannot undo this."
        confirmLabel="Revoke key"
        pending={del.isPending}
        onConfirm={() =>
          del.mutate(
            { id: k.id, name: k.name },
            {
              onSuccess: () => {
                setConfirm(null);
                onClose();
              },
            },
          )
        }
      />
    </SideSheet>
  );
}
