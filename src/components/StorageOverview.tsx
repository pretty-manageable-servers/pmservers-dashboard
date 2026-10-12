'use client';

import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { CopyField } from './CopyField';
import { useDisableStorage } from '@/lib/api/hooks';
import type { Storage } from '@/lib/api/types';
import { formatBytes } from '@/lib/databases';
import {
  STORAGE_STATUS_HELP,
  STORAGE_STATUS_LABEL,
  USAGE_MARKS,
  USAGE_SCALE,
  usageLevel,
  usagePercent,
  usd,
} from '@/lib/storage';

/** The state of the account, the usage and the cost, the endpoint, and the switch to turn it off. */
export function StorageOverview({ s, account }: { s: Storage; account?: string }) {
  const disable = useDisableStorage(account);
  const [confirm, setConfirm] = useState(false);
  const status = s.status;
  const help = status ? STORAGE_STATUS_HELP[status] : undefined;
  const busy = status === 'provisioning' || status === 'disabling';
  const hasBuckets = s.buckets_count > 0;

  return (
    <section className="ucard" style={{ padding: 20, gap: 14 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className={`dot ${status ?? ''}`} role="status">
          {status ? STORAGE_STATUS_LABEL[status] : 'Off'}
        </span>
      </div>
      {help && (
        <div
          className={status === 'suspended' || status === 'failed' ? 'card err' : 'card'}
          style={{ padding: '12px 14px' }}
        >
          {help}
          {s.status_message && status === 'failed' && (
            <div className="hint">{s.status_message}</div>
          )}
        </div>
      )}

      <Usage used={s.used_bytes} limit={s.limit_bytes} />

      <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
        Would cost this month: <b className="num">{usd(s.would_cost_usd)}</b> (not charged yet)
      </p>

      <div style={{ display: 'grid', gap: 10 }}>
        <CopyField label="Endpoint" value={s.endpoint} />
        <CopyField label="Region" value={s.region} />
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          className="btn sm danger"
          type="button"
          disabled={hasBuckets || busy || disable.isPending}
          aria-describedby={hasBuckets ? 'storage-off-hint' : undefined}
          onClick={() => setConfirm(true)}
        >
          Turn off object storage
        </button>
        {hasBuckets && (
          <span id="storage-off-hint" className="hint">
            Delete all buckets first.
          </span>
        )}
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={(o) => !o && setConfirm(false)}
        title="Turn off object storage?"
        description="All access keys stop working. The storage and its data are removed. You cannot undo this."
        confirmLabel="Turn off"
        pending={disable.isPending}
        onConfirm={() => disable.mutate(undefined, { onSuccess: () => setConfirm(false) })}
      />
    </section>
  );
}

/** Used bytes against the limit. The bar ends at 125 percent. Marks at 90, 100 and 125 percent. */
function Usage({ used, limit }: { used: number; limit: number }) {
  const pct = usagePercent(used, limit);
  const level = usageLevel(pct);
  const fill = Math.min(pct, USAGE_SCALE) / USAGE_SCALE;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div className="lbl">Storage used</div>
      <div style={{ fontSize: 22, fontWeight: 600 }} className="num">
        {formatBytes(used)}{' '}
        <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>
          of {formatBytes(limit)} ({Math.round(pct)}%)
        </span>
      </div>
      <div
        className="usage-track"
        role="progressbar"
        aria-label="Storage used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(100, pct))}
        aria-valuetext={`${Math.round(pct)}% of the limit`}
      >
        <i className={`usage-fill ${level}`} style={{ width: `${fill * 100}%` }} />
        {USAGE_MARKS.map((m) => (
          <span
            key={m}
            className="usage-mark"
            style={{ left: `${(m / USAGE_SCALE) * 100}%` }}
            aria-hidden="true"
          />
        ))}
      </div>
      <span className="hint">
        Marks: {USAGE_MARKS[0]}% (warning), {USAGE_MARKS[1]}% (read-only), {USAGE_MARKS[2]}%
        (suspended). The bar ends at {USAGE_SCALE}%.
      </span>
    </div>
  );
}
