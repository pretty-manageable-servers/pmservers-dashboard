import { delay, http, HttpResponse, sse, ws } from 'msw';
import type {
  Access,
  AiKey,
  AiKeyCreate,
  ApiEvent,
  Container,
  ContainerCreate,
  ContainerUpdate,
  Database,
  DatabaseCreate,
  DatabaseSecret,
  DatabaseUpdate,
  Member,
  Project,
  RegistryCredential,
  RegistryCredentialCreate,
  SshKey,
  SshKeyCreate,
  StreamEvent,
  Vm,
  VmCreate,
} from '@/lib/api/types';
import { validateDatabaseName } from '@/lib/databases';
import {
  credentialsFor,
  imageHost,
  normalizeHost,
  validateContainerName,
  validateEnv,
} from '@/lib/containers';
import {
  catalog,
  computeUsage,
  containerSizeSpec,
  databaseSizeSpec,
  mockDatabase,
  LIMITS,
  projects as seedProjects,
  seedCredentials,
  seedState,
  series,
  sizeSpec,
  type ProjectState,
} from './data';

const LATENCY = 200;
let projects: Project[] = structuredClone(seedProjects);
let state = seedState();
let sshKeys: SshKey[] = [];
let members: Record<string, Member[]> = {};
let credentials: RegistryCredential[] = seedCredentials();
let counter = 100;
const id = (p: string) => `${p}_${(counter++).toString(36)}`;

export function resetMockState() {
  projects = structuredClone(seedProjects);
  state = seedState();
  sshKeys = [];
  members = {};
  credentials = seedCredentials();
  access = approvedAccess();
  mockAccessParam = null;
}

// Container access of the mock account. Approved and ready by default.
const approvedAccess = (): Access => ({
  access: 'approved',
  runtime: 'gvisor',
  vcluster: 'ready',
  reason: 'Discord bots for my server.',
  note: null,
  requested_at: new Date(Date.now() - 20 * 86_400_000).toISOString(),
  decided_at: new Date(Date.now() - 19 * 86_400_000).toISOString(),
});
let access: Access = approvedAccess();
let mockAccessParam: string | null = null;

/**
 * Mock mode only: `?mockAccess=none|pending|rejected|creating|failed|ready|native` in the page URL
 * sets the access state, so each state of the Containers page can be seen.
 */
function readMockAccess() {
  const param =
    typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('mockAccess');
  if (!param || param === mockAccessParam) return;
  mockAccessParam = param;
  const now = new Date().toISOString();
  const base = approvedAccess();
  access = {
    none: {
      ...base,
      access: 'none',
      vcluster: 'none',
      reason: null,
      requested_at: null,
      decided_at: null,
    },
    pending: { ...base, access: 'pending', vcluster: 'none', requested_at: now, decided_at: null },
    rejected: {
      ...base,
      access: 'rejected',
      vcluster: 'none',
      note: 'We cannot run crypto miners. Tell us more about your project and ask again.',
      decided_at: now,
    },
    creating: { ...base, vcluster: 'creating' },
    failed: { ...base, vcluster: 'failed' },
    ready: base,
    native: { ...base, runtime: 'native' },
  }[param] as Access;
  if (!access) access = base;
}

/** The same 403 and 409 as the API when the account cannot run containers. */
function accessError() {
  readMockAccess();
  if (access.access !== 'approved')
    return err(403, 'not_allowed', 'Containers need approval. Request access on the Account page.');
  if (access.vcluster !== 'ready')
    return err(409, 'conflict', 'Your container space is being set up. Try again in a minute.');
  return null;
}

const MAX_CONTAINERS = 2;
const MAX_DATABASES = 1;

const randomPassword = () =>
  Array.from(
    { length: 32 },
    () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)],
  ).join('');

const withSecret = (d: Database, password: string): DatabaseSecret => ({
  ...d,
  password,
  connection_url: `postgresql://${d.user}:${password}@${d.host}:${d.port}/${d.database}`,
});

function dbStatus(
  x: Database,
  s: ProjectState,
  status: Database['status'],
  message: string,
  level: ApiEvent['level'] = 'info',
) {
  x.status = status;
  x.updated_at = new Date().toISOString();
  pushEvent(s, level, x.id, x.name, message);
}

