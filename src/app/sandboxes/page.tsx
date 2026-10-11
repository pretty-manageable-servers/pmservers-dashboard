'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Page } from '@/components/Page';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CopyField, copyText } from '@/components/CopyField';
import { SandboxAccess, SandboxHead } from '@/components/SandboxAccess';
import { ErrorState } from '@/components/States';
import { isNotAllowed, useAccess, useKillSandbox, useSandboxes } from '@/lib/api/hooks';
import type { Sandbox } from '@/lib/api/types';
import { sizeLabel } from '@/lib/containers';
import { projectHref, useProject } from '@/lib/project';
import { endsIn, shortSandboxId } from '@/lib/sandboxes';
import { timeAgoLong } from '@/lib/utils';

const ENV_TEXT = [
  'E2B_API_KEY=<your token>',
  'E2B_API_URL=https://api.pmservers.org/sandboxes',
  'E2B_SANDBOX_URL=https://sandbox.pmservers.org',
].join('\n');

/** Shown when the project has no sandboxes. It tells how to start one. */
function StartGuide({ projectId }: { projectId: string }) {
  return (
    <section className="ucard" style={{ padding: 20, gap: 12 }}>
      <b>No sandboxes running</b>
      <span className="muted">
        Start a sandbox from your code with the E2B SDK. It appears here while it runs.
      </span>
      <ol className="guide">
        <li>
          <span>Install the SDK.</span>
          <CopyField value="npm install e2b" />
          <CopyField value="pip install e2b" />
        </li>
        <li>
          <span>
            Make an API token for this project.{' '}
            <Link href={projectHref('/settings/tokens', projectId)}>Open API tokens</Link>
          </span>
        </li>
        <li>
          <span>Set these environment variables. Set E2B_API_KEY to your token.</span>
          <CopyField value={ENV_TEXT} block />
        </li>
      </ol>
      <span className="hint">
        Read the{' '}
        <a href="https://docs.pmservers.org/sandboxes/overview/" target="_blank" rel="noreferrer">
          sandboxes overview
        </a>
        .
      </span>
    </section>
  );
}

function Sandboxes() {
  const { project } = useProject();
  const owner = project.role === 'owner';
  const access = useAccess();
  const approved = access.data?.access === 'approved';
  // A member has no access state. The list answers 403 if the owner is not approved.
  const sandboxes = useSandboxes(project.id, owner ? approved : true);
  const kill = useKillSandbox(project.id);
  const [killing, setKilling] = useState<Sandbox | null>(null);

  if (owner) {
    if (access.isLoading) return <div className="skeleton" style={{ height: 160 }} role="status" />;
    if (access.isError) return <ErrorState error={access.error} onRetry={() => access.refetch()} />;
    if (!approved) return <SandboxAccess access={access.data} />;
  } else if (sandboxes.isError && isNotAllowed(sandboxes.error)) {
    return <SandboxAccess member />;
  }

  return (
    <>
      <SandboxHead />
      {sandboxes.isLoading ? (
        <div className="skeleton" style={{ height: 160 }} role="status" aria-label="Loading" />
      ) : sandboxes.isError ? (
        <ErrorState error={sandboxes.error} onRetry={() => sandboxes.refetch()} />
      ) : sandboxes.data?.length === 0 ? (
        <StartGuide projectId={project.id} />
      ) : (
        <section className="ucard" style={{ padding: 0, gap: 0 }}>
          <div style={{ padding: '12px 16px 0' }}>
            <span className="hint">Updates every 10 seconds.</span>
          </div>
          <table className="rtable">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">State</th>
                <th scope="col">Size</th>
                <th scope="col">Started</th>
                <th scope="col">Ends in</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sandboxes.data?.map((s) => (
                <tr key={s.id}>
                  <td data-label="ID">
                    <span className="mono" title={s.id}>
                      {shortSandboxId(s.id)}
                    </span>{' '}
                    <button
                      className="btn sm"
                      type="button"
                      aria-label={`Copy the full ID of ${shortSandboxId(s.id)}`}
                      onClick={() => copyText(s.id)}
                    >
                      Copy
                    </button>
                  </td>
                  <td data-label="State">
                    <span className="badge">{s.state}</span>
                  </td>
                  <td data-label="Size">{sizeLabel(s)}</td>
                  <td data-label="Started">{s.started_at ? timeAgoLong(s.started_at) : '—'}</td>
                  <td data-label="Ends in">{endsIn(s.end_at)}</td>
                  <td>
                    <button
                      className="btn sm danger"
                      type="button"
                      aria-label={`Kill ${shortSandboxId(s.id)}`}
                      onClick={() => setKilling(s)}
                    >
                      Kill
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <ConfirmDialog
        open={killing !== null}
        onOpenChange={(o) => !o && setKilling(null)}
        title={`Kill ${shortSandboxId(killing?.id ?? '')}?`}
        description="The sandbox stops at once. Anything in it that is not saved is lost."
        confirmLabel="Kill sandbox"
        pending={kill.isPending}
        onConfirm={() =>
          killing && kill.mutate({ id: killing.id }, { onSuccess: () => setKilling(null) })
        }
      />
    </>
  );
}

export default function SandboxesPage() {
  return (
    <Page>
      <Sandboxes />
    </Page>
  );
}
