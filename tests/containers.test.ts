import { describe, expect, it } from 'vitest';
import {
  changedFields,
  credentialsFor,
  envMap,
  imageHost,
  normalizeHost,
  validateContainerName,
  validateEnv,
  validateImage,
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
  } as Container;
  const same = {
    image: c.image,
    size: c.size,
    credential: 'reg_1',
    runtime: 'gvisor' as const,
    env: null,
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
  it('sends env only to replace all variables', () => {
    expect(changedFields(c, { ...same, env: {} })).toEqual({ env: {} });
  });
});
