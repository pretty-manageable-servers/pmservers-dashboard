'use client';

import { Modal } from './Modal';
import { CopyField } from './CopyField';
import type { DatabaseSecret } from '@/lib/api/types';

export function DatabaseSecretDialog(props: {
  secret: DatabaseSecret | null;
  title: string;
  onClose: () => void;
}) {
  const d = props.secret;
  return (
    <Modal
      open={!!d}
      onOpenChange={(o) => !o && props.onClose()}
      title={props.title}
      description="You see the password only once."
    >
      <div style={{ padding: '18px 22px', display: 'grid', gap: 12 }}>
        <CopyField label="Password" value={d?.password ?? ''} />
        <CopyField label="Connection URL" value={d?.connection_url ?? ''} />
        <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
          Copy it now and keep it safe. We cannot show it again. If you lose it, reset the password.
        </p>
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
