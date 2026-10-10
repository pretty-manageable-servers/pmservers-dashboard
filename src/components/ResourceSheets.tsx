'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { SideSheet } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { CopyField } from './CopyField';
import { Sparkline } from './Sparkline';
import { StatusDot } from './StatusDot';
import { TYPE_ICON } from './icons';
import {
  useCatalog,
  useContainerAction,
  useContainerLogs,
  useDeleteAiKey,
  useDeleteContainer,
  useDeleteDatabase,
  useResetDatabasePassword,
  useSetDatabaseVector,
  useDeleteVm,
  useRegistryCredentials,
  useRotateAiKey,
  useVmAction,
  useVmMetrics,
} from '@/lib/api/hooks';
import { projectHref, useProject } from '@/lib/project';
import { isBusy } from '@/lib/status';
import { timeAgo, timeAgoLong } from '@/lib/utils';
import { runtimeLabel, sizeLabel } from '@/lib/containers';
import {
  DATABASE_STATUS_HELP,
  formatBytes,
  sizeLabel as dbSizeLabel,
  storageLine,
  storagePercent,
} from '@/lib/databases';
import type { AiKey, Container, Database, DatabaseSecret, Vm } from '@/lib/api/types';

const EditContainerDialog = dynamic(() =>
  import('./EditContainerDialog').then((m) => m.EditContainerDialog),
);

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
  // The jump host goes through a Cloudflare tunnel, so ssh needs cloudflared as ProxyCommand.
  const sshConfig = [
    'Host pms-jump',
    `  HostName ${vm.ssh_host}`,
    '  User jump',
    '  ProxyCommand cloudflared access ssh --hostname %h',
  ].join('\n');
  const ssh = `ssh -J pms-jump ${vm.ssh_user}@${vm.private_ip}`;
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
            <Link className="btn sm" href={projectHref('/vms/console', project.id, { vm: vm.id })}>
              Console
            </Link>
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
        {!vm.ssh_host ? (
          <span className="hint">SSH is not available here. Use the console.</span>
        ) : !vm.private_ip ? (
          <span className="hint">The SSH command shows when the VM has a private IP.</span>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            <span className="hint">
              One time: install <code>cloudflared</code>, then add this to{' '}
              <code>~/.ssh/config</code>.{' '}
              <a href="https://docs.pmservers.org/vms/ssh/" target="_blank" rel="noreferrer">
                Setup help, or use Docker
              </a>
            </span>
            <CopyField value={sshConfig} block />
            <span className="hint">Then connect:</span>
            <CopyField value={ssh} />
          </div>
        )}
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

