export interface TabDef {
  id: string;
  label: string;
  path: string;
  soon?: boolean;
}

export const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', path: '/overview' },
  { id: 'vm', label: 'Virtual machines', path: '/vms' },
  { id: 'ct', label: 'Containers', path: '/containers', soon: true },
  { id: 's3', label: 'Storage', path: '/storage', soon: true },
  { id: 'ai', label: 'AI', path: '/ai' },
  { id: 'settings', label: 'Settings', path: '/settings' },
];
