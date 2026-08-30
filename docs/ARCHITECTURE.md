# SDK Architecture

## Purpose

`@qbux/site-sdk` is the **site boundary** between the new Qbux backend and the external file site.

The package intentionally has a narrow responsibility:

```text
Backend
  │
  │ supplies domain + transport + CAPTCHA
  ▼
Site SDK
  │
  │ understands external site behavior
  ▼
External Site
```

## Dependency direction

```text
Host backend
     │
     ├── SiteHttpClient implementation
     ├── CaptchaSolver implementation
     └── SiteSdkConfig.domain
            │
            ▼
      @qbux/site-sdk
            │
            └── cheerio/parser logic
```

The SDK must never depend on the backend.

## Internal modules

```text
src/
├── index.ts      Public exports
├── site.ts       Site SDK orchestration and site behavior
├── parser.ts     Small generic parser helpers
├── file-id.ts    File identity normalization
└── types.ts      Public contracts/results
```

The current package is intentionally small. Do not introduce backend services here just to make the SDK look more layered.

## What belongs here

Website-specific knowledge:

- login form structure
- site form fields
- CAPTCHA image location
- validation-page markers
- file-page selectors
- download-link selectors
- site timer markup
- site-specific failure interpretation
- site-specific URL/path rules

## What does not belong here

Backend policy:

- job queues
- retry scheduling
- session pooling
- account rotation
- global rate limiting
- job leases
- database persistence
- storage/rclone
- download chunk scheduling
- worker concurrency

The SDK can report facts such as `SESSION_EXPIRED` or `FILE_RATE_LIMITED`, but the backend decides what to do next.

## Domain injection

The SDK does not embed the target production site origin.

The host must construct it with:

```ts
createSiteSdk({ domain: backendConfiguredDomain });
```

This makes the package reusable across environments and prevents an accidental hard-coded production target.

## Transport abstraction

The SDK asks the host for HTTP operations rather than shipping its own HTTP client. That allows the backend to decide:

- cookies
- proxy/Tor routing
- connection pooling
- DNS behavior
- TLS policy
- request instrumentation
- session binding
- retry policy outside site semantics

## CAPTCHA abstraction

The SDK only requests a solution through:

```ts
CaptchaSolver.solve(imageBase64)
```

The backend owns API keys, providers, quotas, timeouts, and provider selection.

## Error boundary

The SDK converts external-site observations into typed site results. It should not throw for ordinary website conditions such as a missing resource or an expired session.

Programmer/configuration errors may throw immediately because continuing would hide a broken host integration.

## Stability rule

When site markup changes, prefer a patch release with a regression fixture. Avoid expanding the public API unless the site behavior genuinely requires new host responsibilities.
