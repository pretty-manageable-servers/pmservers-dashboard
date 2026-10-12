import { describe, expect, it } from 'vitest';
import {
  addressLine,
  changedPuts,
  choiceOf,
  externalPortErrors,
  pageView,
  rowsOf,
  savedChoices,
  sameTargets,
  statusInfo,
  targetInputs,
  tokenError,
  type Choice,
  type TargetRow,
} from '@/lib/connectors';
import type { AvailableTarget, Connector } from '@/lib/api/types';

const available: AvailableTarget[] = [
  { kind: 'container', id: 'ctr_relay', name: 'relay', ports: [8080, 9000] },
  { kind: 'container', id: 'ctr_idle', name: 'idle', ports: [] },
  { kind: 'database', id: 'db_main', name: 'main', ports: [5432] },
];
const rows = rowsOf(available);

const tailscale = (targets: Connector['targets']): Connector => ({
  id: 'ncn_ts',
  kind: 'tailscale',
  status: 'connected',
  message: null,
  observed_at: null,
  targets,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
});

const cloudflared = (targets: Connector['targets']): Connector => ({
  ...tailscale(targets),
  id: 'ncn_cf',
  kind: 'cloudflared',
});

const relay8080 = {
  kind: 'container' as const,
  id: 'ctr_relay',
  name: 'relay',
  port: 8080,
  external_port: 8080,
  address: 'discord-bots.example-tailnet.ts.net:8080',
};
const dbTarget = {
  kind: 'database' as const,
  id: 'db_main',
  name: 'main',
  port: 5432,
  external_port: 5432,
  address: 'discord-bots.example-tailnet.ts.net:5432',
};

/** Choices for the rows, with the given keys checked. */
const check = (keys: string[], external: Record<string, string> = {}): Record<string, Choice> =>
  Object.fromEntries(
    rows.map((row) => {
      const key = `${row.kind}:${row.id}:${row.port}`;
      return [
        key,
        { checked: keys.includes(key), externalPort: external[key] ?? String(row.port) },
      ];
    }),
  );

describe('rowsOf', () => {
  it('makes one row for each container port and one for the database', () => {
    expect(rows.map((r) => `${r.name}:${r.port}`)).toEqual([
      'relay:8080',
      'relay:9000',
      'main:5432',
    ]);
  });
});

describe('savedChoices', () => {
  it('checks the rows that the connector has, with their external port', () => {
    const c = tailscale([{ ...relay8080, external_port: 18080 }, dbTarget]);
    const choices = savedChoices(c, rows);
    expect(choices['container:ctr_relay:8080']).toEqual({ checked: true, externalPort: '18080' });
    expect(choices['container:ctr_relay:9000']).toEqual({ checked: false, externalPort: '9000' });
    expect(choices['database:db_main:5432']?.checked).toBe(true);
  });
  it('leaves every row unchecked with no connector', () => {
    const choices = savedChoices(undefined, rows);
    expect(Object.values(choices).every((c) => !c.checked)).toBe(true);
  });
});

describe('targetInputs', () => {
  it('sends the external port for tailscale, in table order', () => {
    const choices = check(['database:db_main:5432', 'container:ctr_relay:8080'], {
      'container:ctr_relay:8080': '18080',
    });
    expect(targetInputs('tailscale', rows, choices)).toEqual([
      { kind: 'container', id: 'ctr_relay', port: 8080, external_port: 18080 },
      { kind: 'database', id: 'db_main', port: 5432, external_port: 5432 },
    ]);
  });
  it('sends null external ports for cloudflared', () => {
    const choices = check(['container:ctr_relay:8080']);
    expect(targetInputs('cloudflared', rows, choices)).toEqual([
      { kind: 'container', id: 'ctr_relay', port: 8080, external_port: null },
    ]);
  });
  it('treats a missing choice as unchecked', () => {
    expect(choiceOf({}, rows[0] as TargetRow)).toEqual({ checked: false, externalPort: '8080' });
  });
});

describe('sameTargets', () => {
  it('ignores the order', () => {
    const a = [
      { kind: 'container' as const, id: 'a', port: 1, external_port: 1 },
      { kind: 'database' as const, id: 'b', port: 5432, external_port: 5432 },
    ];
    expect(sameTargets(a, [...a].reverse())).toBe(true);
  });
  it('sees a changed external port', () => {
    const one = { kind: 'container' as const, id: 'a', port: 1, external_port: 1 };
    expect(sameTargets([one], [{ ...one, external_port: 2 }])).toBe(false);
  });
  it('sees an added or removed target', () => {
    const a = [{ kind: 'container' as const, id: 'a', port: 1, external_port: 1 }];
    expect(sameTargets(a, [])).toBe(false);
    expect(sameTargets([], a)).toBe(false);
  });
});

