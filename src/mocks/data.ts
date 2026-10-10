import type {
  AiKey,
  ApiEvent,
  Catalog,
  Container,
  Database,
  Project,
  RegistryCredential,
  Usage,
  Vm,
} from '@/lib/api/types';

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
  container_sizes: [
    { id: 'pms-c-250m-512', vcpu: 0.25, memory_mib: 512 },
    { id: 'pms-c-500m-1g', vcpu: 0.5, memory_mib: 1024 },
  ],
  database_sizes: [{ id: 'pms-db-250m-512', vcpu: 0.25, memory_mib: 512 }],
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
export const DB_STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;

export const databaseSizeSpec = (id: string) => catalog.database_sizes.find((s) => s.id === id);
export const containerSizeSpec = (id: string) => catalog.container_sizes.find((s) => s.id === id);

export const mockDatabase = (
  id: string,
  name: string,
  status: Database['status'],
  age: number,
  extra: Partial<Database> = {},
): Database => ({
  id,
  name,
  engine: 'postgres',
  size: 'pms-db-250m-512',
  vcpu: 0.25,
  memory_mib: 512,
  vector: false,
  status,
  status_message: null,
  host: `${name}.${id}.svc`,
  port: 5432,
  database: 'app',
  user: 'app',
  used_bytes: 0,
  storage_limit_bytes: DB_STORAGE_LIMIT_BYTES,
  created_at: ago(age),
  updated_at: ago(age),
  ...extra,
});

export const seedCredentials = (): RegistryCredential[] => [
  {
    id: 'reg_ghcr',
    name: 'ghcr-bots',
    host: 'ghcr.io',
    username: 'robert',
    created_at: ago(9 * DAY),
  },
];

const container = (
  id: string,
  name: string,
  status: Container['status'],
  image: string,
  size: string,
  age: number,
  extra: Partial<Container> = {},
): Container => {
  const spec = containerSizeSpec(size);
  return {
    id,
    name,
    type: 'worker',
    image,
    size,
    vcpu: spec?.vcpu ?? null,
    memory_mib: spec?.memory_mib ?? null,
    registry_credential_id: null,
    env_names: [],
    runtime: 'gvisor',
    status,
    status_message: null,
    created_at: ago(age),
    updated_at: ago(age),
    ...extra,
  };
};

export const projects: Project[] = [
  {
    id: 'prj_discord-bots',
    name: 'discord-bots',
    region: 'ca-tor-1',
    role: 'owner',
    created_at: ago(17 * DAY),
  },
  {
    id: 'prj_personal-site',
    name: 'personal-site',
    region: 'ca-tor-1',
    role: 'owner',
    created_at: ago(40 * DAY),
  },
];

export interface ProjectState {
  vms: Vm[];
  containers: Container[];
  databases: Database[];
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
  ssh_host: 'jump.pmservers.org',
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
      containers: [
        container(
          'ctr_relay-bot',
          'relay-bot',
          'running',
          'ghcr.io/robert/relay-bot:1.4',
          'pms-c-250m-512',
          5 * DAY,
          { registry_credential_id: 'reg_ghcr', env_names: ['DISCORD_TOKEN', 'LOG_LEVEL'] },
        ),
        container(
          'ctr_cron-worker',
          'cron-worker',
          'failed',
          'python:3.13-slim',
          'pms-c-250m-512',
          2 * HOUR,
          {
            status_message: 'The container stopped with exit code 1. It restarted 5 times.',
          },
        ),
      ],
      databases: [
        mockDatabase('db_main', 'main', 'running', 3 * DAY, {
          vector: true,
          used_bytes: 48 * 1024 * 1024,
        }),
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
      containers: [],
      databases: [],
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
  // Containers count their full size all the time, the same as the API.
  const cts = s.containers.filter((c) => c.status !== 'deleting');
  const ctVcpu = cts.reduce((a, c) => a + (c.vcpu ?? 0), 0);
  const ctMem = cts.reduce((a, c) => a + (c.memory_mib ?? 0) / 1024, 0);
  const dbs = s.databases.filter((x) => x.status !== 'deleting');
  const dbVcpu = dbs.reduce((a, x) => a + (x.vcpu ?? 0), 0);
  const dbMem = dbs.reduce((a, x) => a + (x.memory_mib ?? 0) / 1024, 0);
  return {
    vcpu: {
      used: sum((v) => sizeSpec(v.size)?.vcpu ?? 0, on) + ctVcpu + dbVcpu,
      limit: LIMITS.vcpu,
      series: s.usageSeries.vcpu ?? [],
    },
    memory_gib: {
      used: sum((v) => sizeSpec(v.size)?.memory_gib ?? 0, on) + ctMem + dbMem,
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
