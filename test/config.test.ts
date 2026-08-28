import { describe, expect, it } from 'vitest';
import { createSiteSdk } from '../src/index.js';

describe('SDK configuration', () => {
  it('rejects invalid site URLs', () => {
    expect(() => createSiteSdk({ domain: 'not-a-url' })).toThrow(/Invalid site domain/);
  });

  it('requires the host backend to provide the domain', () => {
    expect(() => createSiteSdk({} as any)).toThrow(/Site domain is required/);
    expect(() => createSiteSdk(undefined as any)).toThrow(/configuration is required/);
  });

  it('rejects domains with credentials or query strings', () => {
    expect(() => createSiteSdk({ domain: 'https://user:pass@example.test' })).toThrow(/credentials/);
    expect(() => createSiteSdk({ domain: 'https://example.test/?x=1' })).toThrow(/query parameters/);
  });

  it('rejects invalid optional configuration', () => {
    expect(() => createSiteSdk({ domain: 'https://example.test', userAgent: '   ' })).toThrow(/User agent/);
    expect(() => createSiteSdk({ domain: 'https://example.test', loginPath: 'https://other.test/login' })).toThrow(/relative path/);
    expect(() => createSiteSdk({ domain: 'https://example.test', filePath: 'file123' as any })).toThrow(/filePath must be a function/);
  });

  it('normalizes configuration without backend dependencies', () => {
    const sdk = createSiteSdk({ domain: 'https://example.test/' });
    expect(sdk.domain).toBe('https://example.test/');
    expect(sdk.userAgent).toContain('VidLoveSiteSDK');
  });
});
