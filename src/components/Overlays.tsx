'use client';

import { useState } from 'react';
import { useQueryParam, useProject } from '@/lib/project';
import { useAiKeys, useVms } from '@/lib/api/hooks';
import { VmSheet, AiKeySheet } from './ResourceSheets';
import { CreateVmDialog } from './CreateVmDialog';
import { CreateKeyDialog } from './CreateKeyDialog';
import { SecretDialog } from './SecretDialog';

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
      <CreateVmDialog open={creating === 'vm'} onOpenChange={(o) => !o && setCreating(null)} />
      <CreateKeyDialog
        open={creating === 'ai'}
        onOpenChange={(o) => !o && setCreating(null)}
        onCreated={(value) => setSecret({ title: 'API key created', value })}
      />
      <SecretDialog
        secret={secret?.value ?? null}
        title={secret?.title ?? ''}
        onClose={() => setSecret(null)}
      />
    </>
  );
}
