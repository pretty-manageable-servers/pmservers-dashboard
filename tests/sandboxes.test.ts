import { describe, expect, it } from 'vitest';
import { endsIn, shortSandboxId } from '@/lib/sandboxes';

describe('shortSandboxId', () => {
  it('shows the first 8 characters', () => {
    expect(shortSandboxId('q7d3k9m2v5x8b1n4c6z0-5f0c1e2d')).toBe('q7d3k9m2…');
  });
  it('keeps a short id as it is', () => {
    expect(shortSandboxId('abc')).toBe('abc');
  });
});

describe('endsIn', () => {
  const now = Date.parse('2026-10-11T12:00:00Z');
  const at = (seconds: number) => new Date(now + seconds * 1000).toISOString();
  it('says No end time when there is no end', () => {
    expect(endsIn(null, now)).toBe('No end time');
  });
  it.each([
    [-5, 'Ending now'],
    [30, 'Less than 1 min'],
    [5 * 60, '5 min'],
    [3 * 3600, '3 h'],
    [2 * 86400, '2 d'],
  ])('%d seconds left is %s', (seconds, text) => {
    expect(endsIn(at(seconds), now)).toBe(text);
  });
});
