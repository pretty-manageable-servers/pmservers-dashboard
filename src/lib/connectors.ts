import type {
  AvailableTarget,
  Connector,
  ConnectorKind,
  ConnectorPut,
  ConnectorStatus,
  ConnectorTargetInput,
} from './api/types';

export const CONNECTOR_KINDS: ConnectorKind[] = ['tailscale', 'cloudflared'];

export const CONNECTOR_NAME: Record<ConnectorKind, string> = {
  tailscale: 'Tailscale',
  cloudflared: 'Cloudflare Tunnel',
};

/** One row of the targets table: one port of one container, or the database. */
export interface TargetRow {
  kind: 'container' | 'database';
  id: string;
  name: string;
  port: number;
}

/** The draft of one cell: is the target checked, and its external port (text, as typed). */
export interface Choice {
  checked: boolean;
  externalPort: string;
}

export const rowKey = (t: { kind: string; id: string; port: number }) =>
  `${t.kind}:${t.id}:${t.port}`;

/** The choice of one row. A row with no choice is not checked, and its port is the external port. */
export function choiceOf(choices: Record<string, Choice>, row: TargetRow): Choice {
  return choices[rowKey(row)] ?? { checked: false, externalPort: String(row.port) };
}

export function rowsOf(available: AvailableTarget[]): TargetRow[] {
  return available.flatMap((t) =>
    t.ports.map((port) => ({ kind: t.kind, id: t.id, name: t.name, port })),
  );
}

/** The saved choices of one connector. A checked row has the saved external port. */
export function savedChoices(
  connector: Connector | undefined,
  rows: TargetRow[],
): Record<string, Choice> {
  const out: Record<string, Choice> = {};
  for (const row of rows) {
    const saved = connector?.targets.find(
      (t) => t.kind === row.kind && t.id === row.id && t.port === row.port,
    );
    out[rowKey(row)] = {
      checked: saved !== undefined,
      externalPort: String(saved?.external_port ?? row.port),
    };
  }
  return out;
}

/** The targets list that a PUT sends for one connector. Rows keep the order of the table. */
export function targetInputs(
  kind: ConnectorKind,
  rows: TargetRow[],
  choices: Record<string, Choice>,
): ConnectorTargetInput[] {
  return rows
    .filter((row) => choiceOf(choices, row).checked)
    .map((row) => ({
      kind: row.kind,
      id: row.id,
      port: row.port,
      external_port: kind === 'tailscale' ? Number(choiceOf(choices, row).externalPort) : null,
    }));
}

/** The targets that a connector has now, in the same shape as a PUT sends them. */
export function savedInputs(connector: Connector): ConnectorTargetInput[] {
  return connector.targets.map((t) => ({
    kind: t.kind,
    id: t.id,
    port: t.port,
    external_port: t.external_port,
  }));
}

const inputKey = (t: ConnectorTargetInput) =>
  `${t.kind}:${t.id}:${t.port}:${t.external_port ?? ''}`;

/** True if the two lists hold the same targets, in any order. */
export function sameTargets(a: ConnectorTargetInput[], b: ConnectorTargetInput[]): boolean {
  if (a.length !== b.length) return false;
  const keys = new Set(a.map(inputKey));
  return b.every((t) => keys.has(inputKey(t))) && new Set(b.map(inputKey)).size === keys.size;
}

/** The body of a PUT that changes only the targets. The token is not sent, so it stays as it is. */
export function targetsBody(targets: ConnectorTargetInput[]): ConnectorPut {
  return { targets };
}

/**
 * The connectors that have a changed target list, with the PUT body for each one.
 * A connector with no draft keeps its saved targets. A connector that does not exist is skipped.
 */
export function changedPuts(
  connectors: Connector[],
  rows: TargetRow[],
  edits: Partial<Record<ConnectorKind, Record<string, Choice>>>,
): { kind: ConnectorKind; body: ConnectorPut }[] {
  const out: { kind: ConnectorKind; body: ConnectorPut }[] = [];
  for (const kind of CONNECTOR_KINDS) {
    const connector = connectors.find((c) => c.kind === kind);
    const choices = edits[kind];
    if (!connector || !choices) continue;
    const next = targetInputs(kind, rows, choices);
    if (!sameTargets(savedInputs(connector), next)) out.push({ kind, body: targetsBody(next) });
  }
  return out;
}

/** The client check of the external ports. It gives the same text as the API. */
export function externalPortErrors(
  rows: TargetRow[],
  choices: Record<string, Choice>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const seen = new Map<number, string>();
  for (const row of rows) {
    const choice = choiceOf(choices, row);
    if (!choice.checked) continue;
    const port = Number(choice.externalPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      errors[rowKey(row)] = 'Use a port from 1 to 65535.';
      continue;
    }
    if (seen.has(port)) {
      const message = `Two services use external port ${port}. Set another external port.`;
      errors[rowKey(row)] = message;
      errors[seen.get(port) as string] = message;
    } else {
      seen.set(port, rowKey(row));
    }
  }
  return errors;
}

/** The text for a connector status, and the color class for its dot. */
export function statusInfo(status: ConnectorStatus): { label: string; className: string } {
  const label: Record<ConnectorStatus, string> = {
    provisioning: 'Setting up',
    connected: 'Connected',
    disconnected: 'Disconnected',
    stopped: 'Stopped',
    deleting: 'Deleting',
  };
  return { label: label[status], className: status };
}

/** The address text of a saved target, or the text that tells why there is none. */
export function addressLine(
  connector: Connector | undefined,
  row: TargetRow,
  checked: boolean,
): { text: string | null; waiting: boolean } {
  if (!checked) return { text: null, waiting: false };
  const saved = connector?.targets.find(
    (t) => t.kind === row.kind && t.id === row.id && t.port === row.port,
  );
  if (!saved) return { text: null, waiting: false };
  if (!saved.address) return { text: null, waiting: true };
  return { text: saved.address, waiting: false };
}

export type PageView = 'loading' | 'error' | 'access' | 'member-access' | 'ready';

/**
 * Which page state to show. An owner sees the access state first. A member sees the owner's
 * access state, as the API answers 403 to the list for them.
 */
export function pageView(s: {
  owner: boolean;
  accessLoading: boolean;
  accessError: boolean;
  accessReady: boolean;
  connectorsLoading: boolean;
  connectorsError: boolean;
  targetsLoading: boolean;
  targetsError: boolean;
  memberDenied: boolean;
}): PageView {
  if (s.owner) {
    if (s.accessLoading) return 'loading';
    if (s.accessError) return 'error';
    if (!s.accessReady) return 'access';
  } else if (s.memberDenied) {
    return 'member-access';
  }
  if (s.connectorsLoading || s.targetsLoading) return 'loading';
  if (s.connectorsError || s.targetsError) return 'error';
  return 'ready';
}

/** The auth key rule of the API. A Tailscale key starts with tskey-. Returns the error text, or null. */
export function tokenError(kind: ConnectorKind, token: string): string | null {
  const value = token.trim();
  if (value === '')
    return kind === 'tailscale' ? 'Paste the auth key.' : 'Paste the connector token.';
  if (value.length > 4096) return 'The connector token is empty or too long.';
  if (kind === 'tailscale' && !value.startsWith('tskey-'))
    return 'A Tailscale auth key starts with tskey-.';
  return null;
}