describe('changedPuts', () => {
  it('sends one PUT with the full targets list for a changed connector', () => {
    const c = tailscale([relay8080]);
    const edits = { tailscale: check(['container:ctr_relay:8080', 'database:db_main:5432']) };
    expect(changedPuts([c], rows, edits)).toEqual([
      {
        kind: 'tailscale',
        body: {
          targets: [
            { kind: 'container', id: 'ctr_relay', port: 8080, external_port: 8080 },
            { kind: 'database', id: 'db_main', port: 5432, external_port: 5432 },
          ],
        },
      },
    ]);
  });
  it('sends nothing when the draft equals the saved targets', () => {
    const c = tailscale([relay8080]);
    const edits = { tailscale: check(['container:ctr_relay:8080']) };
    expect(changedPuts([c], rows, edits)).toEqual([]);
  });
  it('sends nothing for a connector without an edit', () => {
    expect(changedPuts([tailscale([])], rows, {})).toEqual([]);
  });
  it('skips a connector that does not exist, so no token is needed', () => {
    const edits = { cloudflared: check(['container:ctr_relay:8080']) };
    expect(changedPuts([tailscale([])], rows, edits)).toEqual([]);
  });
  it('sends a PUT for each changed connector and never a token', () => {
    const edits = {
      tailscale: check([]),
      cloudflared: check(['container:ctr_relay:8080']),
    };
    const puts = changedPuts([tailscale([relay8080]), cloudflared([])], rows, edits);
    expect(puts.map((p) => p.kind)).toEqual(['tailscale', 'cloudflared']);
    for (const p of puts) expect(Object.keys(p.body)).toEqual(['targets']);
  });
});

describe('externalPortErrors', () => {
  it('reports two checked rows with one external port, on both rows', () => {
    const choices = check(['container:ctr_relay:8080', 'database:db_main:5432'], {
      'database:db_main:5432': '8080',
    });
    const errors = externalPortErrors(rows, choices);
    const message = 'Two services use external port 8080. Set another external port.';
    expect(errors['container:ctr_relay:8080']).toBe(message);
    expect(errors['database:db_main:5432']).toBe(message);
  });
  it.each(['0', '65536', 'abc', '1.5', ''])('rejects the port %j', (port) => {
    const errors = externalPortErrors(
      rows,
      check(['database:db_main:5432'], {
        'database:db_main:5432': port,
      }),
    );
    expect(errors['database:db_main:5432']).toBe('Use a port from 1 to 65535.');
  });
  it('ignores unchecked rows', () => {
    const choices = check([], { 'database:db_main:5432': '0' });
    expect(externalPortErrors(rows, choices)).toEqual({});
  });
});

describe('addressLine', () => {
  it('shows nothing for an unchecked row', () => {
    expect(addressLine(tailscale([relay8080]), rows[0] as TargetRow, false)).toEqual({
      text: null,
      waiting: false,
    });
  });
  it('shows the saved address of a checked row', () => {
    expect(addressLine(tailscale([relay8080]), rows[0] as TargetRow, true).text).toBe(
      relay8080.address,
    );
  });
  it('says the connector is waiting when the address is null', () => {
    const c = tailscale([{ ...relay8080, address: null }]);
    expect(addressLine(c, rows[0] as TargetRow, true)).toEqual({ text: null, waiting: true });
  });
  it('shows no address before the first save', () => {
    expect(addressLine(tailscale([]), rows[0] as TargetRow, true)).toEqual({
      text: null,
      waiting: false,
    });
  });
});

describe('statusInfo', () => {
  it.each([
    ['provisioning', 'Setting up'],
    ['connected', 'Connected'],
    ['disconnected', 'Disconnected'],
    ['stopped', 'Stopped'],
    ['deleting', 'Deleting'],
  ] as const)('%s shows %s', (status, label) => {
    expect(statusInfo(status)).toEqual({ label, className: status });
  });
});

describe('tokenError', () => {
  it('needs the tskey- prefix for Tailscale', () => {
    expect(tokenError('tailscale', 'tskey-auth-TEST')).toBeNull();
    expect(tokenError('tailscale', 'abc')).toBe('A Tailscale auth key starts with tskey-.');
  });
  it('asks for a value', () => {
    expect(tokenError('tailscale', '  ')).toBe('Paste the auth key.');
    expect(tokenError('cloudflared', '')).toBe('Paste the connector token.');
  });
  it('accepts any cloudflared token', () => {
    expect(tokenError('cloudflared', 'eyJ-TEST')).toBeNull();
  });
});

describe('pageView', () => {
  const base = {
    owner: true,
    accessLoading: false,
    accessError: false,
    accessReady: true,
    connectorsLoading: false,
    connectorsError: false,
    targetsLoading: false,
    targetsError: false,
    memberDenied: false,
  };
  it('is ready for an owner with access', () => {
    expect(pageView(base)).toBe('ready');
  });
  it('is loading while the access or the lists load', () => {
    expect(pageView({ ...base, accessLoading: true })).toBe('loading');
    expect(pageView({ ...base, connectorsLoading: true })).toBe('loading');
    expect(pageView({ ...base, targetsLoading: true })).toBe('loading');
  });
  it('is an error when a request fails', () => {
    expect(pageView({ ...base, accessError: true })).toBe('error');
    expect(pageView({ ...base, targetsError: true })).toBe('error');
  });
  it('asks an owner without access to request it', () => {
    expect(pageView({ ...base, accessReady: false })).toBe('access');
  });
  it('tells a member that the owner has no access', () => {
    expect(pageView({ ...base, owner: false, accessReady: false, memberDenied: true })).toBe(
      'member-access',
    );
  });
  it('shows a member the lists when the owner has access', () => {
    expect(pageView({ ...base, owner: false, accessReady: false })).toBe('ready');
  });
});