/** The last log lines. Stay at the bottom unless the user scrolled up. */
function ContainerLogs({ c }: { c: Container }) {
  const { project } = useProject();
  const [previous, setPrevious] = useState(false);
  const live = c.status === 'running' || c.status === 'provisioning';
  const logs = useContainerLogs(project.id, c.id, {
    previous: c.status === 'failed' && previous,
    enabled: c.status !== 'deleting',
    live: live && !previous,
  });
  const box = useRef<HTMLPreElement>(null);
  const atBottom = useRef(true);
  useEffect(() => {
    if (c.status !== 'failed') setPrevious(false);
  }, [c.status]);
  useLayoutEffect(() => {
    const el = box.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [logs.data]);
  const lines = logs.data ?? [];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div className="lbl">Logs</div>
        {c.status === 'failed' && (
          <label
            className="hint"
            style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}
          >
            <input
              type="checkbox"
              checked={previous}
              onChange={(e) => setPrevious(e.target.checked)}
            />
            Previous run
          </label>
        )}
      </div>
      {logs.isError ? (
        <span className="err-t">{logs.error.message}</span>
      ) : logs.isLoading ? (
        <span className="hint">Loading logs…</span>
      ) : lines.length === 0 ? (
        <span className="hint">No logs yet.</span>
      ) : (
        <pre
          className="logs"
          ref={box}
          aria-label="Logs"
          onScroll={(e) => {
            const el = e.currentTarget;
            atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          }}
        >
          {lines.map((l, i) => (
            <div key={i}>
              <span className="t">{l.time.slice(11, 19)}</span> {l.message}
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}

export function ContainerSheet({ c, onClose }: { c: Container; onClose: () => void }) {
  const { project } = useProject();
  const action = useContainerAction(project.id);
  const del = useDeleteContainer(project.id);
  const credentials = useRegistryCredentials();
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const busy = isBusy(c.status) || action.isPending;
  const act = (a: 'start' | 'stop' | 'restart') =>
    action.mutate({ id: c.id, name: c.name, action: a });
  const credential = c.registry_credential_id
    ? (credentials.data?.find((r) => r.id === c.registry_credential_id)?.name ??
      'A credential of another user')
    : 'None (public image)';

  return (
    <SideSheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={c.name}
      icon={TYPE_ICON.ct}
      subtitle={`Container · ${project.name}`}
      status={<StatusDot status={c.status} />}
    >
      <div className="acts">
        {c.status === 'running' && (
          <button className="btn sm" type="button" disabled={busy} onClick={() => act('stop')}>
            Stop
          </button>
        )}
        {c.status === 'stopped' && (
          <button className="btn sm" type="button" disabled={busy} onClick={() => act('start')}>
            Start
          </button>
        )}
        {c.status !== 'stopped' && (
          <button className="btn sm" type="button" disabled={busy} onClick={() => act('restart')}>
            Restart
          </button>
        )}
        <button
          className="btn sm"
          type="button"
          disabled={c.status === 'deleting'}
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
        <button
          className="btn sm danger"
          type="button"
          disabled={c.status === 'deleting'}
          onClick={() => setConfirm(true)}
        >
          Delete
        </button>
      </div>
      {(c.status === 'failed' || c.status === 'unknown') && c.status_message && (
        <div className="card err" style={{ padding: '12px 14px' }}>
          {c.status_message}
        </div>
      )}
      <ContainerLogs c={c} />
      <Kv
        rows={[
          ...(c.status_message ? [['Status', c.status_message] as [string, string]] : []),
          [
            'Image',
            <span className="mono" key="i" style={{ wordBreak: 'break-all' }}>
              {c.image}
            </span>,
          ],
          [
            'Size',
            <>
              <span className="mono">{c.size}</span>
              {sizeLabel(c) ? ` · ${sizeLabel(c)}` : ''}
            </>,
          ],
          ['Runtime', runtimeLabel(c.runtime)],
          [
            'Ports',
            c.ports.length === 0 ? (
              'None'
            ) : (
              <span key="p" style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                {c.ports.map((p) => (
                  <span key={p} className="badge mono">
                    {p}
                  </span>
                ))}
                <span className="hint">Private. Same project only.</span>
              </span>
            ),
          ],
          ...(c.internal_host && c.ports.length > 0
            ? [
                [
                  'Internal address',
                  <span key="h" className="mono">
                    {c.ports.map((p) => `${c.internal_host}:${p}`).join(', ')}
                  </span>,
                ] as [string, React.ReactNode],
              ]
            : []),
          ['Registry credential', credential],
          [
            'Variables',
            c.env_names.length === 0 ? (
              'None'
            ) : (
              <span key="e" style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                {c.env_names.map((n) => (
                  <span key={n} className="badge mono">
                    {n}
                  </span>
                ))}
                <span className="hint">Values are hidden.</span>
              </span>
            ),
          ],
          ['Created', timeAgoLong(c.created_at)],
          ['Updated', timeAgoLong(c.updated_at)],
        ]}
      />
      {editing && (
        <EditContainerDialog container={c} onOpenChange={(o) => !o && setEditing(false)} />
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${c.name}?`}
        description="This stops the container and deletes it. You cannot undo this."
        confirmLabel="Delete container"
        pending={del.isPending}
        onConfirm={() =>
          del.mutate(
            { id: c.id, name: c.name },
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

export function DatabaseSheet({
  d,
  onClose,
  onSecret,
}: {
  d: Database;
  onClose: () => void;
  onSecret: (s: DatabaseSecret) => void;
}) {
  const { project } = useProject();
  const vector = useSetDatabaseVector(project.id);
  const reset = useResetDatabasePassword(project.id, onSecret);
  const del = useDeleteDatabase(project.id);
  const [confirm, setConfirm] = useState<'reset' | 'delete' | null>(null);
  const deleting = d.status === 'deleting';
  const pct = storagePercent(d);
  const help = DATABASE_STATUS_HELP[d.status];

  return (
    <SideSheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={d.name}
      icon={TYPE_ICON.db}
      subtitle={`Database · ${project.name}`}
      status={<StatusDot status={d.status} />}
    >
      <div className="acts">
        <button
          className="btn sm"
          type="button"
          disabled={d.status !== 'running' || vector.isPending}
          onClick={() => vector.mutate({ id: d.id, vector: !d.vector })}
        >
          {d.vector ? 'Turn off vector' : 'Turn on vector'}
        </button>
        <button
          className="btn sm"
          type="button"
          disabled={deleting}
          onClick={() => setConfirm('reset')}
        >
          Reset password
        </button>
        <button
          className="btn sm danger"
          type="button"
          disabled={deleting}
          onClick={() => setConfirm('delete')}
        >
          Delete
        </button>
      </div>
      {d.status === 'failed' || d.status === 'unknown' || d.status === 'suspended' ? (
        <div className="card err" style={{ padding: '12px 14px' }}>
          {help ?? d.status_message}
        </div>
      ) : help ? (
        <div className="card" style={{ padding: '12px 14px' }}>
          {help}
        </div>
      ) : null}
      <div>
        <div className="lbl" style={{ marginBottom: 8 }}>
          Storage of the account
        </div>
        <div style={{ fontSize: 22, fontWeight: 600 }} className="num">
          {formatBytes(d.used_bytes)}{' '}
          <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>
            of {formatBytes(d.storage_limit_bytes)}
          </span>
        </div>
        <div
          className="bar-mini"
          role="progressbar"
          aria-label="Storage"
          aria-valuenow={Math.round(Math.min(100, pct))}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i className={pct > 75 ? 'hi' : ''} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <span className="hint">
          The limit is for all databases of your account. This database uses {storageLine(d)}.
        </span>
      </div>
      <Kv
        rows={[
          ...(d.status_message && !['failed', 'unknown', 'suspended'].includes(d.status)
            ? [['Status', d.status_message] as [string, string]]
            : []),
          [
            'Host',
            <span className="mono" key="h">
              {d.host}
            </span>,
          ],
          [
            'Port',
            <span className="mono" key="p">
              {d.port}
            </span>,
          ],
          [
            'Database',
            <span className="mono" key="d">
              {d.database}
            </span>,
          ],
          [
            'User',
            <span className="mono" key="u">
              {d.user}
            </span>,
          ],
          ['Engine', `Postgres${d.vector ? ' with pgvector' : ''}`],
          [
            'Size',
            <>
              <span className="mono">{d.size}</span>
              {dbSizeLabel(d) ? ` · ${dbSizeLabel(d)}` : ''}
            </>,
          ],
          ['Created', timeAgoLong(d.created_at)],
          ['Updated', timeAgoLong(d.updated_at)],
        ]}
      />
      <p className="hint" style={{ margin: 0 }}>
        Reachable only from your containers in this account. There are no backups.
      </p>
      <ConfirmDialog
        open={confirm === 'reset'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Reset the password of ${d.name}?`}
        description="The old password stops working in a few seconds. Apps that use it will lose access."
        confirmLabel="Reset password"
        pending={reset.isPending}
        onConfirm={() => reset.mutate(d.id, { onSuccess: () => setConfirm(null) })}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${d.name}?`}
        description="There are no backups. All data in this database is lost. You cannot undo this."
        confirmLabel="Delete database"
        pending={del.isPending}
        onConfirm={() =>
          del.mutate(
            { id: d.id, name: d.name },
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
