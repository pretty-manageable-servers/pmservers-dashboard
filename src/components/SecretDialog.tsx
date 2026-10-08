'use client';

import { Modal } from './Modal';
import { CopyField } from './CopyField';

export function SecretDialog(props: { secret: string | null; title: string; onClose: () => void }) {
  return (
    <Modal
      open={!!props.secret}
      onOpenChange={(o) => !o && props.onClose()}
      title={props.title}
      description="You see this only once."
    >
      <div style={{ padding: '18px 22px' }}>
        <CopyField value={props.secret ?? ''} />
        <p className="muted" style={{ fontSize: 12.5, margin: '12px 0 0' }}>
          Copy it now and keep it safe. We cannot show it again.
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
