'use client';

import { Plus } from 'lucide-react';
import { Page } from '@/components/Page';
import { PageHead } from '@/components/PageHead';
import { NewCard, ResourceCard } from '@/components/ResourceCard';
import { CardsSkeleton, EmptyState, ErrorState } from '@/components/States';
import { AccessState } from '@/components/ContainerAccess';
import { isNotAllowed, useAccess, useContainers } from '@/lib/api/hooks';
import { useProject } from '@/lib/project';
import { useNavActions } from '@/lib/nav-actions';

function Containers() {
  const { project } = useProject();
  const { openResource, create } = useNavActions();
  const owner = project.role === 'owner';
  const access = useAccess();
  const a = access.data;
  const ready = a?.access === 'approved' && a.vcluster === 'ready';
  // A member has no access state. The list answers 403 if the owner is not approved.
  const containers = useContainers(project.id, owner ? ready : true);

  if (owner) {
    if (access.isLoading) return <CardsSkeleton />;
    if (access.isError) return <ErrorState error={access.error} onRetry={() => access.refetch()} />;
    if (!ready) return <AccessState access={a} />;
  } else if (containers.isError && isNotAllowed(containers.error)) {
    return <AccessState member />;
  }

  return (
    <>
      <PageHead
        title="Containers"
        description="Workers that run your image all the time, with no disk. No public inbound traffic by default. To reach a port, expose it on the Networking page."
        action={
          <button className="btn primary" type="button" onClick={() => create('/containers', 'ct')}>
            <Plus aria-hidden="true" />
            Create container
          </button>
        }
      />
      {containers.isLoading ? (
        <CardsSkeleton />
      ) : containers.isError ? (
        <ErrorState error={containers.error} onRetry={() => containers.refetch()} />
      ) : containers.data?.length === 0 ? (
        <EmptyState
          text="No containers yet. Create a container to run a worker, for example a bot."
          action="Create container"
          onAction={() => create('/containers', 'ct')}
        />
      ) : (
        <div className="cards">
          {containers.data?.map((c) => (
            <ResourceCard
              key={c.id}
              r={{ kind: 'ct', ...c }}
              onOpen={() => openResource('/containers', c.id)}
            />
          ))}
          <NewCard label="Create container" onClick={() => create('/containers', 'ct')} />
        </div>
      )}
    </>
  );
}

export default function ContainersPage() {
  return (
    <Page>
      <Containers />
    </Page>
  );
}
