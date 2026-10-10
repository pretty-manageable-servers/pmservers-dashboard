import { describe, expect, it } from 'vitest';
import { formatBytes, storageLine, storagePercent, validateDatabaseName } from '@/lib/databases';

describe('validateDatabaseName', () => {
  it.each(['db-1', 'main', 'a'])('accepts %s', (n) => expect(validateDatabaseName(n)).toBeNull());
  it.each(['', '1db', 'Db', 'a_b', 'x'.repeat(64)])('rejects %j', (n) =>
    expect(validateDatabaseName(n)).not.toBeNull(),
  );
});

describe('storage', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(48 * 1024 * 1024)).toBe('48.0 MiB');
    expect(formatBytes(1024 ** 3)).toBe('1.00 GiB');
  });
  it('shows used of limit and the percent', () => {
    const d = { used_bytes: 512 * 1024 * 1024, storage_limit_bytes: 1024 ** 3 };
    expect(storageLine(d)).toBe('512.0 MiB of 1.00 GiB');
    expect(storagePercent(d)).toBe(50);
    expect(storagePercent({ used_bytes: 1, storage_limit_bytes: 0 })).toBe(0);
  });
});
