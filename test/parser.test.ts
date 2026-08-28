import { describe, expect, it } from 'vitest';
import { parseTimer } from '../src/index.js';

describe('timer parser', () => {
  it('parses HH:MM:SS', () => expect(parseTimer('01:02:03')).toBe(3723));
  it('parses MM:SS', () => expect(parseTimer('02:03')).toBe(123));
  it('rejects invalid values', () => expect(parseTimer('wat')).toBeNull());
});
