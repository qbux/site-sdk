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

  it('extracts extended site metadata from the file page', async () => {
    const html = `
      <main>
        <h1>Tittle</h1>
        <div class="file_params">
          <div class="file_user">
            <a class="file_login" href="id25409">Username of the user that uploaded the video
              <img title="Verified" src="check.png">
            </a>
            <div class="file_time">Today at 08:42:01</div>
            <div class="file_size">75.78 Mb</div>
          </div>
          <div class="file_info_param">
            <div class="file_info_eye"><div class="file_info_count">51</div></div>
            <div class="file_info_eye"><div class="file_info_count">0</div></div>
            <div class="file_info_eye"><a href="folder24"><img class="icon_folder">Free category</a></div>
          </div>
          <div class="tags_block">Tags</div>
          <div class="file_info">
            <a class="btn_tag" href="obmen/tag.php?tag=tag1">tag1</a>
            <a class="btn_tag" href="obmen/tag.php?tag= tag2"> tag2</a>
          </div>
          <div class="file_param">
            <div class="file_likes">
              <a class="file_like" href="/file125131?like"><img class="icon_like">1</a>
              <a class="file_dlike" href="/file125131?dlike"><img class="icon_dlike">2</a>
            </div>
          </div>
        </div>
        <img class="file_img" src="/files/preview.jpg">
        <a class="file_load" href="/load_files/abc">Download</a>
      </main>
    `;
    const result = await sdk.fetchFileInfo(new MockHttp([response(200, html)]), 'file125131');

    expect(result).toMatchObject({
      success: true,
      fileId: '125131',
      title: 'Tittle',
      uploaderUsername: 'Username of the user that uploaded the video',
      uploaderVerified: true,
      uploadedAt: 'Today at 08:42:01',
      views: 51,
      downloads: 0,
      likes: 1,
      dislikes: 2,
      categoryId: '24',
      category: 'Free category',
      tags: ['tag1', 'tag2'],
      thumbnailUrl: 'https://example.test/files/preview.jpg',
    });
  });

  it('does not emit undefined metadata fields', async () => {
    const html = `
      <main>
        <h1>Example File</h1>
        <a class="file_load" href="/load_files/abc">Download</a>
      </main>
    `;
    const result = await sdk.fetchFileInfo(new MockHttp([response(200, html)]), '123');

    expect(result).toEqual({
      success: true,
      fileId: '123',
      title: 'Example File',
      downloadUrl: 'https://example.test/load_files/abc',
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
