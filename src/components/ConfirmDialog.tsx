'use client';

import { Modal } from './Modal';

export function ConfirmDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={props.title}
      description={props.description}
    >
      <footer style={{ marginTop: 18 }}>
        <span className="cost" />
        <button className="btn" type="button" onClick={() => props.onOpenChange(false)}>
          Cancel
        </button>
        <button
          className="btn primary"
          type="button"
          disabled={props.pending}
          onClick={props.onConfirm}
        >
          {props.confirmLabel}
        </button>
      </footer>
    </Modal>
  );
}
