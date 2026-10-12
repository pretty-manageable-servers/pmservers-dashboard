'use client';

import { Plus } from 'lucide-react';
import { Page } from '@/components/Page';
import { PageHead } from '@/components/PageHead';
import { NewCard, ResourceCard } from '@/components/ResourceCard';
import { CardsSkeleton, EmptyState, ErrorState } from '@/components/States';
import { useDatabases } from '@/lib/api/hooks';
import { useProject } from '@/lib/project';
import { useNavActions } from '@/lib/nav-actions';

function Databases() {
  const { project } = useProject();
  const { openResource, create } = useNavActions();
  const databases = useDatabases(project.id);

  return (
    <>
      <PageHead
        title="Databases"
        description="Postgres, with optional pgvector. Reachable from your containers in this project, and through Networking."
        action={
          <button className="btn primary" type="button" onClick={() => create('/databases', 'db')}>
            <Plus aria-hidden="true" />
            Create database
          </button>
        }
      />
      {databases.isLoading ? (
        <CardsSkeleton />
      ) : databases.isError ? (
        <ErrorState error={databases.error} onRetry={() => databases.refetch()} />
      ) : databases.data?.length === 0 ? (
        <EmptyState
          text="No databases yet. Create a Postgres database for your containers."
          action="Create database"
          onAction={() => create('/databases', 'db')}
        />
      ) : (
        <div className="cards">
          {databases.data?.map((d) => (
            <ResourceCard
              key={d.id}
              r={{ kind: 'db', ...d }}
              onOpen={() => openResource('/databases', d.id)}
            />
          ))}
          <NewCard label="Create database" onClick={() => create('/databases', 'db')} />
        </div>
      )}
    </>
  );
}

export default function DatabasesPage() {
  return (
    <Page>
      <Databases />
    </Page>
  );
}
