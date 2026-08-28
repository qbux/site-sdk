import { describe, expect, it } from 'vitest';
import { createSiteSdk } from '../src/index.js';
import { MockHttp, response } from './helpers.js';

describe('file info', () => {
  const sdk = createSiteSdk({ domain: 'https://example.test' });

  it('extracts title, resource URL, and expected bytes', async () => {
    const html = `
      <main>
        <h1>Example File</h1>
        <div class="file_size">12.5 MiB</div>
        <a class="file_load" href="/load_files/abc">Download</a>
      </main>
    `;
    const http = new MockHttp([response(200, html)]);
    const result = await sdk.fetchFileInfo(http, 'file123');

    expect(result).toEqual({
      success: true,
      fileId: '123',
      title: 'Example File',
      downloadUrl: 'https://example.test/load_files/abc',
      expectedBytes: 13_107_200,
    });
  });

  it('detects an expired authenticated session from redirects', async () => {
    const result = await sdk.fetchFileInfo(new MockHttp([response(302, '')]), '123');
    expect(result).toMatchObject({ success: false, fileId: '123', error: 'SESSION_EXPIRED' });
  });

  it('detects an expired authenticated session from an HTTP 200 login page', async () => {
    const html = '<form action="/login.php"><input name="login"></form>';
    const result = await sdk.fetchFileInfo(new MockHttp([response(200, html)]), '123');
    expect(result).toMatchObject({ success: false, fileId: '123', error: 'SESSION_EXPIRED' });
  });

  it('detects site rate limiting and preserves the retry timer', async () => {
    const html = '<div class="timer_view_counter">01:02</div>';
    const result = await sdk.fetchFileInfo(new MockHttp([response(200, html)]), '123');
    expect(result).toMatchObject({
      success: false,
      fileId: '123',
      error: 'FILE_RATE_LIMITED',
      retryAfter: 62,
    });
  });

  it('reports missing resources cleanly', async () => {
    const result = await sdk.fetchFileInfo(new MockHttp([response(200, '<main><h1>x</h1></main>')]), '123');
    expect(result).toMatchObject({ success: false, fileId: '123', error: 'NO_DOWNLOAD_LINK' });
  });
});
