# Errors and Validation

The SDK intentionally distinguishes **invalid host integration** from **ordinary site failures**.

## Configuration/programming errors

These throw immediately because continuing would hide a broken integration:

- missing SDK configuration
- missing domain
- invalid domain URL
- unsupported domain protocol
- credentials embedded in domain
- domain query string or fragment
- blank explicit user agent
- invalid relative login/validation path
- invalid `filePath` callback
- invalid HTTP client adapter
- invalid CAPTCHA solver adapter
- invalid login options
- `maxAttempts` outside 1–10 or non-integer

## Login result errors

```text
INVALID_INPUT
LOGIN_FAILED
CAPTCHA_FAILED
REQUEST_FAILED
```

### `INVALID_INPUT`

Credentials or other call arguments are invalid.

### `LOGIN_FAILED`

The site did not accept authentication after the configured attempts.

### `CAPTCHA_FAILED`

The CAPTCHA image could not be obtained/solved or the site rejected the CAPTCHA flow.

### `REQUEST_FAILED`

The transport layer or unexpected HTTP behavior prevented successful login.

## File result errors

```text
INVALID_FILE_ID
SESSION_EXPIRED
FILE_RATE_LIMITED
NO_DOWNLOAD_LINK
REQUEST_FAILED
```

## Backend classification

`classifyFileInfo()` maps file failures to:

```text
SESSION_EXPIRED
RATE_LIMITED
NOT_FOUND
NO_RESOURCE
REQUEST_FAILED
```

The SDK does not decide the backend action.

## Failure handling rule

The backend should treat SDK results as **facts**, then apply its own policy.

Example:

```text
SDK:
  SESSION_EXPIRED

Backend:
  invalidate/rotate session
  retry job
```

not:

```text
SDK:
  SESSION_EXPIRED
  directly mutate database
  directly create a new session
  sleep for 30 seconds
```

## Messages

Human-readable `message` fields are diagnostic information. Backend control flow should use the typed `error` discriminant, not string matching on messages.
