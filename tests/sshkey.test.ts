import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateSshKey } from '@/lib/sshkey';
import { validateSshKey } from '@/lib/validation';

describe('generateSshKey', () => {
  it('makes a public key that passes validation', async () => {
    const k = await generateSshKey('worker-1@pmservers');
    expect(validateSshKey(k.publicKey)).toBeNull();
    expect(k.publicKey).toMatch(/^ssh-ed25519 \S+ worker-1@pmservers$/);
  });

  it('makes an OpenSSH private key file', async () => {
    const k = await generateSshKey('x');
    expect(k.privateKey.startsWith('-----BEGIN OPENSSH PRIVATE KEY-----\n')).toBe(true);
    expect(k.privateKey.endsWith('-----END OPENSSH PRIVATE KEY-----\n')).toBe(true);
  });

  it('makes a new pair each time', async () => {
    const [a, b] = await Promise.all([generateSshKey('x'), generateSshKey('x')]);
    expect(a.publicKey).not.toBe(b.publicKey);
  });

  // ssh-keygen reads the private key and prints its public key. They must match.
  it('private key matches the public key (ssh-keygen)', async () => {
    let has = true;
    try {
      execFileSync('ssh-keygen', ['-?'], { stdio: 'ignore' });
    } catch (e) {
      has = (e as NodeJS.ErrnoException).code !== 'ENOENT';
    }
    if (!has) return;
    const k = await generateSshKey('check@pmservers');
    const file = join(mkdtempSync(join(tmpdir(), 'sshkey-')), 'id');
    writeFileSync(file, k.privateKey);
    chmodSync(file, 0o600);
    const out = execFileSync('ssh-keygen', ['-y', '-f', file]).toString().trim();
    expect(out.split(' ').slice(0, 2)).toEqual(k.publicKey.split(' ').slice(0, 2));
  });
});
