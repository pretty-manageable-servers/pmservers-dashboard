'use client';

import { Page } from '@/components/Page';
import { PageHead } from '@/components/PageHead';
import { ConnectorCard } from '@/components/ConnectorCard';
import { ConnectorTargets } from '@/components/ConnectorTargets';
import { MEMBER_TEXT } from '@/components/ContainerAccess';
import Link from 'next/link';
import { projectHref } from '@/lib/project';
import { CardsSkeleton, EmptyState, ErrorState } from '@/components/States';
import { isNotAllowed, useAccess, useAvailableTargets, useConnectors } from '@/lib/api/hooks';
import { CONNECTOR_KINDS, pageView } from '@/lib/connectors';
import { useProject } from '@/lib/project';

function Networking() {
  const { project } = useProject();
  const owner = project.role === 'owner';
  const access = useAccess();
  const a = access.data;
  const ready = a?.access === 'approved' && a.vcluster === 'ready';
  // A member has no access state of their own. The list answers 403 if the owner is not approved.
  const connectors = useConnectors(project.id, owner ? ready : true);
  const available = useAvailableTargets(project.id, owner ? ready : true);

  const view = pageView({
    owner,
    accessLoading: access.isLoading,
    accessError: access.isError,
    accessReady: ready,
    connectorsLoading: connectors.isLoading,
    connectorsError: connectors.isError,
    targetsLoading: available.isLoading,
    targetsError: available.isError,
    memberDenied: !owner && connectors.isError && isNotAllowed(connectors.error),
  });

  const head = (
    <PageHead
      title="Networking"
      description="Reach your containers and databases from outside the project. Tailscale is for your team. Cloudflare Tunnel is for public websites."
    />
  );

  if (view === 'loading') {
    return (
      <>
        {head}
        <CardsSkeleton count={2} />
      </>
    );
  }
  if (view === 'error') {
    const error = access.isError
      ? access.error
      : connectors.isError
        ? connectors.error
        : available.error;
    return (
      <>
        {head}
        <ErrorState
          error={error}
          onRetry={() => {
            access.refetch();
            connectors.refetch();
            available.refetch();
          }}
        />
      </>
    );
  }
  if (view === 'access' || view === 'member-access') {
    // Connectors need container access. The text points to the Containers page, which shows the state.
    return (
      <>
        {head}
        <section className="ucard" style={{ padding: 20, gap: 12 }}>
          <b>Networking needs container access</b>
          {view === 'member-access' ? (
            <span className="muted">{MEMBER_TEXT}</span>
          ) : (
            <span className="muted">
              Open <Link href={projectHref('/containers', project.id)}>Containers</Link> to see the
              access state of your account.
            </span>
          )}
        </section>
      </>
    );
  }

  const list = connectors.data ?? [];
  return (
    <>
      {head}
      {available.data?.length === 0 && (
        <EmptyState text="No containers or databases yet. Create one, then choose what the connectors can reach." />
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {CONNECTOR_KINDS.map((kind) => (
          <ConnectorCard
            key={kind}
            kind={kind}
            projectId={project.id}
            connector={list.find((c) => c.kind === kind)}
          />
        ))}
      </div>
      <ConnectorTargets projectId={project.id} connectors={list} available={available.data ?? []} />
    </>
  );
}

export default function NetworkingPage() {
  return (
    <Page>
      <Networking />
    </Page>
  );
}
