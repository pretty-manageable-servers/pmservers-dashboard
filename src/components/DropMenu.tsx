'use client';

import * as Menu from '@radix-ui/react-dropdown-menu';

export const DropMenu = Menu.Root;
export const DropMenuTrigger = Menu.Trigger;

export function DropMenuContent({
  children,
  align = 'start',
}: {
  children: React.ReactNode;
  align?: 'start' | 'end';
}) {
  return (
    <Menu.Portal>
      <Menu.Content className="menu" align={align} sideOffset={6} style={{ position: 'relative' }}>
        {children}
      </Menu.Content>
    </Menu.Portal>
  );
}

export function DropMenuItem(props: {
  onSelect?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  hint?: string;
  on?: boolean;
}) {
  return (
    <Menu.Item asChild disabled={props.disabled} onSelect={props.onSelect}>
      <button
        type="button"
        className={props.on ? 'on' : ''}
        disabled={props.disabled}
        style={props.disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
      >
        {props.children}
        {props.hint && <small>{props.hint}</small>}
      </button>
    </Menu.Item>
  );
}

export const DropMenuLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="h">{children}</div>
);
export const DropMenuSeparator = () => (
  <Menu.Separator asChild>
    <hr />
  </Menu.Separator>
);
