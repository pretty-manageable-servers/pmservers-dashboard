'use client';

import { useState } from 'react';
import { copyText } from './CopyField';
import { useUpdateConnector } from '@/lib/api/hooks';
import type { AvailableTarget, Connector, ConnectorKind } from '@/lib/api/types';
import {
  addressLine,
  changedPuts,
  choiceOf,
  CONNECTOR_KINDS,
  CONNECTOR_NAME,
  externalPortErrors,
  rowKey,
  rowsOf,
  savedChoices,
  type Choice,
  type TargetRow,
} from '@/lib/connectors';

type Edits = Partial<Record<ConnectorKind, Record<string, Choice>>>;

/**
 * The targets table. One row for each container port and each database. One checkbox for each
 * connector that exists. One Save sends one PUT for each connector that changed.
 */
export function ConnectorTargets({
  projectId,
  connectors,
  available,
}: {
  projectId: string;
  connectors: Connector[];
  available: AvailableTarget[];
}) {
  const update = useUpdateConnector(projectId);
  const rows = rowsOf(available);
  const existing = CONNECTOR_KINDS.filter((kind) => connectors.some((c) => c.kind === kind));
  // Only the connectors that the user changed. Saved choices come from the server.
  const [edits, setEdits] = useState<Edits>({});
  const [showErrors, setShowErrors] = useState(false);
  const [apiErrors, setApiErrors] = useState<Record<string, string>>({});

  const choicesOf = (kind: ConnectorKind): Record<string, Choice> =>
    edits[kind] ??
    savedChoices(
      connectors.find((c) => c.kind === kind),
      rows,
    );

  const setChoice = (kind: ConnectorKind, row: TargetRow, next: Partial<Choice>) => {
    setApiErrors({});
    setEdits((prev) => {
      const current =
        prev[kind] ??
        savedChoices(
          connectors.find((c) => c.kind === kind),
          rows,
        );
      return {
        ...prev,
        [kind]: { ...current, [rowKey(row)]: { ...current[rowKey(row)], ...next } },
      };
    });
  };

  // The external port check runs for Tailscale only. Cloudflare has no external port.
  const portErrors: Record<string, Record<string, string>> = {};
  if (existing.includes('tailscale')) {
    portErrors.tailscale = externalPortErrors(rows, choicesOf('tailscale'));
  }
  const hasPortErrors = Object.values(portErrors).some((e) => Object.keys(e).length > 0);
  const puts = changedPuts(connectors, rows, edits);

  const save = async () => {
    setShowErrors(true);
    setApiErrors({});
    if (hasPortErrors || puts.length === 0) return;
    const results = await Promise.allSettled(
      puts.map((p) => update.mutateAsync({ kind: p.kind, body: p.body })),
    );
    const errors: Record<string, string> = {};
    const remaining: Edits = {};
    results.forEach((result, i) => {
      const put = puts[i];
      if (!put || result.status === 'fulfilled') return;
      const kind = put.kind;
      errors[kind] = `${CONNECTOR_NAME[kind]}: ${result.reason.message}`;
      remaining[kind] = edits[kind];
    });
    setEdits(remaining);
    setApiErrors(errors);
    if (Object.keys(errors).length === 0) setShowErrors(false);
  };

  if (rows.length === 0) {
    return (
      <section className="ucard" style={{ padding: 20 }}>
        <span className="muted">
          No containers or databases yet. Create one, then choose what the connectors can reach.
        </span>
      </section>
    );
  }

  return (
    <section className="ucard" style={{ padding: 0, overflow: 'hidden' }} aria-label="Targets">
      <div style={{ padding: '16px 16px 8px', display: 'grid', gap: 4 }}>
        <b>Targets</b>
        <span className="muted" style={{ fontSize: 13 }}>
          {existing.length === 0
            ? 'Enable a connector above to choose what it can reach.'
            : 'Check what each connector can reach. Save applies your changes.'}
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="rtable">
          <thead>
            <tr>
              <th scope="col">Service</th>
              <th scope="col">Port</th>
              {existing.map((kind) => (
                <th scope="col" key={kind}>
                  {CONNECTOR_NAME[kind]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = rowKey(row);
              return (
                <tr key={key}>
                  <td data-label="Service">
                    <span style={{ display: 'grid', gap: 2 }}>
                      <span>{row.name}</span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {row.kind === 'container' ? 'Container' : 'Database'}
                      </span>
                    </span>
                  </td>
                  <td data-label="Port" className="mono">
                    {row.port}
                  </td>
                  {existing.map((kind) => {
                    const connector = connectors.find((c) => c.kind === kind);
                    const choice = choiceOf(choicesOf(kind), row);
                    const label = `${CONNECTOR_NAME[kind]}: ${row.name} port ${row.port}`;
                    const address = addressLine(connector, row, choice.checked);
                    const portError = showErrors ? portErrors[kind]?.[key] : undefined;
                    return (
                      <td data-label={CONNECTOR_NAME[kind]} key={kind}>
                        <span style={{ display: 'grid', gap: 6, minWidth: 0 }}>
                          <span
                            style={{
                              display: 'flex',
                              gap: 8,
                              alignItems: 'center',
                              flexWrap: 'wrap',
                            }}
                          >
                            <input
                              type="checkbox"
                              aria-label={label}
                              checked={choice.checked}
                              disabled={update.isPending}
                              style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                              onChange={(e) => setChoice(kind, row, { checked: e.target.checked })}
                            />
                            {kind === 'tailscale' && choice.checked && (
                              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span className="muted" style={{ fontSize: 12.5 }}>
                                  External port
                                </span>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  aria-label={`Tailscale external port for ${row.name} port ${row.port}`}
                                  value={choice.externalPort}
                                  min={1}
                                  max={65535}
                                  style={{
                                    width: 96,
                                    background: 'var(--bg)',
                                    border: '1px solid var(--line)',
                                    borderRadius: 9,
                                    padding: '6px 9px',
                                    color: 'var(--fg)',
                                    font: 'inherit',
                                  }}
                                  onChange={(e) =>
                                    setChoice(kind, row, { externalPort: e.target.value })
                                  }
                                  aria-invalid={!!portError}
                                />
                              </label>
                            )}
                          </span>
                          {portError && <span className="err-t">{portError}</span>}
                          {address.text && (
                            <span className="copy" style={{ alignItems: 'flex-start' }}>
                              <code style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                                {address.text}
                              </code>
                              <button
                                className="btn sm"
                                type="button"
                                aria-label={`Copy address for ${row.name} port ${row.port}`}
                                onClick={() => copyText(address.text ?? '')}
                              >
                                Copy
                              </button>
                            </span>
                          )}
                          {address.waiting && (
                            <span className="hint" style={{ margin: 0 }}>
                              Waiting for the connector
                            </span>
                          )}
                          {choice.checked && !address.text && !address.waiting && (
                            <span className="hint" style={{ margin: 0 }}>
                              Save to see the address
                            </span>
                          )}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: '12px 16px',
          borderTop: '1px solid var(--line)',
        }}
      >
        <span className="muted" style={{ flex: '1 1 200px', fontSize: 13 }}>
          {puts.length === 0
            ? 'No changes'
            : `${puts.length} ${puts.length === 1 ? 'connector' : 'connectors'} to save`}
        </span>
        <button
          className="btn primary"
          type="button"
          disabled={update.isPending || puts.length === 0}
          onClick={save}
        >
          Save
        </button>
      </div>
      {showErrors && hasPortErrors && (
        <div style={{ padding: '0 16px 12px' }}>
          <span className="err-t" role="alert">
            Fix the external ports before you save.
          </span>
        </div>
      )}
      {Object.values(apiErrors).map((message) => (
        <div key={message} style={{ padding: '0 16px 12px' }}>
          <span className="err-t" role="alert">
            {message}
          </span>
        </div>
      ))}
    </section>
  );
}
