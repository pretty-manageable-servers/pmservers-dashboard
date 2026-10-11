import { describe, expect, it } from 'vitest';
import {
  changedFields,
  credentialsFor,
  envChanges,
  envMap,
  imageHost,
  normalizeHost,
  parsePorts,
  validateContainerName,
  validateEnv,
  validateEnvEdit,
  validateImage,
  validatePorts,
} from '@/lib/containers';
import type { Container } from '@/lib/api/types';

describe('imageHost', () => {
  it.each([
    ['nginx', 'docker.io'],
    ['library/nginx:1.27', 'docker.io'],
    ['ghcr.io/owner/app:1.0', 'ghcr.io'],
    ['localhost/app', 'localhost'],
    ['registry.example.com:5000/team/app', 'registry.example.com:5000'],
    ['index.docker.io/library/nginx', 'docker.io'],
    ['owner/app', 'docker.io'],
  ])('%s is on %s', (image, host) => {
    expect(imageHost(image)).toBe(host);
  });
  it.each(['', 'Ghcr.io/Owner/App', 'app:', 'a b', 'x'.repeat(513)])('rejects %j', (image) => {
    expect(imageHost(image)).toBeNull();
    expect(validateImage(image)).not.toBeNull();
  });
});

describe('normalizeHost', () => {
  it('removes the scheme and slash and uses lowercase', () => {
    expect(normalizeHost(' https://GHCR.io/ ')).toBe('ghcr.io');
    expect(normalizeHost('registry-1.docker.io')).toBe('docker.io');
  });
});

describe('validateContainerName', () => {
  it.each(['a', 'relay-bot', 'a'.repeat(63)])('accepts %s', (n) => {
    expect(validateContainerName(n)).toBeNull();
  });
  it.each(['', '1bot', 'Bot', 'my_bot', 'a'.repeat(64)])('rejects %j', (n) => {
    expect(validateContainerName(n)).not.toBeNull();
  });
});

describe('validateEnv', () => {
  it('accepts good rows and ignores empty rows', () => {
    expect(
      validateEnv([
        { name: 'TOKEN', value: 'x' },
        { name: '', value: '' },
      ]),
    ).toBeNull();
  });
  it('rejects a bad name, a duplicate, too many and too large', () => {
    expect(validateEnv([{ name: '1X', value: '' }])).not.toBeNull();
    expect(validateEnv([{ name: '', value: 'x' }])).not.toBeNull();
    expect(
      validateEnv([
        { name: 'A', value: '' },
        { name: 'A', value: '' },
      ]),
    ).not.toBeNull();
    const many = Array.from({ length: 51 }, (_, i) => ({ name: `V${i}`, value: '' }));
    expect(validateEnv(many)).not.toBeNull();
    expect(validateEnv([{ name: 'BIG', value: 'x'.repeat(33 * 1024) }])).not.toBeNull();
  });
  it('makes a map without empty rows', () => {
    expect(
      envMap([
        { name: 'A', value: '1' },
        { name: '', value: '' },
      ]),
    ).toEqual({ A: '1' });
  });
});

describe('credentialsFor', () => {
  const creds = [
    { id: 'a', host: 'ghcr.io' },
    { id: 'b', host: 'docker.io' },
  ];
  it('keeps only credentials for the image host', () => {
    expect(credentialsFor('ghcr.io/o/app', creds).map((c) => c.id)).toEqual(['a']);
    expect(credentialsFor('nginx', creds).map((c) => c.id)).toEqual(['b']);
    expect(credentialsFor('not valid!', creds)).toEqual([]);
  });
});

