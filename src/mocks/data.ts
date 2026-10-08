import type { AiKey, ApiEvent, Catalog, Project, Usage, Vm } from '@/lib/api/types';

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export const series = (n: number, base: number, vol: number) => {
  let v = base;
  return Array.from(
    { length: n },
    () => (v = Math.max(0.05, Math.min(1, v + (rnd() - 0.5) * vol))),
  );
};

export const catalog: Catalog = {
  regions: ['ca-tor-1'],
  vm_sizes: [
    { id: 'pm.nano', vcpu: 1, memory_gib: 1 },
    { id: 'pm.small', vcpu: 1, memory_gib: 2 },
    { id: 'pm.medium', vcpu: 2, memory_gib: 4 },
    { id: 'pm.large', vcpu: 4, memory_gib: 8 },
  ],
  vm_images: [
    { id: 'debian-13', name: 'Debian', version: '13' },
    { id: 'ubuntu-24.04', name: 'Ubuntu', version: '24.04' },
    { id: 'alpine-3.22', name: 'Alpine', version: '3.22' },
    { id: 'fedora-43', name: 'Fedora', version: '43' },
  ],
  ai_models: [
    {
      id: 'gemma4-e4b',
      type: 'llm',
      description: 'Fast chat with tool calls.',
      detail: '64k ctx',
    },
    {
      id: 'qwen3.8-flash-next',
      type: 'llm',
      description: 'Stronger reasoning. Slower.',
      detail: '32k ctx',
    },
    {
      id: 'embeddinggemma2',
      type: 'embedding',
      description: 'Text to vectors for search and RAG.',
      detail: '768 dims',
    },
    {
      id: 'kev',
      type: 'decision',
      description: 'Picks respond, react or ignore for a message.',
      detail: '~0.2 s',
    },
  ],
};

export const sizeSpec = (id: string) => catalog.vm_sizes.find((s) => s.id === id);

export const projects: Project[] = [
  { id: 'prj_discord-bots', name: 'discord-bots', region: 'ca-tor-1', created_at: ago(17 * DAY) },
  { id: 'prj_personal-site', name: 'personal-site', region: 'ca-tor-1', created_at: ago(40 * DAY) },
];

export interface ProjectState {
  vms: Vm[];
  aiKeys: AiKey[];
  events: ApiEvent[];
  metrics: Record<string, number[]>;
  usageSeries: Record<string, number[]>;
}

const vm = (
  id: string,
  name: string,
  status: Vm['status'],
  size: string,
  image: string,
  ip: string | null,
  age: number,
  project: string,
  msg: string | null = null,
): Vm => ({
  id,
  name,
  status,
  status_message: msg,
  size,
  image,
  disk_gb: 10,
  private_ip: ip,
  ssh_host: `${name}.${project}.vm.pmservers.org`,
  ssh_user: image.startsWith('Debian') ? 'debian' : 'user',
  created_at: ago(age),
});

const key = (
  id: string,
  name: string,
  prefix: string,
  models: string[],
  spend: number,
  budget: number,
  age: number,
): AiKey => ({
  id,
  name,
  status: 'running',
  prefix,
  models,
  budget_usd: budget,
  spend_usd: spend,
  rate_limit_rpm: 60,
  created_at: ago(age),
});

const ev = (
  id: string,
  age: number,
  level: ApiEvent['level'],
  rid: string,
  rname: string,
  message: string,
): ApiEvent => ({
  id,
  time: ago(age),
  level,
  resource_id: rid,
  resource_name: rname,
  message,
});

export function seedState(): Record<string, ProjectState> {
  return {
    'prj_discord-bots': {
      vms: [
        vm(
          'vm_bot-runner',
          'bot-runner',
          'running',
          'pm.small',
          'Debian 13',
          '10.40.0.23',
          12 * DAY,
          'discord-bots',
        ),
        vm(
          'vm_build-box',
          'build-box',
          'stopped',
          'pm.medium',
          'Ubuntu 24.04',
          '10.40.0.31',
          3 * DAY,
          'discord-bots',
        ),
        vm(
          'vm_scratch',
          'scratch',
          'provisioning',
          'pm.nano',
          'Alpine 3.22',
          null,
          20 * 1000,
          'discord-bots',
        ),
      ],
      aiKeys: [
        key(
          'key_triage-bot',
          'triage-bot',
          'pms_sk_7f3a',
          ['kev', 'embeddinggemma2'],
          0.41,
          2,
          6 * DAY,
        ),
        key(
          'key_laptop',
          'laptop',
          'pms_sk_c19e',
          ['gemma4-e4b', 'qwen3.8-flash-next'],
          0.83,
          3,
          14 * DAY,
        ),
      ],
      events: [
        ev('ev_1', 2 * MIN, 'success', 'vm_scratch', 'scratch', 'create requested'),
        ev('ev_2', 4 * HOUR, 'warning', 'key_triage-bot', 'triage-bot', 'used 20% of its budget'),
        ev('ev_3', 26 * HOUR, 'success', 'key_laptop', 'laptop', 'key created'),
        ev('ev_4', 6 * DAY, 'success', 'vm_bot-runner', 'bot-runner', 'started'),
      ],
      metrics: { 'vm_bot-runner': series(60, 0.35, 0.25) },
      usageSeries: {
        vcpu: series(28, 0.35, 0.15),
        memory: series(28, 0.4, 0.15),
        storage: series(28, 0.2, 0.06).map((_, i) => 0.15 + i * 0.006),
        ai: series(28, 0.2, 0.2).map((v, i) => 0.05 + i * 0.01 + v * 0.05),
      },
    },
    'prj_personal-site': {
      vms: [
        vm(
          'vm_blog',
          'blog',
          'running',
          'pm.nano',
          'Alpine 3.22',
          '10.40.1.5',
          30 * DAY,
          'personal-site',
        ),
      ],
      aiKeys: [],
      events: [ev('ev_p1', 30 * DAY, 'success', 'vm_blog', 'blog', 'started')],
      metrics: { vm_blog: series(60, 0.2, 0.1) },
      usageSeries: {
        vcpu: series(28, 0.1, 0.05),
        memory: series(28, 0.1, 0.05),
        storage: series(28, 0.1, 0.02),
        ai: series(28, 0.05, 0.02),
      },
    },
  };
}

export const LIMITS = { vcpu: 8, memory_gib: 16, storage_gb: 50, ai_spend_usd: 5 };

export function computeUsage(s: ProjectState): Usage {
  const live = s.vms.filter((v) => v.status !== 'deleting');
  const on = live.filter((v) => v.status !== 'stopped');
  const sum = (f: (v: Vm) => number, list: Vm[]) => list.reduce((a, v) => a + f(v), 0);
  return {
    vcpu: {
      used: sum((v) => sizeSpec(v.size)?.vcpu ?? 0, on),
      limit: LIMITS.vcpu,
      series: s.usageSeries.vcpu ?? [],
    },
    memory_gib: {
      used: sum((v) => sizeSpec(v.size)?.memory_gib ?? 0, on),
      limit: LIMITS.memory_gib,
      series: s.usageSeries.memory ?? [],
    },
    storage_gb: {
      used: sum((v) => v.disk_gb, live),
      limit: LIMITS.storage_gb,
      series: s.usageSeries.storage ?? [],
    },
    ai_spend_usd: {
      used: Math.round(s.aiKeys.reduce((a, k) => a + k.spend_usd, 0) * 100) / 100,
      limit: LIMITS.ai_spend_usd,
      series: s.usageSeries.ai ?? [],
    },
  };
}
