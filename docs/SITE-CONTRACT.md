# Site Contract

This document records the site-specific behavior encoded by the current SDK implementation. It is the first place to update when the external site changes.

## 1. Site origin

The host provides the origin at runtime. The SDK does not contain a production fallback.

The origin must be an `http:` or `https:` URL with no credentials, query string, or fragment.

## 2. Login page

The login page is expected to contain a form matching the configured/default login path. The current default login path is `/login.php`.

The SDK:

- collects hidden inputs
- locates the first form image as the CAPTCHA image
- submits the preserved hidden fields plus credentials and the CAPTCHA answer

The submitted fields currently include:

```text
login
password
captcha
submit=Login
```

## 3. CAPTCHA image

The CAPTCHA source may be:

- a `data:image/...` URL, or
- a relative/absolute image URL that the supplied HTTP client can fetch

The SDK converts an externally fetched binary image to base64 before passing it to `CaptchaSolver`.

## 4. Login success

A 302 or 303 response is treated as successful authentication.

A string response that no longer contains the login form is also treated as an alternate successful outcome.

## 5. Session validation

The current validation path default is `/folder24`.

A 200 response must contain one of the known authenticated markers:

```text
Total pages:
navigat_pages
```

Redirects, non-200 responses, and network failures are treated as an invalid session.

## 6. File identifiers

Accepted examples include:

```text
123
file123
https://site.example/file123
https://site.example/path/file123/
https://site.example/file123?download=1
```

The normalized result is the numeric identifier.

## 7. File page

The current default file path is:

```text
file{fileId}
```

The host may provide a custom `filePath` callback when needed.

## 8. Title extraction

The current selector is:

```css
main h1
```

The first non-empty trimmed text is returned as `title`.

## 9. Download resource extraction

The preferred selector is:

```css
a.file_load
```

Fallbacks include:

```css
video[src]
a[href*="/load_files/"]
a[href*="download"]
```

The SDK resolves relative URLs against the file page URL.

## 10. Expected file size

Known selectors include:

```css
.file_size
.filesize
.file-size
.file_info .size
[class*="file_size"]
[class*="filesize"]
[class*="file-size"]
```

The parser understands byte units:

```text
B KB KiB MB MiB GB GiB TB TiB
```

Examples:

```text
12.5 MiB → 13107200 bytes
1.5 GB  → 1500000000 bytes
```

Both explicit labels and bare size values inside the selected file-size regions are supported.

## 11. Session expiration

The SDK recognizes session expiry from:

- 301/302/303/307/308 redirects on file requests
- HTTP 401
- HTTP 403
- file HTML containing the login form

## 12. Rate limiting

The SDK recognizes a file-rate-limit timer from:

```css
div.timer_view_counter
```

`MM:SS` and `HH:MM:SS` values are converted to seconds. An unparseable timer falls back to 86,400 seconds for the site result.

## 13. Missing download resource

If no download URL is found, the SDK returns:

```text
NO_DOWNLOAD_LINK
```

The backend may decide whether this is terminal or requires metadata/resource refresh.

## 14. Change protocol

When the site changes:

1. Capture the smallest representative HTML response.
2. Add or update a fixture.
3. Add a failing regression test.
4. Fix the parser.
5. Run the full suite.
6. Review whether the public result types still accurately describe behavior.
7. Publish a patch release when the public API remains compatible.
