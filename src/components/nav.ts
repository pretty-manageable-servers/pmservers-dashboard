import type { LucideIcon } from 'lucide-react';
import {
  Container,
  Database,
  HardDrive,
  LayoutGrid,
  Server,
  Settings,
  Sparkles,
} from 'lucide-react';

export interface TabDef {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  soon?: boolean;
}

export const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', path: '/overview', icon: LayoutGrid },
  { id: 'vm', label: 'Virtual machines', path: '/vms', icon: Server },
  { id: 'ct', label: 'Containers', path: '/containers', icon: Container },
  { id: 'db', label: 'Databases', path: '/databases', icon: Database },
  { id: 's3', label: 'Storage', path: '/storage', icon: HardDrive, soon: true },
  { id: 'ai', label: 'AI', path: '/ai', icon: Sparkles },
  { id: 'settings', label: 'Settings', path: '/settings', icon: Settings },
];
