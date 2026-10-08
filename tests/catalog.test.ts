import { describe, expect, it } from 'vitest';
import { chooseId } from '@/lib/catalog';

const items = [{ id: 'a' }, { id: 'b' }];

describe('chooseId', () => {
  it('keeps a pick that is in the catalog', () => {
    expect(chooseId('b', items)).toBe('b');
  });
  it('uses the first item when nothing is picked', () => {
    expect(chooseId(null, items)).toBe('a');
  });
  it('uses the first item when the pick is not in the catalog', () => {
    expect(chooseId('Debian 13', items)).toBe('a');
  });
  it('gives an empty id while the catalog is loading', () => {
    expect(chooseId(null, undefined)).toBe('');
  });
});
