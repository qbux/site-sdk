# Backend Integration Guide

This document describes how the future VidLove backend should consume the SDK. The SDK itself does not implement these backend services.

## Responsibility split

```text
Backend owns:
  configuration
  account credentials
  cookies/session transport
  proxy/Tor routing
  CAPTCHA provider
  session pool
  rate limiting
  jobs
  retries
  storage

SDK owns:
  external site semantics
  login form knowledge
  site validation knowledge
  file-page parsing
  resource extraction
  site-specific classification
```

## Construction

```ts
const sdk = createSiteSdk({
  domain: config.siteDomain,
});
```

The backend should obtain `siteDomain` from its own configuration system. Do not fork the SDK to add a production domain.

## HTTP adapter

The backend should wrap its existing HTTP stack in `SiteHttpClient`.

A transport implementation is responsible for:

- cookies/session state
- proxy routing
- connection reuse
- request logging/metrics
- TLS/network settings
- timeout enforcement

The SDK only consumes the resulting interface.

## CAPTCHA adapter

The backend should wrap its configured CAPTCHA provider:

```ts
const captcha: CaptchaSolver = {
  solve: async (imageBase64) => provider.solve(imageBase64),
};
```

Provider credentials and API calls stay outside the SDK.

## Login flow

Recommended backend flow:

```text
SessionPool
   ↓
acquire session
   ↓
create SiteHttpClient bound to that session
   ↓
SDK.login(http, captcha, username, password)
   ↓
store session result
```

The SDK returns the site-specific outcome; the session pool decides whether to retain, rotate, cooldown, or invalidate the session.

## Session validation

```ts
const valid = await sdk.validateSession(http);
```

The backend should treat `false` as a session-health fact, not as an automatic account failure.

## File metadata

```ts
const result = await sdk.fetchFileInfo(http, input);
```

On success the backend can persist:

- normalized file ID
- title
- download URL/resource
- expected size

The backend decides how and where those values are stored.

## Failure mapping

```ts
const classification = sdk.classifyFileInfo(result);
```

Use the classification as an input to backend retry/session/resource policies.

Example:

```text
SESSION_EXPIRED
  → session pool rotates session

FILE_RATE_LIMITED
  → backend reschedules after retryAfter

NO_DOWNLOAD_LINK
  → backend resource/metadata policy decides next action

REQUEST_FAILED
  → backend transport/retry policy decides next action
```

The SDK must not enqueue, sleep for long periods, or retry according to backend policy.

## Domain environments

For development/staging/production:

```text
Backend config
    ↓
SITE_DOMAIN
    ↓
createSiteSdk({ domain })
```

The same SDK package is used in every environment.

## Multiple sites later

When another external site is added, prefer another SDK package or another clearly isolated site adapter package. Do not turn this package into a generic multi-site backend framework unless there is a concrete requirement.
