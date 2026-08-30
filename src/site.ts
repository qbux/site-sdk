import { load } from 'cheerio';

import type {
  CaptchaSolver,
  FileInfoResult,
  LoginResult,
  SiteFailureClassification,
  SiteHttpClient,
  SiteSdkConfig,
} from './types.js';
import { parseFileId } from './file-id.js';
import { parseTimer } from './parser.js';

const SDK_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0';
const LOGIN_PATH = '/login.php';
const VALIDATION_PATH = '/folder24';

const VALIDATION_MARKERS = ['Total pages:', 'navigat_pages'] as const;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function assertConfig(config: SiteSdkConfig): URL {
  if (!config || typeof config !== 'object') {
    throw new Error('SDK configuration is required');
  }
  if (typeof config.domain !== 'string' || !config.domain.trim()) {
    throw new Error('Site domain is required');
  }

  let url: URL;
  try {
    url = new URL(config.domain);
  } catch {
    throw new Error(`Invalid site domain: ${config.domain}`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Unsupported site domain protocol: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new Error('Site domain must not contain credentials');
  }
  if (url.search || url.hash) {
    throw new Error('Site domain must not contain query parameters or a fragment');
  }
  return url;
}

function baseUrlWithSlash(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function resolveUrl(pathOrUrl: string, baseUrl: string): string {
  return new URL(pathOrUrl, baseUrlWithSlash(baseUrl)).href;
}

function imageToBase64(src: string, baseUrl: string, http: SiteHttpClient): Promise<string | null> {
  if (src.startsWith('data:image')) {
    const separator = src.indexOf(',');
    return Promise.resolve(separator === -1 ? null : src.slice(separator + 1));
  }

  const imageUrl = resolveUrl(src, baseUrl);
  return http
    .get<ArrayBuffer>(imageUrl, {
      timeout: 10_000,
      responseType: 'arraybuffer',
    })
    .then((response) =>
      response.status === 200 ? Buffer.from(response.data).toString('base64') : null,
    )
    .catch(() => null);
}

function extractTitle(html: string): string | undefined {
  const $ = load(html);
  const title = $('main h1').first().text().trim();
  return title || undefined;
}

function extractRetryAfter(html: string): number | undefined {
  const $ = load(html);
  const timerText = $('div.timer_view_counter').first().text().trim();
  if (!timerText) return undefined;
  return parseTimer(timerText) ?? 86_400;
}

function extractExpectedBytes(html: string): number | undefined {
  const $ = load(html);
  const candidates: string[] = [];
  const selectors = [
    '.file_size',
    '.filesize',
    '.file-size',
    '.file_info .size',
    '[class*="file_size"]',
    '[class*="filesize"]',
    '[class*="file-size"]',
  ];

  for (const selector of selectors) {
    $(selector).each((_index: number, element: any) => {
      const text = $(element).text().replace(/\s+/g, ' ').trim();
      if (text) candidates.push(text);
    });
  }

  const fullText = `${candidates.join('\n')}\n${$('main').text().replace(/\s+/g, ' ')}`;
  const match = fullText.match(
    /(?:(?:file\s*)?size\s*[:\-]?\s*)?([0-9]+(?:[.,][0-9]+)?)\s*(B|KB|KiB|MB|MiB|GB|GiB|TB|TiB)\b/i,
  );
  if (!match) return undefined;

  const value = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return undefined;

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1000,
    KIB: 1024,
    MB: 1000 ** 2,
    MIB: 1024 ** 2,
    GB: 1000 ** 3,
    GIB: 1024 ** 3,
    TB: 1000 ** 4,
    TIB: 1024 ** 4,
  };

  const bytes = Math.round(value * (multipliers[match[2].toUpperCase()] ?? 0));
  return Number.isSafeInteger(bytes) && bytes > 0 ? bytes : undefined;
}


function parseCount(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/[^0-9]/g, '');
  if (!normalized) return undefined;
  const count = Number(normalized);
  return Number.isSafeInteger(count) && count >= 0 ? count : undefined;
}

