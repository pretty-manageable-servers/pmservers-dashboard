import type {
  AiKey,
  ApiEvent,
  Catalog,
  Container,
  Database,
  Project,
  RegistryCredential,
  Usage,
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
  container_sizes: [
    { id: 'pms-c-250m-512', vcpu: 0.25, memory_mib: 512 },
    { id: 'pms-c-500m-1g', vcpu: 0.5, memory_mib: 1024 },
  ],
  database_sizes: [{ id: 'pms-db-250m-512', vcpu: 0.25, memory_mib: 512 }],
  ai_models: [
    {
      id: 'cirrus',
      type: 'llm',
      description: 'Fast chat with tool calls.',
      detail: '64k ctx',
      price_in_per_m: 0.05,
      price_out_per_m: 0.156667,
      price_cache_read_per_m: 0.005333,
      price_cache_write_per_m: 0.066667,
      price_per_minute: null,
      price_per_m_chars: null,
    },
    {
      id: 'nimbus',
      type: 'llm',
      description: 'Stronger reasoning. Slower.',
      detail: '32k ctx',
      price_in_per_m: 0.45,
      price_out_per_m: 1.41,
      price_cache_read_per_m: 0.048,
      price_cache_write_per_m: 0.6,
      price_per_minute: null,
      price_per_m_chars: null,
    },
    {
      id: 'stratus',
      type: 'embedding',
      description: 'Text to vectors for search and RAG.',
      detail: '768 dims',
      price_in_per_m: 0.03,
      price_out_per_m: 0,
      price_cache_read_per_m: 0.03,
      price_cache_write_per_m: 0.03,
      price_per_minute: null,
      price_per_m_chars: null,
    },
    {
      id: 'vane',
      type: 'decision',
      description: 'Picks respond, react or ignore for a message.',
      detail: '~0.2 s',
      price_in_per_m: 0.0378,
      price_out_per_m: 0,
      price_cache_read_per_m: 0.0378,
      price_cache_write_per_m: 0.0378,
      price_per_minute: null,
      price_per_m_chars: null,
    },
    {
      id: 'squall',
      type: 'stt',
      description: 'Speech to text. WAV files only.',
      detail: '25 MB max',
      price_in_per_m: 0,
      price_out_per_m: 0,
      price_cache_read_per_m: 0,
      price_cache_write_per_m: 0,
      price_per_minute: 0.004,
      price_per_m_chars: null,
    },
    {
      id: 'thunder',
      type: 'tts',
      description: 'Text to speech. Returns WAV.',
      detail: '4096 chars max',
      price_in_per_m: 0,
      price_out_per_m: 0,
      price_cache_read_per_m: 0,
      price_cache_write_per_m: 0,
      price_per_minute: null,
      price_per_m_chars: 10.0,
    },
  ],
};

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
  private_ip: '',
  ssh_host: '',
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
    ports: [],
    internal_host: null,
    tunnel: null,
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
  containers: Container[];
  databases: Database[];
  aiKeys: AiKey[];
  events: ApiEvent[];
  usageSeries: Record<string, number[]>;
}

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
        key('key_triage-bot', 'triage-bot', 'pms_sk_7f3a', ['vane', 'stratus'], 0.41, 2, 6 * DAY),
        key('key_laptop', 'laptop', 'pms_sk_c19e', ['cirrus', 'nimbus'], 0.83, 3, 14 * DAY),
      ],
      events: [
        ev('ev_2', 4 * HOUR, 'warning', 'key_triage-bot', 'triage-bot', 'used 20% of its budget'),
        ev('ev_3', 26 * HOUR, 'success', 'key_laptop', 'laptop', 'key created'),
      ],
      usageSeries: {
        vcpu: series(28, 0.35, 0.15),
        memory: series(28, 0.4, 0.15),
        ai: series(28, 0.2, 0.2).map((v, i) => 0.05 + i * 0.01 + v * 0.05),
      },
    },
    'prj_personal-site': {
      containers: [],
      databases: [],
      aiKeys: [],
      events: [],
      usageSeries: {
        vcpu: series(28, 0.1, 0.05),
        memory: series(28, 0.1, 0.05),
        ai: series(28, 0.05, 0.02),
      },
    },
  };
}

export const LIMITS = { vcpu: 8, memory_gib: 16, ai_spend_usd: 5 };

export function computeUsage(s: ProjectState): Usage {
  // Containers count their full size all the time, the same as the API.
  const cts = s.containers.filter((c) => c.status !== 'deleting');
  const ctVcpu = cts.reduce((a, c) => a + (c.vcpu ?? 0), 0);
  const ctMem = cts.reduce((a, c) => a + (c.memory_mib ?? 0) / 1024, 0);
  const dbs = s.databases.filter((x) => x.status !== 'deleting');
  const dbVcpu = dbs.reduce((a, x) => a + (x.vcpu ?? 0), 0);
  const dbMem = dbs.reduce((a, x) => a + (x.memory_mib ?? 0) / 1024, 0);
  return {
    vcpu: {
      used: ctVcpu + dbVcpu,
      limit: LIMITS.vcpu,
      series: s.usageSeries.vcpu ?? [],
    },
    memory_gib: {
      used: ctMem + dbMem,
      limit: LIMITS.memory_gib,
      series: s.usageSeries.memory ?? [],
    },
    ai_spend_usd: {
      used: Math.round(s.aiKeys.reduce((a, k) => a + k.spend_usd, 0) * 100) / 100,
      limit: LIMITS.ai_spend_usd,
      series: s.usageSeries.ai ?? [],
    },
  };
}
