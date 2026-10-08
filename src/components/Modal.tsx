'use client';

import * as Dialog from '@radix-ui/react-dialog';

/** Centered dialog in the mockup style. */
export function Modal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content
          className="dialog"
          aria-describedby={props.description ? undefined : undefined}
        >
          <header>
            <Dialog.Title asChild>
              <h3>{props.title}</h3>
            </Dialog.Title>
            {props.description && (
              <Dialog.Description asChild>
                <p>{props.description}</p>
              </Dialog.Description>
            )}
          </header>
          {props.children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Right side sheet in the mockup style. */
export function SideSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon: React.ReactNode;
  subtitle: string;
  status: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content className="sheet" aria-describedby={undefined}>
          <header>
            <span className="ricon">{props.icon}</span>
            <div style={{ minWidth: 0 }}>
              <Dialog.Title asChild>
                <h3>{props.title}</h3>
              </Dialog.Title>
              <div className="ty">{props.subtitle}</div>
            </div>
            <span style={{ marginLeft: 'auto' }}>{props.status}</span>
            <Dialog.Close className="iconbtn" aria-label="Close">
              ✕
            </Dialog.Close>
          </header>
          <div className="body">{props.children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
