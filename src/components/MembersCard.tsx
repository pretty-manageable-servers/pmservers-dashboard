'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ConfirmDialog } from './ConfirmDialog';
import { keys, useAddMember, useMembers, useRemoveMember } from '@/lib/api/hooks';
import type { Member } from '@/lib/api/types';
import { useSession } from '@/lib/auth';
import { useProject } from '@/lib/project';
import { validateEmail } from '@/lib/validation';

/** Project members. The owner invites and removes members. A member can leave. */
export function MembersCard() {
  const { user } = useSession();
  const { project, projects } = useProject();
  const isOwner = project.role === 'owner';
  const members = useMembers(project.id);
  const add = useAddMember(project.id);
  const remove = useRemoveMember(project.id);
  const qc = useQueryClient();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);

  const emailErr = validateEmail(email);
  const leaving = removing?.user_id === user?.id;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (emailErr) return;
    add.mutate(email.trim().toLowerCase(), {
      onSuccess: () => {
        setEmail('');
        setTouched(false);
      },
    });
  };

  const confirmRemove = () => {
    if (!removing) return;
    remove.mutate(removing.user_id, {
      onSuccess: async () => {
        setRemoving(null);
        if (!leaving) {
          toast(`Removed ${removing.email}`);
          return;
        }
        toast(`You left ${project.name}`);
        await qc.invalidateQueries({ queryKey: keys.projects });
        const next = projects.find((p) => p.id !== project.id);
        router.replace(next ? `/overview?project=${next.id}` : '/projects/new');
      },
    });
  };

  return (
    <section className="ucard" style={{ padding: 20, gap: 12 }}>
      <div>
        <b>Members</b>
        <div className="muted" style={{ fontSize: 13 }}>
          Members can do all that the owner can, but they cannot delete the project or change the
          members. Usage counts against the owner&apos;s limits.
        </div>
      </div>
      {members.isError ? (
        <span className="err-t">{members.error.message}</span>
      ) : (
        members.data && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {members.data.map((m) => (
              <li
                key={m.user_id}
                style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
              >
                <span style={{ flex: '1 1 240px', wordBreak: 'break-all' }}>
                  {m.email}
                  {m.user_id === user?.id && <span className="muted"> (you)</span>}
                </span>
                <span className="badge">{m.role === 'owner' ? 'Owner' : 'Member'}</span>
                {m.role === 'member' && (isOwner || m.user_id === user?.id) && (
                  <button className="btn sm danger" type="button" onClick={() => setRemoving(m)}>
                    {m.user_id === user?.id ? 'Leave' : 'Remove'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )
      )}
      {isOwner && (
        <form onSubmit={submit} noValidate className="field" style={{ margin: 0 }}>
          <label htmlFor="member-email">Invite by email</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              id="member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              autoComplete="off"
              aria-invalid={touched && !!emailErr}
              style={{ flex: '1 1 220px' }}
            />
            <button className="btn" type="submit" disabled={add.isPending}>
              Invite
            </button>
          </div>
          {touched && emailErr && <span className="err-t">{emailErr}</span>}
          <span className="hint">
            They get access at once. A person with no account gets an email to set up a sign-in.
          </span>
        </form>
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={leaving ? `Leave ${project.name}?` : `Remove ${removing?.email ?? 'member'}?`}
        description={
          leaving
            ? 'You lose access to this project. The owner must invite you again to get it back.'
            : 'They lose access to this project. The containers, databases and keys in the project stay.'
        }
        confirmLabel={leaving ? 'Leave project' : 'Remove member'}
        pending={remove.isPending}
        onConfirm={confirmRemove}
      />
    </section>
  );
}
