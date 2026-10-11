import { describe, expect, it } from 'vitest';
import {
  expiresInDays,
  expiresLabel,
  lastUsedLabel,
  TOKEN_NAME_MAX,
  validateTokenName,
} from '@/lib/tokens';

describe('validateTokenName', () => {
  it.each(['ci', 'deploy bot', 'x'.repeat(TOKEN_NAME_MAX)])('accepts %j', (n) =>
    expect(validateTokenName(n)).toBeNull(),
  );
  it.each(['', '   ', 'x'.repeat(TOKEN_NAME_MAX + 1)])('rejects %j', (n) =>
    expect(validateTokenName(n)).not.toBeNull(),
  );
});

describe('expiresInDays', () => {
  it('maps the select to the API value', () => {
    expect(expiresInDays('never')).toBeNull();
    expect(expiresInDays('30')).toBe(30);
    expect(expiresInDays('90')).toBe(90);
    expect(expiresInDays('365')).toBe(365);
  });
});

describe('token labels', () => {
  const now = Date.parse('2026-10-11T12:00:00Z');
  it('says Never for a token that does not expire', () => {
    expect(expiresLabel({ expires_at: null }, now)).toBe('Never');
  });
  it('shows the day of expiry, and Expired after it', () => {
    const later = '2026-11-10T12:00:00Z';
    expect(expiresLabel({ expires_at: later }, now)).toMatch(/Nov/);
    expect(expiresLabel({ expires_at: '2026-10-01T00:00:00Z' }, now)).toMatch(/^Expired /);
  });
  it('says Never used before the first call', () => {
    expect(lastUsedLabel({ last_used_at: null }, now)).toBe('Never used');
    expect(lastUsedLabel({ last_used_at: '2026-10-11T11:30:00Z' }, now)).toBe('30 min ago');
  });
});
