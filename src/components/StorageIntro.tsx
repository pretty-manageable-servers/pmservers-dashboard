'use client';

import { PageHead } from './PageHead';
import { RequestForm } from './ContainerAccess';
import { useEnableStorage } from '@/lib/api/hooks';
import type { Access } from '@/lib/api/types';
import { isNotAvailable } from '@/lib/storage';
import { timeAgoLong } from '@/lib/utils';

const PLACEHOLDER = 'Uploads for my web app. About 2 GiB of photos.';

export const STORAGE_DESCRIPTION =
  'S3-compatible storage for your files. Built on Garage. Use it from your apps, scripts and the AWS CLI.';

/** The page before the switch: what the service is, and the Enable button. */
export function StorageIntro({
  account,
  onUnavailable,
}: {
  account?: string;
  onUnavailable: () => void;
}) {
  const enable = useEnableStorage(account);
  return (
    <>
      <PageHead title="Object storage" description={STORAGE_DESCRIPTION} />
      <section className="ucard" style={{ padding: 20, gap: 12 }}>
        <b>Turn on object storage</b>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
          <li>Free: 10 GiB of files and 10 buckets for each account.</li>
          <li>Over 10 GiB: $0.014 per GiB each month. We do not charge yet.</li>
          <li>No backups. Keep a second copy of files you cannot lose.</li>
          <li>Single node. All files are on one server.</li>
        </ul>
        <div>
          <button
            className="btn primary"
            type="button"
            disabled={enable.isPending}
            onClick={() =>
              enable.mutate(undefined, {
                onError: (e) => {
                  if (isNotAvailable(e)) onUnavailable();
                },
              })
            }
          >
            Enable object storage
          </button>
        </div>
      </section>
    </>
  );
}

/** An owner whose account is not approved yet. The request is the same one as for containers. */
export function StorageApproval({ access }: { access: Access }) {
  return (
    <>
      <PageHead title="Object storage" description={STORAGE_DESCRIPTION} />
      <section className="ucard" style={{ padding: 20, gap: 12 }}>
        {access.access === 'pending' ? (
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
            <RequestForm again label="What do you want to store?" placeholder={PLACEHOLDER} />
          </>
        ) : (
          <>
            <b>Request access to object storage</b>
            <span className="muted">
              Only approved accounts can turn on object storage. We review each request.
            </span>
            <RequestForm label="What do you want to store?" placeholder={PLACEHOLDER} />
          </>
        )}
      </section>
    </>
  );
}
