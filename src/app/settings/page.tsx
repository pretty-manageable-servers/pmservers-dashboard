'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Page } from '@/components/Page';
import { PageHead } from '@/components/PageHead';
import { Modal } from '@/components/Modal';
import { useSession } from '@/lib/auth';
import { useDeleteProject, useMe } from '@/lib/api/hooks';
import { useProject } from '@/lib/project';
import { toast } from 'sonner';

function Settings() {
  const { user } = useSession();
  const { project, projects } = useProject();
  const me = useMe();
  const del = useDeleteProject();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');

  const confirmDelete = () =>
    del.mutate(project.id, {
      onSuccess: () => {
        toast(`Deleting ${project.name}`);
        const next = projects.find((p) => p.id !== project.id);
        router.replace(next ? `/overview?project=${next.id}` : '/projects/new');
      },
    });

  return (
    <>
      <PageHead
        title="Settings"
        description="Your account comes from your sign-in. Project limits are set by PMS Cloud."
      />
      <section className="ucard" style={{ padding: 20, gap: 0 }}>
        <dl className="kv">
          <dt>Email</dt>
          <dd>{user?.email}</dd>
          <dt>Sign-in</dt>
          <dd>{user?.provider === 'github' ? 'GitHub' : 'Email and password'}</dd>
          <dt>User ID</dt>
          <dd className="mono">{user?.id}</dd>
          <dt>Plan</dt>
          <dd>
            <span className="badge">{me.data?.plan ?? '—'}</span>
          </dd>
          <dt>Project</dt>
          <dd>
            {project.name} · {project.region}
          </dd>
        </dl>
      </section>
      <section
        className="ucard"
        style={{
          padding: 20,
          gap: 12,
          borderColor: 'color-mix(in srgb, var(--bad) 35%, var(--line))',
        }}
      >
        <div>
          <b>Delete project</b>
          <div className="muted" style={{ fontSize: 13 }}>
            Deletes all VMs and keys in {project.name}. You cannot undo this.
          </div>
        </div>
        <div>
          <button
            className="btn danger"
            type="button"
            onClick={() => {
              setTyped('');
              setOpen(true);
            }}
          >
            Delete project
          </button>
        </div>
      </section>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${project.name}?`}
        description="This deletes everything in the project. You cannot undo this."
      >
        <div style={{ padding: '18px 22px' }} className="field">
          <label htmlFor="del-name">
            Type <b className="mono">{project.name}</b> to confirm
          </label>
          <input
            id="del-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
        </div>
        <footer>
          <span className="cost" />
          <button className="btn" type="button" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button
            className="btn primary"
            type="button"
            disabled={typed !== project.name || del.isPending}
            onClick={confirmDelete}
          >
            Delete project
          </button>
        </footer>
      </Modal>
    </>
  );
}

export default function SettingsPage() {
  return (
    <Page>
      <Settings />
    </Page>
  );
}
