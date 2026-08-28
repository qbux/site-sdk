import { describe, expect, it } from 'vitest';
import { createSiteSdk } from '../src/index.js';
import { MockHttp, response } from './helpers.js';

describe('session validation', () => {
  const sdk = createSiteSdk({ domain: 'https://example.test' });

  it('accepts a page containing a known validation marker', async () => {
    const http = new MockHttp([response(200, '<main>Total pages: 4</main>')]);
    await expect(sdk.validateSession(http)).resolves.toBe(true);
  });

  it('rejects redirects and unknown pages', async () => {
    await expect(sdk.validateSession(new MockHttp([response(302, '')]))).resolves.toBe(false);
    await expect(sdk.validateSession(new MockHttp([response(200, '<main>login</main>')]))).resolves.toBe(false);
  });
});
