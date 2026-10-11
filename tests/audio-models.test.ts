import { describe, expect, it } from 'vitest';
import { defaultModelIds, modelBadge, modelPrice } from '@/lib/catalog';

describe('modelBadge', () => {
  it.each([
    ['llm', 'badge llm', 'LLM'],
    ['embedding', 'badge emb', 'Embedding'],
    ['decision', 'badge dec', 'Decision'],
    ['stt', 'badge stt', 'STT'],
    ['tts', 'badge tts', 'TTS'],
  ])('gives the badge for %s', (type, className, label) => {
    expect(modelBadge(type)).toEqual({ className, label });
  });
  it('gives each audio type its own color class', () => {
    const classes = ['llm', 'embedding', 'decision', 'stt', 'tts'].map(
      (t) => modelBadge(t).className,
    );
    expect(new Set(classes).size).toBe(classes.length);
  });
  it('gives a plain badge with the raw type for an unknown type', () => {
    expect(modelBadge('vision')).toEqual({ className: 'badge', label: 'vision' });
  });
  it('does not crash on a prototype key', () => {
    expect(modelBadge('constructor')).toEqual({ className: 'badge', label: 'constructor' });
  });
});

describe('modelPrice', () => {
  it('shows the price per minute for stt', () => {
    expect(modelPrice({ type: 'stt', price_per_minute: 0.006 })).toBe('$0.006 / min');
  });
  it('shows the price per 1M chars for tts', () => {
    expect(modelPrice({ type: 'tts', price_per_m_chars: 15 })).toBe('$15 / 1M chars');
  });
  it('shows the input and output price per 1M tokens for llm', () => {
    expect(modelPrice({ type: 'llm', price_in_per_m: 0.45, price_out_per_m: 1.41 })).toBe(
      '$0.45 in · $1.41 out / 1M tokens',
    );
  });
  it('rounds to 3 significant digits', () => {
    expect(modelPrice({ type: 'llm', price_in_per_m: 0.05, price_out_per_m: 0.156667 })).toBe(
      '$0.05 in · $0.157 out / 1M tokens',
    );
  });
  it('shows only the input price per 1M tokens for embedding when output is 0', () => {
    expect(modelPrice({ type: 'embedding', price_in_per_m: 0.03, price_out_per_m: 0 })).toBe(
      '$0.03 / 1M tokens',
    );
  });
  it('shows only the input price per 1M tokens for decision when output is 0', () => {
    expect(modelPrice({ type: 'decision', price_in_per_m: 0.0378, price_out_per_m: 0 })).toBe(
      '$0.0378 / 1M tokens',
    );
  });
  it('shows both prices for embedding when output is not 0', () => {
    expect(modelPrice({ type: 'embedding', price_in_per_m: 1, price_out_per_m: 2 })).toBe(
      '$1 in · $2 out / 1M tokens',
    );
  });
  it('gives null for llm when a token price is missing', () => {
    expect(modelPrice({ type: 'llm' })).toBeNull();
    expect(modelPrice({ type: 'llm', price_in_per_m: 0.45 })).toBeNull();
  });
  it('gives null for embedding and decision when the input price is missing', () => {
    expect(modelPrice({ type: 'embedding', price_out_per_m: 0 })).toBeNull();
    expect(modelPrice({ type: 'decision', price_in_per_m: null, price_out_per_m: 0 })).toBeNull();
  });
  it('gives null when the stt price is missing', () => {
    expect(modelPrice({ type: 'stt', price_per_minute: null })).toBeNull();
  });
  it('gives null when the tts price is missing', () => {
    expect(modelPrice({ type: 'tts' })).toBeNull();
  });
});

describe('defaultModelIds', () => {
  it('preselects embedding, decision and stt, but not llm or tts', () => {
    const models = [
      { id: 'chat', type: 'llm' },
      { id: 'emb', type: 'embedding' },
      { id: 'vane', type: 'decision' },
      { id: 'squall', type: 'stt' },
      { id: 'thunder', type: 'tts' },
    ];
    expect(defaultModelIds(models)).toEqual(['emb', 'vane', 'squall']);
  });
  it('gives an empty list when the catalog is missing', () => {
    expect(defaultModelIds([])).toEqual([]);
  });
});
