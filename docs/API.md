# API Reference

Package: `@vidlove/site-sdk`

## Entry point

```ts
import {
  SiteSdk,
  createSiteSdk,
  parseFileId,
  requireFileId,
  parseTimer,
} from '@vidlove/site-sdk';
```

## `createSiteSdk`

```ts
function createSiteSdk(config: SiteSdkConfig): SiteSdk;
```

Creates the site SDK.

### Required configuration

```ts
interface SiteSdkConfig {
  domain: string;
  userAgent?: string;
  loginPath?: string;
  validationPath?: string;
  filePath?: (fileId: string) => string;
}
```

`domain` is mandatory. There is no SDK default.

### Domain rules

`domain` must be:

- a valid URL
- `http:` or `https:`
- free of username/password credentials
- free of a query string
- free of a fragment

The SDK normalizes the stored domain to end with `/`.

### Path rules

`loginPath` and `validationPath` must be relative paths. Absolute URLs and protocol-relative URLs are rejected.

`filePath` must be a function when supplied and must return a non-empty string.

### User agent

If omitted, the SDK uses its package-level SDK user agent. An explicitly supplied blank user agent is rejected.

## `SiteSdk.login`

```ts
login(
  http: SiteHttpClient,
  captchaSolver: CaptchaSolver,
  username: string,
  password: string,
  options?: { maxAttempts?: number },
): Promise<LoginResult>;
```

### Behavior

1. Fetches the configured site origin.
2. Finds the login form.
3. Collects hidden input fields.
4. Locates the CAPTCHA image.
5. Fetches/decodes the CAPTCHA image.
6. Calls the host-provided CAPTCHA solver.
7. Posts the form data.
8. Treats a 302/303 response as a successful login.
9. Recognizes a non-login page as an alternate success response.
10. Retries up to `maxAttempts`.

`maxAttempts` defaults to 3 and must be an integer from 1 through 10.

### Return type

```ts
interface LoginSuccess {
  success: true;
}

type LoginError =
  | 'INVALID_INPUT'
  | 'LOGIN_FAILED'
  | 'CAPTCHA_FAILED'
  | 'REQUEST_FAILED';

interface LoginFailure {
  success: false;
  error: LoginError;
  message: string;
}

type LoginResult = LoginSuccess | LoginFailure;
```

Invalid adapter/options are programmer/configuration errors and throw. Invalid username/password values are represented as `INVALID_INPUT` results.

## `SiteSdk.validateSession`

```ts
validateSession(http: SiteHttpClient): Promise<boolean>;
```

Performs the configured validation request without following redirects and recognizes the site's known authenticated-page markers.

Network failures and unexpected responses return `false`; they are intentionally not thrown as site-session state.

## `SiteSdk.fetchFileInfo`

```ts
fetchFileInfo(
  http: SiteHttpClient,
  input: string,
): Promise<FileInfoResult>;
```

Accepts either a numeric/file-prefixed identifier or a URL containing one.

Returns normalized metadata and a resolved download URL on success.

### Success

```ts
interface FileMetadata {
  uploaderUsername?: string;
  uploaderVerified?: boolean;
  uploadedAt?: string;
  views?: number;
  downloads?: number;
  likes?: number;
  dislikes?: number;
  categoryId?: string;
  category?: string;
  tags?: string[];
  thumbnailUrl?: string;
}

interface FileInfoSuccess extends FileMetadata {
  success: true;
  fileId: string;
  title?: string;
  downloadUrl: string;
  expectedBytes?: number;
}
```

### Failure

```ts
type FileInfoError =
  | 'INVALID_FILE_ID'
  | 'SESSION_EXPIRED'
  | 'FILE_RATE_LIMITED'
  | 'NO_DOWNLOAD_LINK'
  | 'REQUEST_FAILED';

interface FileInfoFailure {
  success: false;
  fileId: string | null;
  error: FileInfoError;
  retryAfter?: number;
  message?: string;
}
```

## `SiteSdk.classifyFileInfo`

```ts
classifyFileInfo(result: FileInfoResult): SiteFailureClassification | null;
```

Maps site-specific file-info failures to a compact classification for the host backend.

```ts
interface SiteFailureClassification {
  retryable: boolean;
  reason:
    | 'SESSION_EXPIRED'
    | 'RATE_LIMITED'
    | 'NOT_FOUND'
    | 'NO_RESOURCE'
    | 'REQUEST_FAILED';
}
```

A successful result returns `null`.

## `parseFileId`

```ts
parseFileId(input: string): string | null;
```

Accepts values such as:

```text
123
file123
https://site.example/file123
https://site.example/path/file123/
file123?download=1
```

Returns only the numeric identifier.

## `requireFileId`

```ts
requireFileId(input: string): string;
```

Same normalization as `parseFileId`, but throws when no valid ID can be derived.

## `parseTimer`

```ts
parseTimer(input: string): number | null;
```

Parses `MM:SS` and `HH:MM:SS` into seconds.

## Adapter interfaces

### `SiteHttpClient`

```ts
interface SiteHttpClient {
  get<T = unknown>(url: string, options?: SiteHttpRequestOptions): Promise<SiteHttpResponse<T>>;
  post<T = unknown>(
    url: string,
    body: unknown,
    options?: SiteHttpRequestOptions,
  ): Promise<SiteHttpResponse<T>>;
}
```

### `SiteHttpRequestOptions`

```ts
interface SiteHttpRequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  maxRedirects?: number;
  responseType?: 'arraybuffer' | 'text';
  validateStatus?: (status: number) => boolean;
}
```

### `SiteHttpResponse`

```ts
interface SiteHttpResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string | string[] | undefined>;
  url?: string;
}
```

### `CaptchaSolver`

```ts
interface CaptchaSolver {
  solve(imageBase64: string): Promise<string | null>;
}
```
