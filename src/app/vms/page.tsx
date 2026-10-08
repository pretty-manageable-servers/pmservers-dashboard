'use client';

import { Plus } from 'lucide-react';
import { Page } from '@/components/Page';
import { PageHead } from '@/components/PageHead';
import { NewCard, ResourceCard } from '@/components/ResourceCard';
import { CardsSkeleton, EmptyState, ErrorState } from '@/components/States';
import { useVms } from '@/lib/api/hooks';
import { useProject } from '@/lib/project';
import { useNavActions } from '@/lib/nav-actions';

function Vms() {
  const { project } = useProject();
  const { openResource, create } = useNavActions();
  const vms = useVms(project.id);
  return (
    <>
      <PageHead
        title="Virtual machines"
        description="Small Linux VMs. You get root, a private IP and SSH with your key."
        action={
          <button className="btn primary" type="button" onClick={() => create('/vms', 'vm')}>
            <Plus aria-hidden="true" />
            Create VM
          </button>
        }
      />
      {vms.isLoading ? (
        <CardsSkeleton />
      ) : vms.isError ? (
        <ErrorState error={vms.error} onRetry={() => vms.refetch()} />
      ) : vms.data?.length === 0 ? (
        <EmptyState
          text="No VMs yet. Create a VM to get a Linux server with SSH."
          action="Create VM"
          onAction={() => create('/vms', 'vm')}
        />
      ) : (
        <div className="cards">
          {vms.data?.map((v) => (
            <ResourceCard
              key={v.id}
              r={{ kind: 'vm', ...v }}
              onOpen={() => openResource('/vms', v.id)}
            />
          ))}
          <NewCard label="Create VM" onClick={() => create('/vms', 'vm')} />
        </div>
      )}
    </>
  );
}

export default function VmsPage() {
  return (
    <Page>
      <Vms />
    </Page>
  );
}
