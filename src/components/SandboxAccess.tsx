'use client';

import { PageHead } from './PageHead';
import { MEMBER_TEXT, RequestForm } from './ContainerAccess';
import type { Access } from '@/lib/api/types';
import { timeAgoLong } from '@/lib/utils';

const DESCRIPTION = 'Short-lived Linux sandboxes for code that you start with the E2B SDK.';

/** The page title with the Beta tag. Used by the page and by the approval notice. */
export function SandboxHead() {
  return (
    <PageHead
      title={
        <>
          Sandboxes <span className="badge">Beta</span>
        </>
      }
      description={DESCRIPTION}
    />
  );
}

/** The approval notice of the Sandboxes page. Same states and style as the Containers page. */
export function SandboxAccess({ access, member }: { access?: Access; member?: boolean }) {
  return (
    <>
      <SandboxHead />
      <section className="ucard" style={{ padding: 20, gap: 12 }}>
        {member ? (
          <>
            <b>Sandboxes need approval</b>
            <span className="muted">{MEMBER_TEXT}</span>
          </>
        ) : access?.access === 'none' ? (
          <>
            <b>Request access to sandboxes</b>
            <ul className="muted" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
              <li>A sandbox runs code for a short time, then it ends.</li>
              <li>Sandboxes need approval. We review each request.</li>
            </ul>
            <RequestForm placeholder="A CI job that runs tests for my app in a sandbox." />
          </>
        ) : access?.access === 'pending' ? (
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
        ) : access?.access === 'rejected' ? (
          <>
            <b>We did not approve your request.</b>
            {access.note && <span>{access.note}</span>}
            <RequestForm again placeholder="A CI job that runs tests for my app in a sandbox." />
          </>
        ) : null}
      </section>
    </>
  );
}
