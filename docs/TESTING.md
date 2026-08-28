# Testing Guide

## Goal

The SDK test suite is a small set of high-value contract tests. It protects the part of the system most likely to break when the external site changes: parsing and site protocol behavior.

## Commands

```bash
npm install
npm run check
```

Or individually:

```bash
npm run build
npm test
npm run test:watch
```

## Test groups

### Configuration

Verifies:

- domain is required
- malformed domains are rejected
- unsupported protocols are rejected
- credentials in domain are rejected
- query strings/fragments are rejected
- invalid optional config is rejected
- normalized domain is returned correctly

### File ID

Verifies:

- numeric IDs
- `file123` IDs
- URL forms
- query/fragment stripping
- trailing slash handling
- URL decoding
- invalid input

### File info

Verifies:

- title extraction
- download resource extraction
- expected bytes
- session expiry detection
- login-page detection
- rate-limit timers
- missing resources

### Login

Verifies:

- login page loading
- hidden-field preservation
- CAPTCHA extraction
- CAPTCHA solving
- redirect-based success
- external CAPTCHA image fetching
- invalid options
- invalid credentials
- adapter validation

### Session

Verifies known validation markers and invalid/redirect responses.

## Test style

Use deterministic mocks for transport and CAPTCHA. Avoid real network access in unit/contract tests.

A typical test should provide:

```text
fixture HTML
   ↓
MockHttp
   ↓
SDK method
   ↓
assert typed result
```

## Regression fixtures

When a site change breaks parsing:

1. Save a minimal representative response.
2. Add the regression case to the narrowest test file.
3. Assert the real expected output.
4. Fix parser/selector behavior.
5. Run `npm run check`.

Do not weaken assertions simply to make a test pass.

## What not to test here

Do not duplicate backend tests for:

- PostgreSQL
- queues
- leases
- workers
- session pooling
- rate-limit scheduling
- storage/rclone
- frontend realtime

Those belong to the backend test suite.

## CI recommendation

CI should run:

```bash
npm ci
npm run check
npm pack --dry-run
```

The package should fail CI if TypeScript compilation or tests fail.
