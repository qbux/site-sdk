import { describe, expect, it } from 'vitest';
import { createSiteSdk } from '../src/index.js';
import { MockCaptcha, MockHttp, response } from './helpers.js';

describe('login', () => {
  const sdk = createSiteSdk({ domain: 'https://example.test' });

  const loginPage = `
    <form action="/login.php">
      <input type="hidden" name="foo" value="bar">
      <img src="data:image/png;base64,QUJD">
    </form>
  `;

  it('fetches login page, solves CAPTCHA, and accepts redirect login', async () => {
    const http = new MockHttp([
      response(200, loginPage),
      response(302, ''),
    ]);
    const captcha = new MockCaptcha('ABCDE');

    const result = await sdk.login(http, captcha, 'alice', 'secret');

    expect(result).toEqual({ success: true });
    expect(captcha.calls).toEqual(['QUJD']);
    expect(http.requests[1]).toMatchObject({
      method: 'POST',
      url: 'https://example.test/login.php',
    });
    const body = http.requests[1].body as URLSearchParams;
    expect(body.get('foo')).toBe('bar');
    expect(body.get('login')).toBe('alice');
    expect(body.get('password')).toBe('secret');
    expect(body.get('captcha')).toBe('ABCDE');
  });

  it('validates maxAttempts before network access', async () => {
    const http = new MockHttp();
    await expect(sdk.login(http, new MockCaptcha('ABCDE'), 'alice', 'secret', { maxAttempts: 0 })).rejects.toThrow(/maxAttempts/);
    expect(http.requests).toHaveLength(0);
  });

  it('validates client and credential input before network access', async () => {
    const http = new MockHttp();
    await expect(sdk.login(null as any, new MockCaptcha('ABCDE'), 'alice', 'secret')).rejects.toThrow(/SiteHttpClient/);
    await expect(sdk.login(http, new MockCaptcha('ABCDE'), 123 as any, 'secret')).resolves.toMatchObject({ error: 'INVALID_INPUT' });
    await expect(sdk.login(http, new MockCaptcha('ABCDE'), 'alice', 'secret', null as any)).rejects.toThrow(/options/);
    await expect(sdk.login(http, null as any, 'alice', 'secret')).rejects.toThrow(/CaptchaSolver/);
    expect(http.requests).toHaveLength(0);
  });

  it('can fetch an external CAPTCHA image', async () => {
    const page = '<form action="/login.php"><img src="/captcha.png"></form>';
    const http = new MockHttp([
      response(200, page),
      response(200, new Uint8Array([1, 2, 3]).buffer),
      response(303, ''),
    ]);
    const captcha = new MockCaptcha('XYZ12');

    await expect(sdk.login(http, captcha, 'alice', 'secret')).resolves.toEqual({ success: true });
    expect(captcha.calls[0]).toBe('AQID');
  });

  it('validates required credentials before network access', async () => {
    const http = new MockHttp();
    await expect(sdk.login(http, new MockCaptcha('ABCDE'), '', 'secret')).resolves.toMatchObject({
      success: false,
      error: 'INVALID_INPUT',
    });
    expect(http.requests).toHaveLength(0);
  });

});
