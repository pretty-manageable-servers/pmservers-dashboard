/** Make an ed25519 SSH key pair in the browser. The private key never leaves the browser. */

export interface SshKeyPair {
  /** One line, for authorized_keys. */
  publicKey: string;
  /** OpenSSH private key file, not encrypted. */
  privateKey: string;
}

const KEY_TYPE = 'ssh-ed25519';
const PKCS8_PREFIX_LENGTH = 16;
const textEncoder = new TextEncoder();

const u32 = (n: number) =>
  new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** An SSH "string": a 4 byte length, then the bytes. */
const sshString = (b: Uint8Array | string) => {
  const bytes = typeof b === 'string' ? textEncoder.encode(b) : b;
  return concat(u32(bytes.length), bytes);
};

function toBase64(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

/** Build the two files from a 32 byte seed and its 32 byte public key. */
export function encodeEd25519(seed: Uint8Array, pub: Uint8Array, comment: string): SshKeyPair {
  const publicBlob = concat(sshString(KEY_TYPE), sshString(pub));
  const check = crypto.getRandomValues(new Uint8Array(4));
  let section = concat(
    check,
    check,
    sshString(KEY_TYPE),
    sshString(pub),
    sshString(concat(seed, pub)),
    sshString(comment),
  );
  // Pad to the cipher block size (8 for "none") with 1, 2, 3 ...
  const pad = (8 - (section.length % 8)) % 8;
  section = concat(
    section,
    Uint8Array.from({ length: pad }, (_, i) => i + 1),
  );

  const file = concat(
    textEncoder.encode('openssh-key-v1\0'),
    sshString('none'),
    sshString('none'),
    sshString(''),
    u32(1),
    sshString(publicBlob),
    sshString(section),
  );
  const body = toBase64(file)
    .match(/.{1,70}/g)!
    .join('\n');
  return {
    publicKey: `${KEY_TYPE} ${toBase64(publicBlob)} ${comment}`,
    privateKey: `-----BEGIN OPENSSH PRIVATE KEY-----\n${body}\n-----END OPENSSH PRIVATE KEY-----\n`,
  };
}

/** Save a text file in the browser. */
export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** True if this browser can make ed25519 keys (Chrome 137, Firefox 129, Safari 17). */
export async function canGenerateSshKey(): Promise<boolean> {
  try {
    await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
    return true;
  } catch {
    return false;
  }
}

export async function generateSshKey(comment: string): Promise<SshKeyPair> {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  // PKCS#8 for ed25519 is a fixed 16 byte header and then the 32 byte seed.
  const seed = pkcs8.slice(PKCS8_PREFIX_LENGTH);
  if (pub.length !== 32 || seed.length !== 32) throw new Error('Unexpected ed25519 key size');
  return encodeEd25519(seed, pub, comment);
}
