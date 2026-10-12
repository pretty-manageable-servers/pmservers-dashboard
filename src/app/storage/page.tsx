'use client';

import { useState } from 'react';
import { Page } from '@/components/Page';
import { PageHead } from '@/components/PageHead';
import { ComingSoon } from '@/components/ComingSoon';
import { CardsSkeleton, ErrorState } from '@/components/States';
import { StorageApproval, StorageIntro, STORAGE_DESCRIPTION } from '@/components/StorageIntro';
import { StorageOverview } from '@/components/StorageOverview';
import { StorageBuckets } from '@/components/StorageBuckets';
import { StorageKeys } from '@/components/StorageKeys';
import { useAccess, useStorage } from '@/lib/api/hooks';
import { useProject } from '@/lib/project';
import { isNotAvailable, storageAccount } from '@/lib/storage';

function Storage() {
  const { project } = useProject();
  const account = storageAccount(project);
  const owner = project.role === 'owner';
  const access = useAccess();
  const approved = access.data?.access === 'approved';
  // A member has no access state here. The API checks the owner's account on enable.
  const storage = useStorage(account, !owner || approved);
  // Set when the API says the feature is off for the deployment. The page then shows "Coming soon".
  const [unavailable, setUnavailable] = useState(false);

  if (owner) {
    if (access.isLoading) return <CardsSkeleton />;
    if (access.isError) return <ErrorState error={access.error} onRetry={() => access.refetch()} />;
    if (!approved && access.data) return <StorageApproval access={access.data} />;
  }

  if (unavailable || (storage.isError && isNotAvailable(storage.error))) {
    return <ComingSoon title="Object storage" />;
  }
  if (storage.isLoading) return <CardsSkeleton />;
  if (storage.isError) {
    return <ErrorState error={storage.error} onRetry={() => storage.refetch()} />;
  }

  const s = storage.data;
  if (!s || s.status === null) {
    return <StorageIntro account={account} onUnavailable={() => setUnavailable(true)} />;
  }

  return (
    <>
      <PageHead title="Object storage" description={STORAGE_DESCRIPTION} />
      <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
        <StorageOverview s={s} account={account} />
        <StorageBuckets s={s} account={account} />
        <StorageKeys s={s} account={account} />
      </div>
    </>
  );
}

export default function StoragePage() {
  return (
    <Page>
      <Storage />
    </Page>
  );
}
