import { describe, expect, it } from 'vitest';
import { backoffDelay } from '@/lib/api/events';

describe('backoffDelay', () => {
  it('doubles each time, from 1 s', () => {
    expect([0, 1, 2, 3].map(backoffDelay)).toEqual([1000, 2000, 4000, 8000]);
  });
  it('stops at 30 s', () => {
    expect(backoffDelay(10)).toBe(30_000);
  });
});
