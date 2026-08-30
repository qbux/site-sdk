## 0.1.6

- Extended `fetchFileInfo()` with uploader, upload-time, views, downloads, likes, dislikes, category, tags, and thumbnail metadata.
- Added public `FileMetadata` type export.
- Added regression coverage for the supplied file-page HTML contract.

# Changelog

## 0.1.5

Documentation release.

- Added complete SDK API reference.
- Added architecture and dependency-boundary documentation.
- Added site behavior/HTML contract documentation.
- Added backend integration guide.
- Added testing and fixture guidance.
- Added error/validation reference.
- Added release/packaging guidance.
- Clarified that the backend owns the runtime site domain and the SDK contains no production-domain default.

## 0.1.4

- Fixed expected file-size extraction for bare size text such as `12.5 MiB`.
- Kept the regression test for the file-size representation.
