import { load } from 'cheerio';
import { parseFileId } from './file-id.js';
import { parseTimer } from './parser.js';
const SDK_USER_AGENT = 'VidLoveSiteSDK/0.1';
const LOGIN_PATH = '/login.php';
const VALIDATION_PATH = '/folder24';
const VALIDATION_MARKERS = ['Total pages:', 'navigat_pages'];
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
function assertConfig(config) {
    if (!config || typeof config !== 'object') {
        throw new Error('SDK configuration is required');
    }
    if (typeof config.domain !== 'string' || !config.domain.trim()) {
        throw new Error('Site domain is required');
    }
    let url;
    try {
        url = new URL(config.domain);
    }
    catch {
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
function baseUrlWithSlash(baseUrl) {
    return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}
function resolveUrl(pathOrUrl, baseUrl) {
    return new URL(pathOrUrl, baseUrlWithSlash(baseUrl)).href;
}
function imageToBase64(src, baseUrl, http) {
    if (src.startsWith('data:image')) {
        const separator = src.indexOf(',');
        return Promise.resolve(separator === -1 ? null : src.slice(separator + 1));
    }
    const imageUrl = resolveUrl(src, baseUrl);
    return http
        .get(imageUrl, {
        timeout: 10_000,
        responseType: 'arraybuffer',
    })
        .then((response) => response.status === 200 ? Buffer.from(response.data).toString('base64') : null)
        .catch(() => null);
}
function extractTitle(html) {
    const $ = load(html);
    const title = $('main h1').first().text().trim();
    return title || undefined;
}
function extractRetryAfter(html) {
    const $ = load(html);
    const timerText = $('div.timer_view_counter').first().text().trim();
    if (!timerText)
        return undefined;
    return parseTimer(timerText) ?? 86_400;
}
function extractExpectedBytes(html) {
    const $ = load(html);
    const candidates = [];
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
        $(selector).each((_index, element) => {
            const text = $(element).text().replace(/\s+/g, ' ').trim();
            if (text)
                candidates.push(text);
        });
    }
    const fullText = `${candidates.join('\n')}\n${$('main').text().replace(/\s+/g, ' ')}`;
    const match = fullText.match(/(?:(?:file\s*)?size\s*[:\-]?\s*)?([0-9]+(?:[.,][0-9]+)?)\s*(B|KB|KiB|MB|MiB|GB|GiB|TB|TiB)\b/i);
    if (!match)
        return undefined;
    const value = Number(match[1].replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0)
        return undefined;
    const multipliers = {
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
function extractDownloadUrl(html) {
    const $ = load(html);
    const fileLink = $('a.file_load').first().attr('href');
    if (fileLink)
        return fileLink;
    const video = $('video').first().attr('src');
    if (video)
        return video;
    let downloadUrl;
    $('a[href*="/load_files/"], a[href*="download"]').each((_index, element) => {
        if (downloadUrl)
            return;
        const href = $(element).attr('href');
        if (href)
            downloadUrl = href;
    });
    return downloadUrl;
}
function isSessionExpiredHtml(html) {
    const $ = load(html);
    return $('form[action="/login.php"]').length > 0 || $('input[name="login"]').length > 0;
}
function validateRelativePath(value, name) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${name} must be a non-empty string`);
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) {
        throw new Error(`${name} must be a relative path`);
    }
}
function validateHttpClient(http) {
    if (!http || typeof http.get !== 'function' || typeof http.post !== 'function') {
        throw new Error('A valid SiteHttpClient is required');
    }
}
function validateCaptchaSolver(solver) {
    if (!solver || typeof solver.solve !== 'function') {
        throw new Error('A valid CaptchaSolver is required');
    }
}
function validateMaxAttempts(value) {
    if (value === undefined)
        return 3;
    if (!Number.isInteger(value) || value < 1 || value > 10) {
        throw new Error('maxAttempts must be an integer between 1 and 10');
    }
    return value;
}
export class SiteSdk {
    config;
    domain;
    userAgent;
    constructor(config) {
        this.config = config;
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
    loginPath() {
        return this.config.loginPath ?? LOGIN_PATH;
    }
    validationPath() {
        return this.config.validationPath ?? VALIDATION_PATH;
    }
    filePath(fileId) {
        const value = this.config.filePath?.(fileId) ?? `file${fileId}`;
        if (typeof value !== 'string' || !value.trim()) {
            throw new Error('filePath must return a non-empty string');
        }
        return value;
    }
    headers() {
        return { 'User-Agent': this.userAgent };
    }
    async login(http, captchaSolver, username, password, options = {}) {
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
                const pageResponse = await http.get(loginPageUrl, {
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
                const hidden = {};
                form.find('input[type="hidden"]').each((_index, element) => {
                    const name = $(element).attr('name');
                    if (!name)
                        return;
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
                const loginResponse = await http.post(action, new URLSearchParams(payload), {
                    timeout: 15_000,
                    headers: {
                        ...this.headers(),
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    maxRedirects: 0,
                    validateStatus: (status) => status >= 200 && status < 400,
                });
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
            }
            catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
            }
        }
        if (lastError.toLowerCase().includes('captcha')) {
            return { success: false, error: 'CAPTCHA_FAILED', message: lastError };
        }
        return { success: false, error: 'LOGIN_FAILED', message: lastError };
    }
    async validateSession(http) {
        validateHttpClient(http);
        try {
            const response = await http.get(resolveUrl(this.validationPath(), this.domain), {
                timeout: 15_000,
                headers: this.headers(),
                maxRedirects: 0,
                validateStatus: (status) => status >= 200 && status < 400,
            });
            if (response.status !== 200 || typeof response.data !== 'string')
                return false;
            return VALIDATION_MARKERS.some((marker) => response.data.includes(marker));
        }
        catch {
            return false;
        }
    }
    async fetchFileInfo(http, input) {
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
            const response = await http.get(pageUrl, {
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
            let downloadUrl;
            try {
                downloadUrl = new URL(rawDownloadUrl, pageUrl).href;
            }
            catch (error) {
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
            };
        }
        catch (error) {
            return {
                success: false,
                fileId,
                error: 'REQUEST_FAILED',
                message: error instanceof Error ? error.message : String(error),
            };
        }
    }
    classifyFileInfo(result) {
        if (result.success)
            return null;
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
export function createSiteSdk(config) {
    return new SiteSdk(config);
}
//# sourceMappingURL=site.js.map