'use client';

import { useState } from 'react';
import { Page } from '@/components/Page';
import { NewMenu } from '@/components/NewMenu';
import { UsageCard } from '@/components/UsageCard';
import { ResourceCard, type Resource } from '@/components/ResourceCard';
import { ActivityFeed } from '@/components/ActivityFeed';
import { CardsSkeleton, EmptyState, ErrorState } from '@/components/States';
import { useAiKeys, useContainers, useDatabases, useUsage } from '@/lib/api/hooks';
import { useProject } from '@/lib/project';
import { useNavActions } from '@/lib/nav-actions';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'ct', label: 'Containers' },
  { id: 'db', label: 'Databases' },
  { id: 's3', label: 'Buckets', soon: true },
  { id: 'ai', label: 'AI keys' },
];

function Overview() {
  const { project } = useProject();
  const { openResource, create } = useNavActions();
  const [filter, setFilter] = useState('all');
  const usage = useUsage(project.id);
  const keys = useAiKeys(project.id);
  // A 403 means no container access. Show no containers then, and no error.
  const containers = useContainers(project.id);
  const databases = useDatabases(project.id);

  const all: Resource[] = [
    ...(containers.data ?? []).map((c) => ({ kind: 'ct' as const, ...c })),
    ...(databases.data ?? []).map((d) => ({ kind: 'db' as const, ...d })),
    ...(keys.data ?? []).map((k) => ({ kind: 'ai' as const, ...k })),
  ];
  const shown = all.filter((r) => filter === 'all' || r.kind === filter);
  const running = all.filter((r) => r.status === 'running').length;
  const issues = all.filter(
    (r) =>
      r.status === 'failed' ||
      r.status === 'unknown' ||
      r.status === 'suspended' ||
      r.status === 'read_only',
  ).length;
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
          {keys.isLoading ? (
            <CardsSkeleton />
          ) : keys.isError ? (
            <ErrorState error={keys.error} onRetry={() => keys.refetch()} />
          ) : shown.length === 0 ? (
            filter === 'ai' ? (
              <EmptyState
                text="No AI API keys yet. Create a key to call AI models."
                action="Create API key"
                onAction={() => create('/ai', 'ai')}
              />
            ) : filter === 'db' ? (
              <EmptyState
                text="No databases yet. Create a Postgres database for your containers."
                action="Create database"
                onAction={() => create('/databases', 'db')}
              />
            ) : filter === 'ct' ? (
              <EmptyState
                text="No containers yet. Create a container to run a worker, for example a bot."
                action="Create container"
                onAction={() => create('/containers', 'ct')}
              />
            ) : (
              <EmptyState
                text="No resources yet. Create a container to run a worker, for example a bot."
                action="Create container"
                onAction={() => create('/containers', 'ct')}
              />
            )
          ) : (
            <div className="cards">
              {shown.map((r) => (
                <ResourceCard
                  key={r.id}
                  r={r}
                  onOpen={() =>
                    openResource({ ct: '/containers', db: '/databases', ai: '/ai' }[r.kind], r.id)
                  }
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
