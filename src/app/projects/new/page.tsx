'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RequireAuth } from '@/lib/auth';
import { AuthLayout } from '@/components/AuthLayout';
import { useCreateProject, useProjects } from '@/lib/api/hooks';
import { validateName } from '@/lib/validation';

function NewProject() {
  const router = useRouter();
  const projects = useProjects();
  const create = useCreateProject();
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const err = validateName(name);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (err) return;
    create.mutate(name, { onSuccess: (p) => router.replace(`/overview?project=${p.id}`) });
  };

  return (
    <AuthLayout>
      <form onSubmit={submit} noValidate>
        <div>
          <h1>New project</h1>
          <p>A project holds your VMs and AI keys.</p>
        </div>
        <div className="field">
          <label htmlFor="pn">Project name</label>
          <input
            id="pn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-project"
            autoComplete="off"
            aria-invalid={touched && !!err}
          />
          {touched && err ? (
            <span className="err-t">{err}</span>
          ) : (
            <span className="hint">Lowercase letters, numbers and dashes.</span>
          )}
        </div>
        <button className="btn primary" type="submit" disabled={create.isPending}>
          Create project
        </button>
        {projects.data && projects.data.length > 0 && (
          <div className="fine">
            <Link href="/">Cancel</Link>
          </div>
        )}
      </form>
    </AuthLayout>
  );
}

export default function NewProjectPage() {
  return (
    <RequireAuth>
      <NewProject />
    </RequireAuth>
  );
}
