# Release and Packaging

## Local validation

Before release:

```bash
npm ci
npm run check
npm pack --dry-run
```

The package must contain everything needed for development from the source bundle and must expose runtime files through the package export map.

## Runtime package

The published package exposes:

```text
.
  types → dist/index.d.ts
  import → dist/index.js
```

The package currently includes source/tests/configuration files in the development bundle as well, which makes the provided source archive self-testable.

## Versioning

Patch release:

- parser bug fix
- selector adjustment
- validation tightening that does not break valid callers
- additional regression tests

Minor release:

- backward-compatible public API/type additions

Major release:

- breaking public API/type changes

## Site-change release process

```text
site change
    ↓
fixture
    ↓
regression test
    ↓
parser fix
    ↓
npm run check
    ↓
npm pack --dry-run
    ↓
version bump
    ↓
publish
```

## Domain rule

Never add the production site domain to source code, tests that are intended to hit production, or package metadata.

Tests should use neutral domains such as `https://example.test`.

The backend supplies the real domain at runtime.
