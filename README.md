# @qbux/site-sdk

Standalone TypeScript/npm SDK for the site-specific integration layer used by the qbux backend rewrite.

The SDK owns **only website knowledge**. It does not own jobs, queues, workers, databases, storage, account pools, rate limiting policy, or backend configuration.

## Scope

The SDK provides:

- authenticated login flow
- hidden login form field handling
- CAPTCHA image retrieval and solver integration
- authenticated-session validation
- file ID / URL normalization
- file-page metadata extraction
- download-resource extraction
- expected file-size parsing
- site-specific failure classification
- runtime input validation

## Non-goals

The SDK does **not**:

- create jobs or batches
- talk to PostgreSQL
- manage worker leases
- manage session pools
- implement account rotation
- implement rate limiting policy
- download file bytes
- manage local files or rclone
- open SSE/WebSocket connections
- contain production credentials

Those concerns belong to the backend.

## Installation

### From npm

```bash
npm install @qbux/site-sdk
```

### From a local package/tarball

```bash
npm install ./qbux-site-sdk-0.1.5.tgz
```

Node.js 20 or newer is required.

## Quick start

The host backend **must provide the site domain at runtime**:

```ts
import { createSiteSdk } from '@qbux/site-sdk';

const sdk = createSiteSdk({
  domain: process.env.SITE_DOMAIN!,
});
```

There is **no built-in production domain**. The SDK will reject an omitted, empty, malformed, credential-bearing, query-bearing, or fragment-bearing domain.

The SDK is deliberately unaware of where the domain came from. The backend owns the configuration source and passes the validated origin into the SDK.

## HTTP and CAPTCHA adapters

The SDK does not depend on Axios, Undici, Fetch, a proxy implementation, a cookie jar, or a CAPTCHA vendor. The host supplies two small adapters:

```ts
interface SiteHttpClient {
  get<T = unknown>(url: string, options?: SiteHttpRequestOptions): Promise<SiteHttpResponse<T>>;
  post<T = unknown>(
    url: string,
    body: unknown,
    options?: SiteHttpRequestOptions,
  ): Promise<SiteHttpResponse<T>>;
}

interface CaptchaSolver {
  solve(imageBase64: string): Promise<string | null>;
}
```

This keeps transport credentials, proxy/session handling, and CAPTCHA provider configuration outside the SDK.

## Public API

```ts
createSiteSdk(config)
sdk.login(http, captcha, username, password, options?)
sdk.validateSession(http)
sdk.fetchFileInfo(http, fileIdOrUrl)
sdk.classifyFileInfo(result)
parseFileId(input)
requireFileId(input)
parseTimer(input)
```

See [docs/API.md](docs/API.md) for the full reference.

## Runtime validation

Validation happens before network access wherever possible.

The SDK validates:

- configuration object
- required `domain`
- URL protocol and URL structure
- embedded URL credentials
- query strings/fragments in `domain`
- optional relative paths
- user-agent value
- `filePath` callback
- HTTP adapter shape
- CAPTCHA adapter shape
- login credentials
- login options
- `maxAttempts`
- file IDs / file URLs

The SDK returns typed failures for normal site-operation failures and throws configuration/programming errors for invalid adapter/configuration arguments.

## Site behavior

The current adapter recognizes these behaviors:

- login page + hidden fields + image CAPTCHA
- redirect-based successful login
- login responses that return a non-login page
- authenticated validation markers
- expired sessions indicated by redirects, auth statuses, or login HTML
- site rate-limit timer pages
- download links in known file-page markup
- expected byte sizes using decimal or binary units

See [docs/SITE-CONTRACT.md](docs/SITE-CONTRACT.md) for the current site contract and expected HTML patterns.

## Error model

### Login

```ts
'INVALID_INPUT'
'LOGIN_FAILED'
'CAPTCHA_FAILED'
'REQUEST_FAILED'
```

### File information

```ts
'INVALID_FILE_ID'
'SESSION_EXPIRED'
'FILE_RATE_LIMITED'
'NO_DOWNLOAD_LINK'
'REQUEST_FAILED'
```

The backend can pass a `FileInfoResult` into `classifyFileInfo()` to translate the site-specific result into a small backend-neutral failure classification.

## Testing

Install dependencies and run the full check:

```bash
npm install
npm run check
```

`check` runs:

```text
npm run build
npm test
```

Useful commands:

```bash
npm test
npm run test:watch
npm run build
npm run pack:dry
```

Tests are intentionally small and contract-focused. They cover configuration/domain validation, file-ID parsing, parser behavior, file metadata extraction, login/CAPTCHA behavior, session validation, and failure classification.

See [docs/TESTING.md](docs/TESTING.md).

## Development principles

1. No backend imports.
2. No database imports.
3. No worker imports.
4. No production domain constants.
5. No provider-specific CAPTCHA implementation in core SDK code.
6. Keep website HTML/API knowledge inside this package.
7. Prefer fixture-based regression tests when the site's markup changes.
8. Validate inputs before making external requests.

## Versioning

The package follows semantic versioning. Site markup/parser fixes that preserve the public API should normally be patch releases. Public API/type changes require a minor or major release depending on compatibility.

## Documentation

- [API reference](docs/API.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Site contract](docs/SITE-CONTRACT.md)
- [Integration guide](docs/INTEGRATION.md)
- [Testing guide](docs/TESTING.md)
- [Errors and validation](docs/ERRORS.md)
- [Release and packaging](docs/RELEASE.md)
- [Changelog](CHANGELOG.md)
