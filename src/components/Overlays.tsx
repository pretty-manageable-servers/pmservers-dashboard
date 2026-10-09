'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useQueryParam, useProject } from '@/lib/project';
import { useAiKeys, useVms } from '@/lib/api/hooks';

// Loaded only when opened, to keep the first page load small.
const VmSheet = dynamic(() => import('./ResourceSheets').then((m) => m.VmSheet));
const AiKeySheet = dynamic(() => import('./ResourceSheets').then((m) => m.AiKeySheet));
const CreateVmDialog = dynamic(() => import('./CreateVmDialog').then((m) => m.CreateVmDialog));
const CreateKeyDialog = dynamic(() => import('./CreateKeyDialog').then((m) => m.CreateKeyDialog));
const SecretDialog = dynamic(() => import('./SecretDialog').then((m) => m.SecretDialog));

/** Side sheet (`r`), create dialogs (`new`) and the one-time secret dialog. Driven by the URL. */
export function Overlays() {
  const { project } = useProject();
  const [r, setR] = useQueryParam('r');
  const [creating, setCreating] = useQueryParam('new');
  const [secret, setSecret] = useState<{ title: string; value: string } | null>(null);
  const vms = useVms(project.id);
  const keys = useAiKeys(project.id);

  const vm = r ? vms.data?.find((v) => v.id === r) : undefined;
  const key = r ? keys.data?.find((k) => k.id === r) : undefined;

  return (
    <>
      {vm && <VmSheet vm={vm} onClose={() => setR(null)} />}
      {key && (
        <AiKeySheet
          k={key}
          onClose={() => setR(null)}
          onSecret={(value) => setSecret({ title: 'New API key', value })}
        />
      )}
      {creating === 'vm' && <CreateVmDialog open onOpenChange={(o) => !o && setCreating(null)} />}
      {creating === 'ai' && (
        <CreateKeyDialog
          open
          onOpenChange={(o) => !o && setCreating(null)}
          onCreated={(value) => setSecret({ title: 'API key created', value })}
        />
      )}
      {secret && (
        <SecretDialog secret={secret.value} title={secret.title} onClose={() => setSecret(null)} />
      )}
    </>
  );
}