describe('changedFields', () => {
  const c = {
    image: 'ghcr.io/o/app:1',
    size: 'pms-c-250m-512',
    registry_credential_id: 'reg_1',
    runtime: 'gvisor',
    ports: [8080],
  } as Container;
  const same = {
    image: c.image,
    size: c.size,
    credential: 'reg_1',
    runtime: 'gvisor' as const,
    ports: [8080],
    env: {},
  };
  it('sends nothing when nothing changed', () => {
    expect(changedFields(c, same)).toEqual({});
  });
  it('sends only the changed fields, null to remove the credential', () => {
    expect(changedFields(c, { ...same, size: 'pms-c-500m-1g', credential: null })).toEqual({
      size: 'pms-c-500m-1g',
      registry_credential_id: null,
    });
  });
  it('sends ports when they change, [] to clear them', () => {
    expect(changedFields(c, { ...same, ports: [8080, 9000] })).toEqual({ ports: [8080, 9000] });
    expect(changedFields(c, { ...same, ports: [] })).toEqual({ ports: [] });
  });
  it('sends env_set and env_unset, never env', () => {
    expect(changedFields(c, { ...same, env: { env_set: { B: '2' }, env_unset: ['C'] } })).toEqual({
      env_set: { B: '2' },
      env_unset: ['C'],
    });
  });
});

describe('envChanges', () => {
  const base = { names: ['A', 'B', 'C'], values: {}, removed: [], added: [] };
  it('sends nothing when nothing changed', () => {
    expect(envChanges(base)).toEqual({});
  });
  it('sends typed values, new rows and removed names', () => {
    expect(
      envChanges({
        names: ['A', 'B', 'C'],
        values: { B: '20', A: '' },
        removed: ['C'],
        added: [
          { name: 'D', value: '4' },
          { name: '', value: '' },
        ],
      }),
    ).toEqual({ env_set: { B: '20', D: '4' }, env_unset: ['C'] });
  });
  it('does not send the value of a removed name', () => {
    expect(envChanges({ ...base, values: { C: 'x' }, removed: ['C'] })).toEqual({
      env_unset: ['C'],
    });
  });
  it('a removed name that is added again is a change, not a removal', () => {
    expect(envChanges({ ...base, removed: ['C'], added: [{ name: 'C', value: '3' }] })).toEqual({
      env_set: { C: '3' },
    });
  });
});

describe('validateEnvEdit', () => {
  const base = { names: ['A', 'B'], values: {}, removed: [], added: [] };
  it('accepts no new rows and good new rows', () => {
    expect(validateEnvEdit(base)).toBeNull();
    expect(validateEnvEdit({ ...base, added: [{ name: 'C', value: 'x' }] })).toBeNull();
  });
  it('rejects a bad name and a name that exists', () => {
    expect(validateEnvEdit({ ...base, added: [{ name: '1X', value: 'x' }] })).not.toBeNull();
    expect(validateEnvEdit({ ...base, added: [{ name: 'A', value: 'x' }] })).not.toBeNull();
  });
  it('accepts the name of a removed variable', () => {
    expect(
      validateEnvEdit({ ...base, removed: ['A'], added: [{ name: 'A', value: 'x' }] }),
    ).toBeNull();
  });
  it('counts kept and new names together', () => {
    const names = Array.from({ length: 50 }, (_, i) => `K${i}`);
    expect(
      validateEnvEdit({ names, values: {}, removed: [], added: [{ name: 'X', value: '1' }] }),
    ).not.toBeNull();
    expect(
      validateEnvEdit({ names, values: {}, removed: ['K0'], added: [{ name: 'X', value: '1' }] }),
    ).toBeNull();
  });
});

describe('validatePorts', () => {
  it('accepts empty and valid lists', () => {
    expect(validatePorts('')).toBeNull();
    expect(validatePorts('8080, 9000 5432')).toBeNull();
    expect(parsePorts('8080, 9000')).toEqual([8080, 9000]);
  });
  it('rejects bad lists', () => {
    expect(validatePorts('abc')).not.toBeNull();
    expect(validatePorts('0')).not.toBeNull();
    expect(validatePorts('65536')).not.toBeNull();
    expect(validatePorts('80, 80')).not.toBeNull();
    expect(validatePorts('1,2,3,4,5,6')).not.toBeNull();
  });
});
