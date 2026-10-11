'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { DatabaseSecret } from '@/lib/api/types';
import { useQueryParam, useProject } from '@/lib/project';
import { useAiKeys, useContainers, useDatabases } from '@/lib/api/hooks';

// Loaded only when opened, to keep the first page load small.
const ContainerSheet = dynamic(() => import('./ResourceSheets').then((m) => m.ContainerSheet));
const DatabaseSheet = dynamic(() => import('./ResourceSheets').then((m) => m.DatabaseSheet));
const AiKeySheet = dynamic(() => import('./ResourceSheets').then((m) => m.AiKeySheet));
const CreateContainerDialog = dynamic(() =>
  import('./CreateContainerDialog').then((m) => m.CreateContainerDialog),
);
const CreateDatabaseDialog = dynamic(() =>
  import('./CreateDatabaseDialog').then((m) => m.CreateDatabaseDialog),
);
const DatabaseSecretDialog = dynamic(() =>
  import('./DatabaseSecretDialog').then((m) => m.DatabaseSecretDialog),
);
const CreateKeyDialog = dynamic(() => import('./CreateKeyDialog').then((m) => m.CreateKeyDialog));
const SecretDialog = dynamic(() => import('./SecretDialog').then((m) => m.SecretDialog));

/** Side sheet (`r`), create dialogs (`new`) and the one-time secret dialog. Driven by the URL. */
export function Overlays() {
  const { project } = useProject();
  const [r, setR] = useQueryParam('r');
  const [creating, setCreating] = useQueryParam('new');
  const [secret, setSecret] = useState<{ title: string; value: string } | null>(null);
  const [dbSecret, setDbSecret] = useState<{ title: string; value: DatabaseSecret } | null>(null);
  const keys = useAiKeys(project.id);
  const containers = useContainers(project.id);
  const databases = useDatabases(project.id);

  const ct = r ? containers.data?.find((c) => c.id === r) : undefined;
  const db = r ? databases.data?.find((x) => x.id === r) : undefined;
  const key = r ? keys.data?.find((k) => k.id === r) : undefined;

  return (
    <>
      {ct && <ContainerSheet c={ct} onClose={() => setR(null)} />}
      {db && (
        <DatabaseSheet
          d={db}
          onClose={() => setR(null)}
          onSecret={(value) => setDbSecret({ title: 'Password reset', value })}
        />
      )}
      {key && (
        <AiKeySheet
          k={key}
          onClose={() => setR(null)}
          onSecret={(value) => setSecret({ title: 'New API key', value })}
        />
      )}
      {creating === 'ct' && (
        <CreateContainerDialog open onOpenChange={(o) => !o && setCreating(null)} />
      )}
      {creating === 'db' && (
        <CreateDatabaseDialog
          open
          onOpenChange={(o) => !o && setCreating(null)}
          onCreated={(value) => setDbSecret({ title: 'Database created', value })}
        />
      )}
      {creating === 'ai' && (
        <CreateKeyDialog
          open
          onOpenChange={(o) => !o && setCreating(null)}
          onCreated={(value) => setSecret({ title: 'API key created', value })}
        />
      )}
      {dbSecret && (
        <DatabaseSecretDialog
          secret={dbSecret.value}
          title={dbSecret.title}
          onClose={() => setDbSecret(null)}
        />
      )}
      {secret && (
        <SecretDialog secret={secret.value} title={secret.title} onClose={() => setSecret(null)} />
      )}
    </>
  );
}
