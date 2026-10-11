import { describe, expect, it } from 'vitest';
import { isBusy } from '@/lib/status';

describe('isBusy', () => {
  it('is true while a resource changes state', () => {
    for (const status of ['provisioning', 'deleting'] as const) {
      expect(isBusy(status)).toBe(true);
    }
  });
  it('is false for stable states', () => {
    for (const status of ['running', 'stopped', 'failed', 'unknown'] as const) {
      expect(isBusy(status)).toBe(false);
    }
  });
});
