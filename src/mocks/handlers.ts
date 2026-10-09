import { delay, http, HttpResponse, sse, ws } from 'msw';
import type {
  AiKey,
  AiKeyCreate,
  ApiEvent,
  Project,
  SshKey,
  SshKeyCreate,
  StreamEvent,
  Vm,
  VmCreate,
} from '@/lib/api/types';
import {
  catalog,
  computeUsage,
  LIMITS,
  projects as seedProjects,
  seedState,
  series,
  sizeSpec,
  type ProjectState,
} from './data';

const LATENCY = 200;
let projects: Project[] = structuredClone(seedProjects);
let state = seedState();
let sshKeys: SshKey[] = [];
let counter = 100;
const id = (p: string) => `${p}_${(counter++).toString(36)}`;

export function resetMockState() {
  projects = structuredClone(seedProjects);
  state = seedState();
  sshKeys = [];
}

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
    return HttpResponse.json({ id: 'mock-user', email: 'robert@example.com', plan: 'Free' });
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
      created_at: new Date().toISOString(),
    };
    projects.push(p);
    state[p.id] = {
      vms: [],
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
    projects = projects.filter((x) => x.id !== params.pid);
    delete state[params.pid as string];
    return new HttpResponse(null, { status: 202 });
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
