import { describe, expect, it } from 'vitest';
import { parseFileId, requireFileId } from '../src/index.js';

describe('file id parser', () => {
  it.each([
    ['123', '123'],
    ['file123', '123'],
    ['https://example.test/file123', '123'],
    ['https://example.test/file123?download=1', '123'],
    ['https://example.test/path/file123/', '123'],
    ['%66ile123', '123'],
  ])('parses %s', (input, expected) => {
    expect(parseFileId(input)).toBe(expected);
  });

  it.each(['', 'abc', 'file', 'https://example.test/file'])('rejects %s', (input) => {
    expect(parseFileId(input)).toBeNull();
  });

  it('throws for invalid ids', () => {
    expect(() => requireFileId('wat')).toThrow(/Invalid file ID/);
  });
});