/** Log lines that grow over time, one each 2 s since the container started. */
function mockLogs(c: Container, previous: boolean) {
  if (c.status === 'provisioning' || c.status === 'stopped') return [];
  const start = new Date(c.updated_at).getTime();
  if (c.status === 'failed') {
    const t = new Date(start).toISOString();
    return previous
      ? [
          { time: t, message: 'Starting worker' },
          { time: t, message: 'Traceback (most recent call last):' },
          { time: t, message: '  File "/app/main.py", line 3, in <module>' },
          { time: t, message: "KeyError: 'API_TOKEN'" },
        ]
      : [{ time: t, message: 'Starting worker' }];
  }
  const n = Math.min(200, 3 + Math.floor((Date.now() - start) / 2000));
  return Array.from({ length: n }, (_, i) => ({
    time: new Date(start + i * 2000).toISOString(),
    message:
      i === 0 ? `Starting ${c.name}` : i === 1 ? 'Connected to gateway' : `Heartbeat ${i - 1} ok`,
  }));
}

function ctStatus(
  c: Container,
  s: ProjectState,
  status: Container['status'],
  message: string,
  level: ApiEvent['level'] = 'info',
) {
  c.status = status;
  c.updated_at = new Date().toISOString();
  pushEvent(s, level, c.id, c.name, message);
}

/** Start the container: running after 2.5 s, or failed for busybox (it exits at once). */
function startContainer(c: Container, s: ProjectState) {
  c.status = 'provisioning';
  c.status_message = null;
  setTimeout(() => {
    if (c.status !== 'provisioning') return;
    if (c.image.includes('busybox')) {
      c.status_message = 'The container stopped with exit code 0. A worker must keep running.';
      ctStatus(c, s, 'failed', `Container failed: ${c.status_message}`, 'error');
    } else ctStatus(c, s, 'running', 'Container is running', 'success');
  }, 2500);
}

// The same user as the mock sign-in in lib/auth.tsx.
const MOCK_USER = { id: '5b1c0e2a-8d41-4f3e-9a77-1e0c3d2b6f90', email: 'robert@example.com' };

// The key data is the second field. The real API makes a SHA256 fingerprint of it.
const fingerprintOf = (publicKey: string) =>
  `SHA256:${(publicKey.split(/\s+/)[1] ?? '').slice(-43)}`;

const err = (status: number, code: string, message: string) =>
  HttpResponse.json({ error: { code, message } }, { status });

const notFound = () => err(404, 'not_found', 'We could not find that resource.');

const listeners = new Set<(e: StreamEvent) => void>();

/** Send an event to open streams. Quiet events are not kept in the activity feed. */
const broadcast = (e: StreamEvent) => listeners.forEach((fn) => fn(e));

const projectOf = (s: ProjectState) => Object.keys(state).find((k) => state[k] === s) ?? '';

const pushEvent = (
  s: ProjectState,
  level: ApiEvent['level'],
  rid: string,
  rname: string,
  message: string,
) => {
  const e: ApiEvent = {
    id: id('ev'),
    time: new Date().toISOString(),
    level,
    resource_id: rid,
    resource_name: rname,
    message,
  };
  s.events.unshift(e);
  broadcast({ ...e, project_id: projectOf(s) });
};

/** Move a resource through a list of [delay ms, status] steps. */
function lifecycle(vm: Vm, s: ProjectState, steps: [number, Vm['status'], (() => void)?][]) {
  for (const [ms, status, fn] of steps) {
    setTimeout(() => {
      vm.status = status;
      fn?.();
      broadcast({
        id: id('ev'),
        time: new Date().toISOString(),
        level: 'info',
        resource_id: vm.id,
        resource_name: vm.name,
        message: `VM is ${status}`,
        project_id: projectOf(s),
      });
    }, ms);
  }
}

const IMAGE_USER: Record<string, string> = {
  debian: 'debian',
  ubuntu: 'ubuntu',
  alpine: 'alpine',
  fedora: 'fedora',
};

const base = '*/v1';

const consoleSocket = ws.link('*/v1/projects/:pid/vms/:vid/console');

