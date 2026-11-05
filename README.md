# Offline Survival Cache

An offline reference library with a goal of 3,650 articles across 30 categories. This is a development release, not a completed or verified survival manual.

Current content: **76 cataloged drafts, zero approved articles**, plus three original unverified references embedded in the application. Existing field-checklist JSON files and the article studio remain preserved in the repository; they are not silently added to the published catalog. Two existing duplicate-title pairs are flagged in `knowledge/catalog.json` for editorial reconciliation.

## Develop and validate

Use Python 3.12+ and Node.js 24. No application backend, credentials, CDN, or runtime package downloads are needed.

```sh
npm ci
npx playwright install --with-deps chromium
npm run build
npm test
python3 -m http.server 8000
```

On this cloud image, tests use `/usr/bin/chromium`; CI uses Playwright's installed Chromium. `npm run build` validates modules and generates catalog, search index, `_site/`, and `dist/offline-survival-cache.zip` with `SHA256SUMS`. Tests exercise real browser startup, article loading, filters, deep links, notes backup/restore, browser restart while offline, failed and successful library updates, and the published bundle in a subdirectory. Python tests reject invalid publishing inputs. CI builds the same bundle and uploads it as an artifact; the Pages workflow deploys it. GitHub workflow execution and deployed Pages are separate from local verification.

## Use offline

Serve `_site/` or the extracted ZIP from a stable localhost origin, or visit the HTTPS Pages deployment. Wait for Archive Status to confirm caching before disconnecting. Install using the browser's installation UI (or the Install application button when supported). Opening files directly with `file://` does not support service workers. The ZIP is a standalone static distribution requiring a local HTTP server, not a native executable.

Search and filters run locally; results are paginated. Article links use stable ID fragments. Printing includes the article's review warning and sources. Use Archive Status to refresh content or request persistent browser storage. A successful content refresh requires reload to display new content; it does not reload the page or interrupt notes. Shell changes require a service-worker version bump in `sw.js`.

Notes retain the original `osc_field_notes_v1` storage key. Save Notes persists edits; Export Notes downloads the current editor as versioned JSON. Import validates format, version, type, and size, requests explicit replacement confirmation, and requires Save Notes to persist. Unsaved edits trigger a leave-page warning. Browser storage is device/profile/origin specific and can be evicted or cleared; keep exported backups. A ZIP or application update does not carry notes between origins.

## Content publishing

See [publishing contract](README_PUBLISHING.txt). Module bytes have SHA-256 digests in the catalog. The worker stages and verifies every module and the search index before one durable cache-pointer write commits a new generation. A failed fetch, checksum, parse, or storage operation keeps the previous generation. The previous successful generation is retained and older generations are removed on the next successful refresh. Notes storage is never cleared by library updates.

Limitations: automated checks enforce metadata and recorded review evidence, not factual correctness or reviewer identity. Sources have not been externally verified. Browser tests currently cover Chromium, not physical mobile devices, Safari, or Firefox. The library is small enough to load all module text for local search; pagination bounds rendered results, but full 3,650-article memory and download performance still needs representative content and measurement. Installation remains subject to browser support and available storage.
