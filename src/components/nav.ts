import type { LucideIcon } from 'lucide-react';
import { Container, Box, Database, HardDrive, LayoutGrid, Settings, Sparkles } from 'lucide-react';

export interface TabDef {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  soon?: boolean;
}

export const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', path: '/overview', icon: LayoutGrid },
  { id: 'ct', label: 'Containers', path: '/containers', icon: Container },
  { id: 'db', label: 'Databases', path: '/databases', icon: Database },
  { id: 'sbx', label: 'Sandboxes', path: '/sandboxes', icon: Box },
  { id: 's3', label: 'Storage', path: '/storage', icon: HardDrive },
  { id: 'ai', label: 'AI', path: '/ai', icon: Sparkles },
  { id: 'settings', label: 'Settings', path: '/settings', icon: Settings },
];
