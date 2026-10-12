'use client';

import { useState } from 'react';
import { PageHead } from './PageHead';
import { useRequestAccess } from '@/lib/api/hooks';
import type { Access } from '@/lib/api/types';
import { timeAgoLong } from '@/lib/utils';

const DESCRIPTION = 'Workers that run your image all the time, for example a Discord bot.';

export const MEMBER_TEXT = 'The project owner must request access.';

function About() {
  return (
    <ul className="muted" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
      <li>
        A container is a worker. It connects out only. It gets no public inbound traffic and no
        public URL by default. To reach a port, expose it on the Networking page.
      </li>
      <li>It has no disk. Files are lost when it restarts.</li>
      <li>Images must be linux/amd64 and run as a non-root user (user 1000).</li>
      <li>Containers need approval. We review each request.</li>
    </ul>
  );
}

export function RequestForm({
  again,
  placeholder,
  label,
}: {
  again?: boolean;
  placeholder?: string;
  label?: string;
}) {
  const request = useRequestAccess();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const text = reason.trim();
  const reasonErr =
    text.length === 0
      ? 'Tell us what you want to run.'
      : text.length > 1000
        ? 'Use 1000 characters or less.'
        : null;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (reasonErr) return;
    request.mutate(text);
  };
  return (
    <form onSubmit={submit} noValidate className="field" style={{ margin: 0 }}>
      <label htmlFor="access-reason">{label ?? 'What do you want to run?'}</label>
      <textarea
        id="access-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={placeholder ?? 'A Discord bot for my server. It uses about 200 MB of memory.'}
        maxLength={1000}
        aria-invalid={touched && !!reasonErr}
      />
      {touched && reasonErr ? (
        <span className="err-t">{reasonErr}</span>
      ) : (
        <span className="hint">{text.length} of 1000 characters</span>
      )}
      <div>
        <button className="btn primary" type="submit" disabled={request.isPending}>
          {again ? 'Request again' : 'Request access'}
        </button>
      </div>
    </form>
  );
}

/** Everything before the list: the request form, the review and the setup. */
export function AccessState({ access, member }: { access?: Access; member?: boolean }) {
  return (
    <>
      <PageHead title="Containers" description={DESCRIPTION} />
      <section className="ucard" style={{ padding: 20, gap: 12 }}>
        {member ? (
          <>
            <b>Containers need approval</b>
            <About />
            <span className="muted">{MEMBER_TEXT}</span>
          </>
        ) : !access ? null : access.access === 'none' ? (
          <>
            <b>Request access to containers</b>
            <About />
            <RequestForm />
          </>
        ) : access.access === 'pending' ? (
          <>
            <b>Your request is waiting for review.</b>
            <span className="muted">
              Sent {access.requested_at ? timeAgoLong(access.requested_at).toLowerCase() : ''}. This
              page updates when we decide.
            </span>
            {access.reason && (
              <blockquote className="hint" style={{ margin: 0 }}>
                {access.reason}
              </blockquote>
            )}
          </>
        ) : access.access === 'rejected' ? (
          <>
            <b>We did not approve your request.</b>
            {access.note && <span>{access.note}</span>}
            <RequestForm again />
          </>
        ) : access.vcluster === 'failed' ? (
          <>
            <b>Setup failed. We are looking at it.</b>
            <span className="muted">
              We try again by ourselves. You do not need to do anything.
            </span>
          </>
        ) : (
          <>
            <b>We are setting up your container space.</b>
            <span className="muted" role="status">
              This takes about 1 minute. This page updates when it is ready.
            </span>
          </>
        )}
      </section>
    </>
  );
}
