# @qbux/site-sdk

Standalone site-specific flows for authenticated file hosting sites. This package owns site protocol details; the host service supplies configuration, an HTTP client with cookie/proxy handling, and a CAPTCHA solver.

## Included flows

- `SiteSdk.login(http, captchaSolver, username, password, options?)`
- `SiteSdk.validateSession(http, options?)`
- `SiteSdk.fetchFileInfo(http, fileIdOrUrl, options?)`
- `SiteSdk.classifyFileInfo(result)`
- `parseFileId`, `requireFileId`, and `parseTimer`

The SDK does not own the database, job queue, proxy/session persistence, disk downloads, or worker lifecycle. Those remain in the host service. CAPTCHA solving is injected through the `CaptchaSolver` interface; provider credentials and API calls stay outside this package.

`SiteHttpRequestOptions.signal` and the optional `signal` operation options allow callers to cancel in-flight HTTP requests. Adapters should map the signal to their transport's cancellation mechanism.

## Build and test

```sh
npm install
npm run check
```
