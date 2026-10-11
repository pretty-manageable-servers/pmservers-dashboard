'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Page } from '@/components/Page';
import { PageHead } from '@/components/PageHead';
import { Modal } from '@/components/Modal';
import { MembersCard } from '@/components/MembersCard';
import { SettingsTabs } from '@/components/SettingsTabs';
import { SshKeysCard } from '@/components/SshKeysCard';
import { RegistryCredentialsCard } from '@/components/RegistryCredentialsCard';
import { useSession } from '@/lib/auth';
import { useDeleteProject, useMe, useRenameProject } from '@/lib/api/hooks';
import { useProject } from '@/lib/project';
import { validateName } from '@/lib/validation';
import { toast } from 'sonner';

function Settings() {
  const { user, getLinkedProviders, linkGitHub } = useSession();
  const [providers, setProviders] = useState<string[] | null>(null);
  const { project, projects } = useProject();
  const me = useMe();
  const del = useDeleteProject();
  const rename = useRenameProject();
  const [newName, setNewName] = useState('');
  const [renameTouched, setRenameTouched] = useState(false);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    getLinkedProviders().then(setProviders);
  }, [getLinkedProviders, user]);

  const connectGitHub = async () => {
    const err = await linkGitHub();
    if (err) toast.error(err);
  };

  const nameErr = validateName(newName);
  const submitRename = (e: React.FormEvent) => {
    e.preventDefault();
    setRenameTouched(true);
    if (nameErr || newName === project.name) return;
    rename.mutate({ id: project.id, name: newName }, { onSuccess: () => setRenameTouched(false) });
  };

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
      <SettingsTabs current="general" />
      <section className="ucard" style={{ padding: 20, gap: 0 }}>
        <dl className="kv">
          <dt>Email</dt>
          <dd>{user?.email}</dd>
          <dt>Sign-in</dt>
          <dd style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {providers?.map((p) => (
              <span key={p} className="badge">
                {p === 'github' ? 'GitHub' : p === 'email' ? 'Email and password' : p}
              </span>
            ))}
            {providers && !providers.includes('github') && (
              <button className="btn sm" type="button" onClick={connectGitHub}>
                Connect GitHub
              </button>
            )}
          </dd>
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
          <dt>Your role</dt>
          <dd>
            <span className="badge">{project.role === 'owner' ? 'Owner' : 'Member'}</span>
          </dd>
        </dl>
      </section>
      <section className="ucard" style={{ padding: 20, gap: 12 }}>
        <form onSubmit={submitRename} noValidate className="field" style={{ margin: 0 }}>
          <label htmlFor="proj-name">Project name</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              id="proj-name"
              value={newName}
              placeholder={project.name}
              onChange={(e) => setNewName(e.target.value)}
              autoComplete="off"
              style={{ flex: '1 1 220px' }}
            />
            <button
              className="btn"
              type="submit"
              disabled={rename.isPending || newName === '' || newName === project.name}
            >
              Rename
            </button>
          </div>
          {renameTouched && nameErr && <span className="err-t">{nameErr}</span>}
        </form>
      </section>
      <MembersCard />
      <SshKeysCard />
      <RegistryCredentialsCard />
      {project.role === 'owner' && (
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
              Delete the containers, databases and AI keys in {project.name} first. You cannot undo
              this.
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
      )}
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
