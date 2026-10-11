'use client';

import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { Home, Plus } from 'lucide-react';
import { TABS } from './nav';
import { TYPE_ICON } from './icons';
import { projectHref, useProject } from '@/lib/project';
import { useAiKeys, useContainers, useDatabases } from '@/lib/api/hooks';

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const { project } = useProject();
  const keys = useAiKeys(project.id);
  const containers = useContainers(project.id);
  const databases = useDatabases(project.id);

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
                  onSelect={run(() =>
                    router.push(projectHref('/containers', project.id, { new: 'ct' })),
                  )}
                >
                  Create container
                </Item>
                <Item
                  icon={<Plus />}
                  onSelect={run(() =>
                    router.push(projectHref('/databases', project.id, { new: 'db' })),
                  )}
                >
                  Create database
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
                {containers.data?.map((c) => (
                  <Item
                    key={c.id}
                    icon={TYPE_ICON.ct}
                    sub="Container"
                    value={`${c.name} container`}
                    onSelect={run(() =>
                      router.push(projectHref('/containers', project.id, { r: c.id })),
                    )}
                  >
                    {c.name}
                  </Item>
                ))}
                {databases.data?.map((d) => (
                  <Item
                    key={d.id}
                    icon={TYPE_ICON.db}
                    sub="Database"
                    value={`${d.name} database`}
                    onSelect={run(() =>
                      router.push(projectHref('/databases', project.id, { r: d.id })),
                    )}
                  >
                    {d.name}
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