export const handlers = [
  http.get(`${base}/me`, async () => {
    await delay(LATENCY);
    return HttpResponse.json({ ...MOCK_USER, plan: 'Free' });
  }),
  http.get(`${base}/catalog`, async () => {
    await delay(LATENCY);
    return HttpResponse.json(catalog);
  }),

  http.get(`${base}/ssh-keys`, async () => {
    await delay(LATENCY);
    return HttpResponse.json({ items: sshKeys });
  }),
  http.post(`${base}/ssh-keys`, async ({ request }) => {
    await delay(LATENCY);
    const body = (await request.json()) as SshKeyCreate;
    const publicKey = body.public_key.trim();
    if (/PRIVATE KEY/.test(publicKey))
      return err(
        422,
        'validation_error',
        'That looks like a private key. Paste the public key only.',
      );
    if (!/^(ssh-ed25519|ssh-rsa|ecdsa-sha2-\S+)\s+\S+/.test(publicKey))
      return err(422, 'validation_error', 'Paste a public SSH key.');
    const fingerprint = fingerprintOf(publicKey);
    if (sshKeys.some((k) => k.fingerprint === fingerprint))
      return err(409, 'conflict', 'This SSH key is already saved.');
    if (sshKeys.length >= 20) return err(409, 'quota_exceeded', 'You can save up to 20 SSH keys.');
    const k: SshKey = {
      id: id('sshkey'),
      name: body.name,
      public_key: publicKey,
      fingerprint,
      created_at: new Date().toISOString(),
    };
    sshKeys.unshift(k);
    return HttpResponse.json(k, { status: 201 });
  }),
  http.delete(`${base}/ssh-keys/:kid`, async ({ params }) => {
    await delay(LATENCY);
    if (!sshKeys.some((k) => k.id === params.kid)) return notFound();
    sshKeys = sshKeys.filter((k) => k.id !== params.kid);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${base}/projects`, async () => {
    await delay(LATENCY);
    return HttpResponse.json({ items: projects });
  }),
  http.post(`${base}/projects`, async ({ request }) => {
    await delay(LATENCY);
    const { name } = (await request.json()) as { name: string };
    if (projects.some((p) => p.name === name))
      return err(409, 'name_taken', `You already have a project named ${name}.`);
    const p: Project = {
      id: `prj_${name}`,
      name,
      region: 'ca-tor-1',
      role: 'owner',
      created_at: new Date().toISOString(),
    };
    projects.push(p);
    state[p.id] = {
      vms: [],
      containers: [],
      databases: [],
      aiKeys: [],
      events: [],
      metrics: {},
      usageSeries: {
        vcpu: series(28, 0.05, 0.02),
        memory: series(28, 0.05, 0.02),
        storage: series(28, 0.05, 0.02),
        ai: series(28, 0.05, 0.02),
      },
    };
    return HttpResponse.json(p, { status: 201 });
  }),
  http.get(`${base}/projects/:pid`, async ({ params }) => {
    await delay(LATENCY);
    const p = projects.find((x) => x.id === params.pid);
    return p ? HttpResponse.json(p) : notFound();
  }),
  http.patch(`${base}/projects/:pid`, async ({ params, request }) => {
    await delay(LATENCY);
    const p = projects.find((x) => x.id === params.pid);
    if (!p) return notFound();
    Object.assign(p, await request.json());
    return HttpResponse.json(p);
  }),
  http.delete(`${base}/projects/:pid`, async ({ params }) => {
    await delay(LATENCY);
    const used = state[params.pid as string];
    if (used?.databases.length)
      return err(
        409,
        'conflict',
        'Delete the VMs, containers, databases and AI keys of this project first.',
      );
    projects = projects.filter((x) => x.id !== params.pid);
    delete state[params.pid as string];
    return new HttpResponse(null, { status: 202 });
  }),

  http.get(`${base}/projects/:pid/members`, async ({ params }) => {
    await delay(LATENCY);
    const p = projects.find((x) => x.id === params.pid);
    if (!p) return notFound();
    const owner: Member = {
      user_id: MOCK_USER.id,
      email: MOCK_USER.email,
      role: 'owner',
      created_at: p.created_at,
    };
    return HttpResponse.json({ items: [owner, ...(members[p.id] ?? [])] });
  }),
  http.post(`${base}/projects/:pid/members`, async ({ params, request }) => {
    await delay(LATENCY);
    const p = projects.find((x) => x.id === params.pid);
    if (!p) return notFound();
    const email = ((await request.json()) as { email: string }).email.trim().toLowerCase();
    if (email === MOCK_USER.email) return err(409, 'conflict', 'You own this project.');
    const list = (members[p.id] ??= []);
    if (list.some((m) => m.email === email))
      return err(409, 'conflict', 'This user is already a member.');
    const m: Member = {
      user_id: id('user'),
      email,
      role: 'member',
      created_at: new Date().toISOString(),
    };
    list.push(m);
    return HttpResponse.json({ ...m, invited: true }, { status: 201 });
  }),
  http.delete(`${base}/projects/:pid/members/:uid`, async ({ params }) => {
    await delay(LATENCY);
    const list = members[params.pid as string] ?? [];
    if (!list.some((m) => m.user_id === params.uid)) return notFound();
    members[params.pid as string] = list.filter((m) => m.user_id !== params.uid);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${base}/projects/:pid/usage`, async ({ params }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    return s ? HttpResponse.json(computeUsage(s)) : notFound();
  }),
  http.get(`${base}/projects/:pid/events`, async ({ params }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    return s ? HttpResponse.json({ items: s.events.slice(0, 20) }) : notFound();
  }),

  // VMs
  http.get(`${base}/projects/:pid/vms`, async ({ params }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    return s ? HttpResponse.json({ items: s.vms }) : notFound();
  }),
  http.post(`${base}/projects/:pid/vms`, async ({ params, request }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    const p = projects.find((x) => x.id === params.pid);
    if (!s || !p) return notFound();
    const body = (await request.json()) as VmCreate;
    if (s.vms.some((v) => v.name === body.name))
      return err(409, 'name_taken', `A VM named ${body.name} already exists.`);
    const spec = sizeSpec(body.size);
    const usage = computeUsage(s);
    if (spec && usage.vcpu.used + spec.vcpu > LIMITS.vcpu) {
      return err(
        402,
        'quota_exceeded',
        'This project has no vCPU left. Delete a VM or ask for more.',
      );
    }
    const imageName = body.image.split('-')[0] ?? 'debian';
    const vm: Vm = {
      id: id('vm'),
      name: body.name,
      status: 'pending',
      status_message: null,
      size: body.size,
      image: body.image,
      disk_gb: body.disk_gb,
      private_ip: null,
      ssh_host: 'jump.pmservers.org',
      ssh_user: IMAGE_USER[imageName] ?? 'user',
      created_at: new Date().toISOString(),
    };
    s.vms.unshift(vm);
    pushEvent(s, 'info', vm.id, vm.name, 'Creating VM');
    lifecycle(vm, s, [
      [1500, 'provisioning'],
      [
        5000,
        'running',
        () => {
          vm.private_ip = `10.40.0.${40 + Math.floor(Math.random() * 120)}`;
          s.metrics[vm.id] = series(60, 0.3, 0.3);
          pushEvent(s, 'success', vm.id, vm.name, 'VM is running');
        },
      ],
    ]);
    return HttpResponse.json(vm, { status: 202 });
  }),
  http.get(`${base}/projects/:pid/vms/:vid`, async ({ params }) => {
    await delay(LATENCY);
    const vm = state[params.pid as string]?.vms.find((v) => v.id === params.vid);
    return vm ? HttpResponse.json(vm) : notFound();
  }),
  http.delete(`${base}/projects/:pid/vms/:vid`, async ({ params }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    const vm = s?.vms.find((v) => v.id === params.vid);
    if (!s || !vm) return notFound();
    vm.status = 'deleting';
    pushEvent(s, 'info', vm.id, vm.name, 'Deleting VM');
    setTimeout(() => {
      s.vms = s.vms.filter((v) => v.id !== vm.id);
      broadcast({
        id: id('ev'),
        time: new Date().toISOString(),
        level: 'info',
        resource_id: vm.id,
        resource_name: vm.name,
        message: 'VM deleted',
        project_id: projectOf(s),
      });
    }, 2500);
    return new HttpResponse(null, { status: 202 });
  }),
  http.post(`${base}/projects/:pid/vms/:vid/actions`, async ({ params, request }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    const vm = s?.vms.find((v) => v.id === params.vid);
    if (!s || !vm) return notFound();
    const { action } = (await request.json()) as { action: 'start' | 'stop' | 'restart' };
    const end = action === 'stop' ? 'stopped' : 'running';
    vm.status = 'pending';
    lifecycle(vm, s, [
      [1000, 'provisioning'],
      [
        3000,
        end,
        () =>
          pushEvent(
            s,
            'info',
            vm.id,
            vm.name,
            action === 'stop' ? 'VM stopped' : action === 'start' ? 'VM started' : 'VM restarted',
          ),
      ],
    ]);
    return HttpResponse.json(vm, { status: 202 });
  }),
  http.get(`${base}/projects/:pid/vms/:vid/metrics`, async ({ params }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    return s ? HttpResponse.json({ cpu: s.metrics[params.vid as string] ?? [] }) : notFound();
  }),

  // Container access (account level)
  http.get(`${base}/account/access`, async () => {
    await delay(LATENCY);
    readMockAccess();
    return HttpResponse.json(access);
  }),
  http.post(`${base}/account/access/request`, async ({ request }) => {
    await delay(LATENCY);
    readMockAccess();
    const { reason } = (await request.json()) as { reason: string };
    if (!reason?.trim() || reason.length > 1000)
      return err(422, 'validation_error', 'The reason must be 1 to 1000 characters.');
    if (access.access === 'pending')
      return err(409, 'conflict', 'Your request is waiting for review.');
    if (access.access === 'approved')
      return err(409, 'conflict', 'Your account is already approved.');
    access = {
      ...access,
      access: 'pending',
      reason,
      note: null,
      requested_at: new Date().toISOString(),
      decided_at: null,
    };
    // The mock admin approves after 2 s. The container space is ready 3 s later.
    setTimeout(() => {
      access = {
        ...access,
        access: 'approved',
        vcluster: 'creating',
        decided_at: new Date().toISOString(),
      };
    }, 2000);
    setTimeout(() => {
      access = { ...access, vcluster: 'ready' };
    }, 5000);
    return HttpResponse.json(access);
  }),

  // Registry credentials (account level)
  http.get(`${base}/registry-credentials`, async () => {
    await delay(LATENCY);
    return HttpResponse.json({ items: credentials });
  }),
  http.post(`${base}/registry-credentials`, async ({ request }) => {
    await delay(LATENCY);
    const body = (await request.json()) as RegistryCredentialCreate;
    const host = normalizeHost(body.host);
    if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?$/.test(host))
      return err(422, 'validation_error', 'Registry host is not valid. Example: ghcr.io');
    if (credentials.some((c) => c.name === body.name.trim()))
      return err(409, 'conflict', 'A registry credential with this name exists.');
    if (credentials.length >= 10)
      return err(409, 'quota_exceeded', 'You can save 10 registry credentials.');
    const c: RegistryCredential = {
      id: id('reg'),
      name: body.name.trim(),
      host,
      username: body.username.trim(),
      created_at: new Date().toISOString(),
    };
    credentials.unshift(c);
    return HttpResponse.json(c, { status: 201 });
  }),
  http.delete(`${base}/registry-credentials/:cid`, async ({ params }) => {
    await delay(LATENCY);
    const inUse = Object.values(state).some((s) =>
      s.containers.some((c) => c.registry_credential_id === params.cid),
    );
    if (inUse)
      return err(
        409,
        'conflict',
        'A container uses this credential. Change or delete the container first.',
      );
    if (!credentials.some((c) => c.id === params.cid)) return notFound();
    credentials = credentials.filter((c) => c.id !== params.cid);
    return new HttpResponse(null, { status: 204 });
  }),

  // Containers
  http.get(`${base}/projects/:pid/containers`, async ({ params }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    if (!s) return notFound();
    readMockAccess();
    if (access.access !== 'approved')
      return err(
        403,
        'not_allowed',
        'Containers need approval. Request access on the Account page.',
      );
    return HttpResponse.json({ items: s.containers });
  }),
  http.post(`${base}/projects/:pid/containers`, async ({ params, request }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    if (!s) return notFound();
    const denied = accessError();
    if (denied) return denied;
    const body = (await request.json()) as ContainerCreate;
    const nameErr = validateContainerName(body.name);
    if (nameErr) return err(422, 'validation_error', nameErr);
    if (!imageHost(body.image))
      return err(
        422,
        'validation_error',
        'The image reference is not valid. Example: ghcr.io/owner/app:1.0',
      );
    const spec = containerSizeSpec(body.size);
    if (!spec) return err(422, 'validation_error', 'Unknown size.');
    const envErr = validateEnv(
      Object.entries(body.env ?? {}).map(([name, value]) => ({ name, value })),
    );
    if (envErr) return err(422, 'validation_error', envErr);
    if (body.runtime === 'native' && access.runtime !== 'native')
      return err(
        403,
        'native_not_allowed',
        'Your account cannot use the native runtime. Ask the PMServers team.',
      );
    if (body.registry_credential_id) {
      const cred = credentials.find((c) => c.id === body.registry_credential_id);
      if (!cred) return err(422, 'validation_error', 'Registry credential not found.');
      if (credentialsFor(body.image, [cred]).length === 0)
        return err(
          422,
          'validation_error',
          `The registry credential is for ${cred.host}, not for this image.`,
        );
    }
    const count = Object.values(state).reduce(
      (a, x) => a + x.containers.filter((c) => c.status !== 'deleting').length,
      0,
    );
    if (count >= MAX_CONTAINERS)
      return err(
        409,
        'quota_exceeded',
        `You can have ${MAX_CONTAINERS} containers. Delete one first.`,
      );
    if (s.containers.some((c) => c.name === body.name))
      return err(409, 'conflict', 'A container with this name exists in this project.');
    const now = new Date().toISOString();
    const c: Container = {
      id: id('ctr'),
      name: body.name,
      type: 'worker',
      image: body.image,
      size: spec.id,
      vcpu: spec.vcpu,
      memory_mib: spec.memory_mib,
      registry_credential_id: body.registry_credential_id ?? null,
      env_names: Object.keys(body.env ?? {}).sort(),
      runtime: body.runtime ?? 'gvisor',
      ports: body.ports ?? [],
      internal_host: body.ports?.length ? body.name : null,
      status: 'provisioning',
      status_message: 'Creating',
      created_at: now,
      updated_at: now,
    };
    s.containers.push(c);
    pushEvent(s, 'info', c.id, c.name, 'Creating container');
    startContainer(c, s);
    return HttpResponse.json(c, { status: 202 });
  }),
  http.get(`${base}/projects/:pid/containers/:cid`, async ({ params }) => {
    await delay(LATENCY);
    const c = state[params.pid as string]?.containers.find((x) => x.id === params.cid);
    return c ? HttpResponse.json(c) : notFound();
  }),
  http.patch(`${base}/projects/:pid/containers/:cid`, async ({ params, request }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    const c = s?.containers.find((x) => x.id === params.cid);
    if (!s || !c) return notFound();
    const denied = accessError();
    if (denied) return denied;
    const body = (await request.json()) as ContainerUpdate;
    if (body.image !== undefined && !imageHost(body.image))
      return err(
        422,
        'validation_error',
        'The image reference is not valid. Example: ghcr.io/owner/app:1.0',
      );
    if (body.size !== undefined) {
      const spec = containerSizeSpec(body.size);
      if (!spec) return err(422, 'validation_error', 'Unknown size.');
      Object.assign(c, { size: spec.id, vcpu: spec.vcpu, memory_mib: spec.memory_mib });
    }
    if (body.image !== undefined) c.image = body.image;
    if (body.registry_credential_id !== undefined)
      c.registry_credential_id = body.registry_credential_id;
    if (body.env !== undefined) c.env_names = Object.keys(body.env).sort();
    if (body.runtime !== undefined) c.runtime = body.runtime;
    if (body.ports !== undefined) {
      c.ports = body.ports;
      c.internal_host = body.ports.length ? c.name : null;
    }
    c.updated_at = new Date().toISOString();
    pushEvent(s, 'info', c.id, c.name, 'Redeploying container');
    startContainer(c, s);
    return HttpResponse.json(c, { status: 202 });
  }),
  http.delete(`${base}/projects/:pid/containers/:cid`, async ({ params }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    const c = s?.containers.find((x) => x.id === params.cid);
    if (!s || !c) return notFound();
    c.status = 'deleting';
    pushEvent(s, 'info', c.id, c.name, 'Deleting container');
    setTimeout(() => {
      s.containers = s.containers.filter((x) => x.id !== c.id);
      pushEvent(s, 'info', c.id, c.name, 'Container deleted');
    }, 2000);
    return new HttpResponse(null, { status: 202 });
  }),
  http.post(`${base}/projects/:pid/containers/:cid/actions`, async ({ params, request }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    const c = s?.containers.find((x) => x.id === params.cid);
    if (!s || !c) return notFound();
    const denied = accessError();
    if (denied) return denied;
    const { action } = (await request.json()) as { action: 'start' | 'stop' | 'restart' };
    if (action === 'stop') {
      c.status_message = null;
      ctStatus(c, s, 'stopped', 'Container stopped');
    } else startContainer(c, s);
    return HttpResponse.json(c, { status: 202 });
  }),
  http.get(`${base}/projects/:pid/containers/:cid/logs`, async ({ params, request }) => {
    await delay(LATENCY);
    const c = state[params.pid as string]?.containers.find((x) => x.id === params.cid);
    if (!c) return notFound();
    const previous = new URL(request.url).searchParams.get('previous') === 'true';
    return HttpResponse.json({ lines: mockLogs(c, previous) });
  }),

  // Databases
  http.get(`${base}/projects/:pid/databases`, async ({ params }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    return s ? HttpResponse.json({ items: s.databases }) : notFound();
  }),
  http.post(`${base}/projects/:pid/databases`, async ({ params, request }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    if (!s) return notFound();
    const body = (await request.json()) as DatabaseCreate;
    const nameErr = validateDatabaseName(body.name);
    if (nameErr) return err(422, 'validation_error', nameErr);
    const spec = databaseSizeSpec(body.size ?? 'pms-db-250m-512');
    if (!spec) return err(422, 'validation_error', 'Unknown size.');
    const count = Object.values(state).reduce((a, x) => a + x.databases.length, 0);
    if (count >= MAX_DATABASES)
      return err(
        409,
        'quota_exceeded',
        `You can have ${MAX_DATABASES} database. Delete one first.`,
      );
    if (s.databases.some((x) => x.name === body.name))
      return err(409, 'conflict', 'A database with this name exists in this project.');
    const dbId = id('db');
    const x = mockDatabase(dbId, body.name, 'provisioning', 0, {
      size: spec.id,
      vcpu: spec.vcpu,
      memory_mib: spec.memory_mib,
      vector: !!body.vector,
      status_message: 'Creating',
    });
    s.databases.push(x);
    pushEvent(s, 'info', x.id, x.name, 'Creating database');
    setTimeout(() => {
      if (x.status !== 'provisioning') return;
      x.status_message = null;
      dbStatus(x, s, 'running', 'Database is running', 'success');
    }, 2500);
    return HttpResponse.json(withSecret(x, randomPassword()), { status: 202 });
  }),
  http.get(`${base}/projects/:pid/databases/:did`, async ({ params }) => {
    await delay(LATENCY);
    const x = state[params.pid as string]?.databases.find((y) => y.id === params.did);
    return x ? HttpResponse.json(x) : notFound();
  }),
  http.patch(`${base}/projects/:pid/databases/:did`, async ({ params, request }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    const x = s?.databases.find((y) => y.id === params.did);
    if (!s || !x) return notFound();
    const body = (await request.json()) as DatabaseUpdate;
    if (body.vector === false && x.name.includes('vec'))
      return err(409, 'conflict', 'A column or index uses vector. Remove it first.');
    if (body.vector !== undefined) x.vector = body.vector;
    x.updated_at = new Date().toISOString();
    pushEvent(s, 'info', x.id, x.name, body.vector ? 'Turning on vector' : 'Turned off vector');
    return HttpResponse.json(x, { status: 202 });
  }),
  http.post(`${base}/projects/:pid/databases/:did/reset-password`, async ({ params }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    const x = s?.databases.find((y) => y.id === params.did);
    if (!s || !x) return notFound();
    pushEvent(s, 'info', x.id, x.name, 'Database password reset');
    return HttpResponse.json(withSecret(x, randomPassword()));
  }),
  http.delete(`${base}/projects/:pid/databases/:did`, async ({ params }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    const x = s?.databases.find((y) => y.id === params.did);
    if (!s || !x) return notFound();
    x.status = 'deleting';
    pushEvent(s, 'info', x.id, x.name, 'Deleting database');
    setTimeout(() => {
      s.databases = s.databases.filter((y) => y.id !== x.id);
      pushEvent(s, 'info', x.id, x.name, 'Database deleted');
    }, 2000);
    return new HttpResponse(null, { status: 202 });
  }),

  // AI keys
  http.get(`${base}/projects/:pid/ai-keys`, async ({ params }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    return s ? HttpResponse.json({ items: s.aiKeys }) : notFound();
  }),
  http.post(`${base}/projects/:pid/ai-keys`, async ({ params, request }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    if (!s) return notFound();
    const body = (await request.json()) as AiKeyCreate;
    if (body.models.length === 0) return err(400, 'no_models', 'Pick at least one model.');
    const hex = () => Math.random().toString(16).slice(2, 6);
    const prefix = `pms_sk_${hex()}`;
    const k: AiKey = {
      id: id('key'),
      name: body.name,
      status: 'running',
      prefix,
      models: body.models,
      budget_usd: body.budget_usd,
      spend_usd: 0,
      rate_limit_rpm: 60,
      created_at: new Date().toISOString(),
    };
    s.aiKeys.unshift(k);
    pushEvent(s, 'success', k.id, k.name, 'key created');
    return HttpResponse.json(
      { ...k, secret: `${prefix}${hex()}${hex()}${hex()}${hex()}${hex()}` },
      { status: 201 },
    );
  }),
  http.get(`${base}/projects/:pid/ai-keys/:kid`, async ({ params }) => {
    await delay(LATENCY);
    const k = state[params.pid as string]?.aiKeys.find((x) => x.id === params.kid);
    return k ? HttpResponse.json(k) : notFound();
  }),
  http.patch(`${base}/projects/:pid/ai-keys/:kid`, async ({ params, request }) => {
    await delay(LATENCY);
    const k = state[params.pid as string]?.aiKeys.find((x) => x.id === params.kid);
    if (!k) return notFound();
    Object.assign(k, await request.json());
    return HttpResponse.json(k);
  }),
  http.delete(`${base}/projects/:pid/ai-keys/:kid`, async ({ params }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    const k = s?.aiKeys.find((x) => x.id === params.kid);
    if (!s || !k) return notFound();
    s.aiKeys = s.aiKeys.filter((x) => x.id !== k.id);
    pushEvent(s, 'info', k.id, k.name, 'key revoked');
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(`${base}/projects/:pid/ai-keys/:kid/rotate`, async ({ params }) => {
    await delay(LATENCY);
    const s = state[params.pid as string];
    const k = s?.aiKeys.find((x) => x.id === params.kid);
    if (!s || !k) return notFound();
    const hex = () => Math.random().toString(16).slice(2, 6);
    k.prefix = `pms_sk_${hex()}`;
    pushEvent(s, 'info', k.id, k.name, 'key rotated');
    return HttpResponse.json({
      ...k,
      secret: `${k.prefix}${hex()}${hex()}${hex()}${hex()}${hex()}`,
    });
  }),
  http.post(`${base}/events/ticket`, async () => {
    await delay(LATENCY);
    return HttpResponse.json({ ticket: 'mock-events-ticket' });
  }),
  sse<{ event: StreamEvent }>(`${base}/events/stream`, ({ client, request }) => {
    const send = (e: StreamEvent) => client.send({ id: e.id, event: 'event', data: e });
    listeners.add(send);
    request.signal.addEventListener('abort', () => listeners.delete(send));
  }),
  http.post(`${base}/projects/:pid/vms/:vid/console/ticket`, async ({ params }) => {
    await delay(LATENCY);
    const vm = state[params.pid as string]?.vms.find((v) => v.id === params.vid);
    if (!vm) return notFound();
    if (vm.status !== 'running') return err(409, 'conflict', 'The VM must be running.');
    return HttpResponse.json({
      ticket: 'mock-console-ticket',
      url: `/v1/projects/${params.pid}/vms/${params.vid}/console?ticket=mock-console-ticket`,
    });
  }),
  consoleSocket.addEventListener('connection', ({ client }) => {
    const enc = new TextEncoder();
    const say = (t: string) => client.send(enc.encode(t));
    let line = '';
    say('Mock console. Type something and it is echoed.\r\n$ ');
    client.addEventListener('message', (m) => {
      const text =
        typeof m.data === 'string' ? m.data : new TextDecoder().decode(m.data as ArrayBuffer);
      for (const ch of text) {
        if (ch === '\r' || ch === '\n') {
          say(`\r\n${line ? `you typed: ${line}\r\n` : ''}$ `);
          line = '';
        } else if (ch === '\x7f') {
          if (line) {
            line = line.slice(0, -1);
            say('\b \b');
          }
        } else {
          line += ch;
          say(ch);
        }
      }
    });
  }),
];
