import { describe, expect, it } from 'vitest';
import { pollInterval } from '@/lib/status';

describe('pollInterval', () => {
  it('polls every 3 s while any item is busy', () => {
    for (const status of ['pending', 'provisioning', 'deleting'] as const) {
      expect(pollInterval([{ status: 'running' }, { status }])).toBe(3000);
    }
  });
  it('stops when all items are stable', () => {
    expect(
      pollInterval([
        { status: 'running' },
        { status: 'stopped' },
        { status: 'failed' },
        { status: 'sleeping' },
      ]),
    ).toBe(false);
  });
  it('stops for an empty or missing list', () => {
    expect(pollInterval([])).toBe(false);
    expect(pollInterval(undefined)).toBe(false);
  });
});