function extractFileMetadata(html: string, baseUrl: string) {
  const $ = load(html);
  const userLink = $('.file_login').first();
  const uploaderUsername = userLink.text().replace(/\s+/g, ' ').trim()
    .replace(/\s+(?:Verified|\S*verified\S*)$/i, '').trim() || undefined;
  const uploaderVerified = $('.file_login img[title="Verified"], .file_login [title="Verified"]').length > 0
    ? true
    : undefined;

  const uploadedAtText = $('.file_time').first().text().replace(/\s+/g, ' ').trim();
  const uploadedAt = uploadedAtText || undefined;

  const stats = $('.file_info_param').first();
  const statValues = stats.find('.file_info_count').map((_i: number, el: any) =>
    $(el).text().replace(/\s+/g, ' ').trim(),
  ).get() as string[];

  const views = parseCount(statValues[0]);
  const downloads = parseCount(statValues[1]);

  const likeLink = $('.file_like').first();
  const dlikeLink = $('.file_dlike').first();
  const likes = parseCount(likeLink.text());
  const dislikes = parseCount(dlikeLink.text());

  const categoryLink = $('.file_info_eye').filter((_i: number, el: any) =>
    $(el).find('img.icon_folder').length > 0,
  ).find('a').first();
  const category = categoryLink.text().replace(/\s+/g, ' ').trim() || undefined;
  const categoryHref = categoryLink.attr('href');
  let categoryId: string | undefined;
  if (categoryHref) {
    const match = categoryHref.match(/(?:^|\/)folder([A-Za-z0-9_-]+)(?:$|[/?#])/i);
    categoryId = match?.[1] ?? undefined;
  }

  const tags = $('.file_info .btn_tag').map((_i: number, el: any) =>
    $(el).text().replace(/\s+/g, ' ').trim(),
  ).get() as string[];
  const cleanTags = tags.filter(Boolean);

  const thumbnailSrc = $('.file_img').first().attr('src');
  let thumbnailUrl: string | undefined;
  if (thumbnailSrc) {
    try {
      thumbnailUrl = new URL(thumbnailSrc, baseUrl).href;
    } catch {
      thumbnailUrl = undefined;
    }
  }

  return {
    ...(uploaderUsername ? { uploaderUsername } : {}),
    ...(uploaderVerified !== undefined ? { uploaderVerified } : {}),
    ...(uploadedAt ? { uploadedAt } : {}),
    ...(views !== undefined ? { views } : {}),
    ...(downloads !== undefined ? { downloads } : {}),
    ...(likes !== undefined ? { likes } : {}),
    ...(dislikes !== undefined ? { dislikes } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(category ? { category } : {}),
    ...(cleanTags.length ? { tags: cleanTags } : {}),
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
  };
}

function extractDownloadUrl(html: string): string | undefined {
  const $ = load(html);

  const fileLink = $('a.file_load').first().attr('href');
  if (fileLink) return fileLink;

  const video = $('video').first().attr('src');
  if (video) return video;

  let downloadUrl: string | undefined;
  $('a[href*="/load_files/"], a[href*="download"]').each((_index: number, element: any) => {
    if (downloadUrl) return;
    const href = $(element).attr('href');
    if (href) downloadUrl = href;
  });

  return downloadUrl;
}

function isSessionExpiredHtml(html: string): boolean {
  const $ = load(html);
  return $('form[action="/login.php"]').length > 0 || $('input[name="login"]').length > 0;
}


function validateRelativePath(value: string, name: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} must be a non-empty string`);
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) {
    throw new Error(`${name} must be a relative path`);
  }
}

function validateHttpClient(http: SiteHttpClient): void {
  if (!http || typeof http.get !== 'function' || typeof http.post !== 'function') {
    throw new Error('A valid SiteHttpClient is required');
  }
}

function validateCaptchaSolver(solver: CaptchaSolver): void {
  if (!solver || typeof solver.solve !== 'function') {
    throw new Error('A valid CaptchaSolver is required');
  }
}

function validateMaxAttempts(value: number | undefined): number {
  if (value === undefined) return 3;
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new Error('maxAttempts must be an integer between 1 and 10');
  }
  return value;
}

export class SiteSdk {
  readonly domain: string;
  readonly userAgent: string;

  constructor(private readonly config: SiteSdkConfig) {
    const domain = assertConfig(config);
    this.domain = baseUrlWithSlash(domain.href);
    if (config.userAgent !== undefined && (typeof config.userAgent !== 'string' || !config.userAgent.trim())) {
      throw new Error('User agent must not be empty');
    }
    this.userAgent = config.userAgent?.trim() || SDK_USER_AGENT;
    if (config.loginPath !== undefined) {
      validateRelativePath(config.loginPath, 'loginPath');
    }
    if (config.validationPath !== undefined) {
      validateRelativePath(config.validationPath, 'validationPath');
    }
    if (config.filePath !== undefined && typeof config.filePath !== 'function') {
      throw new Error('filePath must be a function');
    }
  }

  private loginPath(): string {
    return this.config.loginPath ?? LOGIN_PATH;
  }

  private validationPath(): string {
    return this.config.validationPath ?? VALIDATION_PATH;
  }

  private filePath(fileId: string): string {
    const value = this.config.filePath?.(fileId) ?? `file${fileId}`;
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error('filePath must return a non-empty string');
    }
    return value;
  }

  private headers(): Record<string, string> {
    return { 'User-Agent': this.userAgent };
  }

  async login(
    http: SiteHttpClient,
    captchaSolver: CaptchaSolver,
    username: string,
    password: string,
    options: { maxAttempts?: number } = {},
  ): Promise<LoginResult> {
    if (!options || typeof options !== 'object') {
      throw new Error('Login options must be an object');
    }
    if (typeof username !== 'string' || !username.trim()) {
      return { success: false, error: 'INVALID_INPUT', message: 'Username is required' };
    }
    if (typeof password !== 'string' || !password) {
      return { success: false, error: 'INVALID_INPUT', message: 'Password is required' };
    }

    validateHttpClient(http);
    validateCaptchaSolver(captchaSolver);
    const maxAttempts = validateMaxAttempts(options.maxAttempts);

    const loginPageUrl = this.domain;
    const loginActionFallback = resolveUrl(this.loginPath(), this.domain);
    let lastError = 'Login failed after all attempts';

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const pageResponse = await http.get<string>(loginPageUrl, {
          timeout: 15_000,
          headers: this.headers(),
          validateStatus: (status) => status >= 200 && status < 400,
        });

        if (pageResponse.status !== 200 || typeof pageResponse.data !== 'string') {
          lastError = `Login page returned HTTP ${pageResponse.status}`;
          continue;
        }

        const $ = load(pageResponse.data);
        const form = $('form[action="/login.php"]').first();
        if (!form.length) {
          lastError = 'Login form not found';
          continue;
        }

        const action = resolveUrl(form.attr('action') || loginActionFallback, this.domain);
        const hidden: Record<string, string> = {};
        form.find('input[type="hidden"]').each((_index: number, element: any) => {
          const name = $(element).attr('name');
          if (!name) return;
          hidden[name] = $(element).attr('value') || '';
        });

        const captchaSrc = form.find('img').first().attr('src');
        if (!captchaSrc) {
          lastError = 'CAPTCHA image source not found';
          continue;
        }

        const captchaBase64 = await imageToBase64(captchaSrc, this.domain, http);
        if (!captchaBase64) {
          lastError = 'CAPTCHA image could not be fetched';
          continue;
        }

        const captchaAnswer = await captchaSolver.solve(captchaBase64);
        if (!captchaAnswer?.trim()) {
          lastError = 'CAPTCHA solver returned no answer';
          continue;
        }

        const payload = {
          ...hidden,
          login: username,
          password,
          captcha: captchaAnswer.trim(),
          submit: 'Login',
        };

        const loginResponse = await http.post<string>(
          action,
          new URLSearchParams(payload),
          {
            timeout: 15_000,
            headers: {
              ...this.headers(),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400,
          },
        );

        if (loginResponse.status === 302 || loginResponse.status === 303) {
          return { success: true };
        }

        if (typeof loginResponse.data === 'string') {
          const responseText = loginResponse.data.toLowerCase();
          if (responseText.includes('captcha')) {
            lastError = 'Server rejected CAPTCHA';
            continue;
          }

          const response$ = load(loginResponse.data);
          if (!response$('form[action="/login.php"]').first().length) {
            return { success: true };
          }

          lastError = 'Login form still present after submission';
          continue;
        }

        lastError = `Unexpected login response HTTP ${loginResponse.status}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    if (lastError.toLowerCase().includes('captcha')) {
      return { success: false, error: 'CAPTCHA_FAILED', message: lastError };
    }

    return { success: false, error: 'LOGIN_FAILED', message: lastError };
  }

  async validateSession(http: SiteHttpClient): Promise<boolean> {
    validateHttpClient(http);
    try {
      const response = await http.get<string>(
        resolveUrl(this.validationPath(), this.domain),
        {
          timeout: 15_000,
          headers: this.headers(),
          maxRedirects: 0,
          validateStatus: (status) => status >= 200 && status < 400,
        },
      );

      if (response.status !== 200 || typeof response.data !== 'string') return false;
      return VALIDATION_MARKERS.some((marker) => response.data.includes(marker));
    } catch {
      return false;
    }
  }

  async fetchFileInfo(http: SiteHttpClient, input: string): Promise<FileInfoResult> {
    validateHttpClient(http);
    if (typeof input !== 'string') {
      return { success: false, fileId: null, error: 'INVALID_FILE_ID', message: 'File ID or URL must be a string' };
    }
    const fileId = parseFileId(input);
    if (!fileId) {
      return { success: false, fileId: null, error: 'INVALID_FILE_ID', message: 'Invalid file ID or URL' };
    }

    const pageUrl = resolveUrl(this.filePath(fileId), this.domain);

    try {
      const response = await http.get<string>(pageUrl, {
        timeout: 15_000,
        headers: this.headers(),
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      if (REDIRECT_STATUSES.has(response.status) || response.status === 401 || response.status === 403) {
        return { success: false, fileId, error: 'SESSION_EXPIRED' };
      }

      if (response.status !== 200 || typeof response.data !== 'string') {
        return {
          success: false,
          fileId,
          error: 'REQUEST_FAILED',
          message: `Unexpected site response HTTP ${response.status}`,
        };
      }

      const html = response.data;
      if (isSessionExpiredHtml(html)) {
        return { success: false, fileId, error: 'SESSION_EXPIRED' };
      }

      const retryAfter = extractRetryAfter(html);
      if (retryAfter !== undefined) {
        return {
          success: false,
          fileId,
          error: 'FILE_RATE_LIMITED',
          retryAfter,
          message: `File/resource rate limit; retry after ${retryAfter}s`,
        };
      }

      const rawDownloadUrl = extractDownloadUrl(html);
      if (!rawDownloadUrl) {
        return { success: false, fileId, error: 'NO_DOWNLOAD_LINK' };
      }

      let downloadUrl: string;
      try {
        downloadUrl = new URL(rawDownloadUrl, pageUrl).href;
      } catch (error) {
        return {
          success: false,
          fileId,
          error: 'REQUEST_FAILED',
          message: error instanceof Error ? error.message : 'Invalid download URL',
        };
      }

      return {
        success: true,
        fileId,
        title: extractTitle(html),
        downloadUrl,
        expectedBytes: extractExpectedBytes(html),
        ...extractFileMetadata(html, pageUrl),
      };
    } catch (error) {
      return {
        success: false,
        fileId,
        error: 'REQUEST_FAILED',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  classifyFileInfo(result: FileInfoResult): SiteFailureClassification | null {
    if (result.success) return null;

    switch (result.error) {
      case 'SESSION_EXPIRED':
        return { retryable: true, reason: 'SESSION_EXPIRED' };
      case 'FILE_RATE_LIMITED':
        return { retryable: true, reason: 'RATE_LIMITED' };
      case 'NO_DOWNLOAD_LINK':
        return { retryable: false, reason: 'NO_RESOURCE' };
      case 'INVALID_FILE_ID':
        return { retryable: false, reason: 'NOT_FOUND' };
      case 'REQUEST_FAILED':
        return { retryable: true, reason: 'REQUEST_FAILED' };
    }
  }
}

export function createSiteSdk(config: SiteSdkConfig): SiteSdk {
  return new SiteSdk(config);
}
