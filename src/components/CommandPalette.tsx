'use client';

import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { Home, Plus } from 'lucide-react';
import { TABS } from './nav';
import { TYPE_ICON } from './icons';
import { projectHref, useProject } from '@/lib/project';
import { useAiKeys, useVms } from '@/lib/api/hooks';

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const { project } = useProject();
  const vms = useVms(project.id);
  const keys = useAiKeys(project.id);

  const run = (fn: () => void) => () => {
    onOpenChange(false);
    fn();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" style={{ zIndex: 40 }} />
        <Dialog.Content className="palette" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Command loop>
            <Command.Input placeholder="Search resources or type a command…" autoFocus />
            <Command.List>
              <Command.Empty className="muted" style={{ padding: 14 }}>
                No results
              </Command.Empty>
              <Command.Group heading="Actions">
                <Item
                  icon={<Plus />}
                  onSelect={run(() => router.push(projectHref('/vms', project.id, { new: 'vm' })))}
                >
                  Create virtual machine
                </Item>
                <Item
                  icon={<Plus />}
                  onSelect={run(() => router.push(projectHref('/ai', project.id, { new: 'ai' })))}
                >
                  Create AI API key
                </Item>
              </Command.Group>
              <Command.Group heading="Go to">
                {TABS.filter((t) => !t.soon).map((t) => (
                  <Item
                    key={t.id}
                    icon={<Home />}
                    onSelect={run(() => router.push(projectHref(t.path, project.id)))}
                  >
                    {t.label}
                  </Item>
                ))}
              </Command.Group>
              <Command.Group heading="Resources">
                {vms.data?.map((v) => (
                  <Item
                    key={v.id}
                    icon={TYPE_ICON.vm}
                    sub="Virtual machine"
                    value={`${v.name} vm`}
                    onSelect={run(() => router.push(projectHref('/vms', project.id, { r: v.id })))}
                  >
                    {v.name}
                  </Item>
                ))}
                {keys.data?.map((k) => (
                  <Item
                    key={k.id}
                    icon={TYPE_ICON.ai}
                    sub="API key"
                    value={`${k.name} api key`}
                    onSelect={run(() => router.push(projectHref('/ai', project.id, { r: k.id })))}
                  >
                    {k.name}
                  </Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
          <div className="foot">
            <span>↑↓ to move</span>
            <span>↵ to open</span>
            <span>esc to close</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Item(props: {
  icon: React.ReactNode;
  sub?: string;
  value?: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <Command.Item value={props.value ?? String(props.children)} onSelect={props.onSelect}>
      {props.icon}
      {props.children}
      <small>{props.sub}</small>
    </Command.Item>
  );
}
