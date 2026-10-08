'use client';

import { useState } from 'react';
import { Page } from '@/components/Page';
import { NewMenu } from '@/components/NewMenu';
import { UsageCard } from '@/components/UsageCard';
import { ResourceCard, type Resource } from '@/components/ResourceCard';
import { ActivityFeed } from '@/components/ActivityFeed';
import { CardsSkeleton, EmptyState, ErrorState } from '@/components/States';
import { useAiKeys, useUsage, useVms } from '@/lib/api/hooks';
import { useProject } from '@/lib/project';
import { useNavActions } from '@/lib/nav-actions';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'vm', label: 'VMs' },
  { id: 'ct', label: 'Containers', soon: true },
  { id: 's3', label: 'Buckets', soon: true },
  { id: 'ai', label: 'AI keys' },
];

function Overview() {
  const { project } = useProject();
  const { openResource, create } = useNavActions();
  const [filter, setFilter] = useState('all');
  const usage = useUsage(project.id);
  const vms = useVms(project.id);
  const keys = useAiKeys(project.id);

  const all: Resource[] = [
    ...(vms.data ?? []).map((v) => ({ kind: 'vm' as const, ...v })),
    ...(keys.data ?? []).map((k) => ({ kind: 'ai' as const, ...k })),
  ];
  const shown = all.filter((r) => filter === 'all' || r.kind === filter);
  const running = all.filter((r) => r.status === 'running').length;
  const issues = all.filter((r) => r.status === 'failed').length;
  const u = usage.data;

  return (
    <>
      <div className="head">
        <div>
          <h1>{project.name}</h1>
          <div className="meta">
            <span style={{ color: 'var(--ok)' }}>●</span>
            <span style={{ marginLeft: -8 }}>{running} running</span>
            {issues > 0 && <span style={{ color: 'var(--bad)' }}>● {issues} needs attention</span>}
            <span className="mono">{project.region}</span>
            <span>
              Created{' '}
              {new Date(project.created_at).toLocaleDateString('en', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
        <NewMenu />
      </div>

      <section className="usage" aria-label="Usage">
        {u ? (
          <>
            <UsageCard
              label="vCPU"
              used={u.vcpu.used}
              limit={u.vcpu.limit}
              series={u.vcpu.series}
            />
            <UsageCard
              label="Memory"
              used={u.memory_gib.used}
              limit={u.memory_gib.limit}
              unit=" GiB"
              series={u.memory_gib.series}
            />
            <UsageCard
              label="Storage"
              used={u.storage_gb.used}
              limit={u.storage_gb.limit}
              unit=" GB"
              series={u.storage_gb.series}
            />
            <UsageCard
              label="AI spend"
              used={u.ai_spend_usd.used}
              limit={u.ai_spend_usd.limit}
              prefix="$"
              series={u.ai_spend_usd.series}
              color="var(--accent-2)"
            />
          </>
        ) : usage.isError ? (
          <ErrorState error={usage.error} onRetry={() => usage.refetch()} />
        ) : (
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 150 }} />
          ))
        )}
      </section>

      <div className="split">
        <section style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div className="section-t">
            <h2>Resources</h2>
            <div className="chips">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  disabled={f.soon}
                  title={f.soon ? 'Coming soon' : undefined}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                  {f.soon ? ' · soon' : ''}
                </button>
              ))}
            </div>
          </div>
          {vms.isLoading || keys.isLoading ? (
            <CardsSkeleton />
          ) : vms.isError || keys.isError ? (
            <ErrorState
              error={vms.error ?? keys.error}
              onRetry={() => {
                vms.refetch();
                keys.refetch();
              }}
            />
          ) : shown.length === 0 ? (
            <EmptyState
              text="No resources yet. Create a VM to get a Linux server with SSH."
              action="Create VM"
              onAction={() => create('/vms', 'vm')}
            />
          ) : (
            <div className="cards">
              {shown.map((r) => (
                <ResourceCard
                  key={r.id}
                  r={r}
                  onOpen={() => openResource(r.kind === 'vm' ? '/vms' : '/ai', r.id)}
                />
              ))}
            </div>
          )}
        </section>
        <ActivityFeed />
      </div>
    </>
  );
}

export default function OverviewPage() {
  return (
    <Page>
      <Overview />
    </Page>
  );
}
