'use client';

import { Plus } from 'lucide-react';
import {
  DropMenu,
  DropMenuContent,
  DropMenuItem,
  DropMenuLabel,
  DropMenuTrigger,
} from './DropMenu';
import { TYPE_ICON } from './icons';
import { useNavActions } from '@/lib/nav-actions';

export function NewMenu() {
  const { create } = useNavActions();
  return (
    <DropMenu>
      <DropMenuTrigger asChild>
        <button className="btn primary" type="button">
          <Plus aria-hidden="true" />
          New
        </button>
      </DropMenuTrigger>
      <DropMenuContent align="end">
        <DropMenuLabel>Create</DropMenuLabel>
        <DropMenuItem onSelect={() => create('/vms', 'vm')}>
          {TYPE_ICON.vm}Virtual machine
        </DropMenuItem>
        <DropMenuItem onSelect={() => create('/containers', 'ct')}>
          {TYPE_ICON.ct}Container
        </DropMenuItem>
        <DropMenuItem disabled hint="Coming soon">
          {TYPE_ICON.s3}Bucket
        </DropMenuItem>
        <DropMenuItem onSelect={() => create('/ai', 'ai')}>{TYPE_ICON.ai}AI API key</DropMenuItem>
      </DropMenuContent>
    </DropMenu>
  );
}
