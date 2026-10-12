'use client';

import { Modal } from './Modal';
import { CopyField } from './CopyField';
import { CodeSample } from './CodeSample';
import type { StorageKeyWithSecret } from '@/lib/api/types';
import {
  CHECKSUM_SETTINGS,
  CLI_SNIPPET_TITLE,
  ENV_SNIPPET_TITLE,
  awsCliSnippet,
  envSnippet,
} from '@/lib/storage';

/**
 * Shows the secret of a new or reset key, one time. It stays in the page state only, and it is
 * not closed by Escape or a click outside: the user must press Done after they copy it.
 */
export function StorageSecretDialog(props: {
  secret: StorageKeyWithSecret | null;
  title: string;
  bucket?: string;
  onClose: () => void;
}) {
  const k = props.secret;
  const samples: Record<string, string> = k
    ? {
        [ENV_SNIPPET_TITLE]: envSnippet(k),
        [CLI_SNIPPET_TITLE]: awsCliSnippet(props.bucket),
      }
    : {};
  return (
    <Modal
      open={!!k}
      onOpenChange={() => undefined}
      title={props.title}
      description="You see the secret access key only once."
    >
      <div style={{ padding: '18px 22px', display: 'grid', gap: 12, overflowY: 'auto' }}>
        <CopyField label="Key ID" value={k?.key_id ?? ''} />
        <CopyField label="Secret access key" value={k?.secret_access_key ?? ''} />
        <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
          Copy the secret now and keep it safe. We cannot show it again. If you lose it, reset the
          key. A reset makes a new key ID.
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          <b style={{ fontSize: 13.5 }}>Use the key</b>
          {k && <CodeSample samples={samples} copyable />}
        </div>
        <div className="hint" style={{ display: 'grid', gap: 4 }}>
          <span>
            Some multipart objects have a checksum that new SDKs reject. Set the response checksum
            validation to when required:
          </span>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {CHECKSUM_SETTINGS.map((c) => (
              <li key={c.sdk}>
                {c.sdk}: <code>{c.setting}</code>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <footer>
        <span className="cost" />
        <button className="btn primary" type="button" onClick={props.onClose}>
          Done
        </button>
      </footer>
    </Modal>
  );
}
