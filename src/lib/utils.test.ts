import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges two class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('deduplicates conflicting Tailwind utility classes (tailwind-merge)', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('handles conditional classes — false is ignored', () => {
    expect(cn('base', false && 'hidden')).toBe('base');
  });

  it('handles undefined inputs', () => {
    expect(cn('a', undefined, 'b')).toBe('a b');
  });

  it('returns empty string with no inputs', () => {
    expect(cn()).toBe('');
  });
});
