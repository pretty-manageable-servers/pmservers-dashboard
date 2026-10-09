import { describe, expect, it } from 'vitest';
import { validateEmail, validateName } from '@/lib/validation';

describe('validateName', () => {
  it.each(['abc', 'worker-1', 'a'.repeat(40), '123', 'a-b-c'])('accepts %s', (n) => {
    expect(validateName(n)).toBeNull();
  });
  it.each(['ab', 'a'.repeat(41), 'Worker', 'my_vm', 'my vm', '', 'vm.1'])('rejects %j', (n) => {
    expect(validateName(n)).not.toBeNull();
  });
});

describe('validateEmail', () => {
  it.each(['a@b.co', ' ann@example.com ', 'x.y+z@mail.example.org'])('accepts %j', (e) => {
    expect(validateEmail(e)).toBeNull();
  });
  it.each(['', 'ann', 'ann@', '@example.com', 'ann@example', 'a b@example.com'])(
    'rejects %j',
    (e) => {
      expect(validateEmail(e)).not.toBeNull();
    },
  );
});
