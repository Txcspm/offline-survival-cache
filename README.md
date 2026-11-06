# Offline Survival Cache

A local-first field library for practical resilience and civilization continuity. Version 0.8 replaces the prototype dashboard with a responsive reading application, category browsing, local full-text search, saved reading, a private field notebook, article annotations, and offline/backup management.

**Content is still under editorial development.** The catalog contains 106 draft articles plus three preserved original references. The new field-manual module adds 30 original manuscripts (10,544 body words), one per category. Twenty-one have consulted reference records; nine explicitly await external corroboration. Zero articles have been independently approved. The 3,650-article goal is not a claim of a finished collection.

## Run or install

Visit the HTTPS deployment and wait for **Available offline** before disconnecting. The library can then be read after closing and reopening the same browser profile. Use the browser's installation UI or the Install application button in **Offline & backup** when offered. The app uses no external fonts, CDN scripts, analytics, or online account.

For a portable copy, download the ZIP from Offline & backup, extract it, and use Python 3:

- Windows: run `Start Library.bat` (requires the Python launcher).
- macOS: run `Start Library.command`; the OS may require you to allow execution.
- Other systems: run `python3 serve.py --open`.

The launcher serves only on loopback, prints `http://localhost:8000/`, and opens that address when requested. Keep its window open while serving. Direct `file://` use cannot install a service worker. This is a static application with a local-server launcher, not a native executable or a bundled Python runtime. Keep the same address, port, browser and profile for access to existing notes. macOS and Windows launchers are supplied but have not been exercised on those operating systems.

## Use the field desk

- **Overview:** actual collection counts, clear editorial status, categories, longer guides, and recent reading.
- **Browse library:** all-word local search, ID lookup, category/review/content filters, sorting and pagination. `/` opens search outside input fields.
- **All categories:** all 30 categories organized into eight divisions, with real content and approval counts.
- **Article reader:** scope and procedures, source locators and access dates, editorial evidence, related reading, saved status, private annotation and individual printing. Shareable links retain the original `#OSC-…` ID format.
- **Saved reading:** a persistent personal shelf. Missing article IDs remain in the personal record and backups rather than being silently removed.
- **Field Notes:** the original notebook, explicit Save, word count, notes-only JSON export/import, and unsaved-edit protection.
- **Offline & backup:** module download progress, verified readiness, manual refresh, storage/persistence information, installation, portable ZIP and full JSON backup/restore.

The mobile layout keeps library, saved reading, notes and offline tools in a fixed bottom navigation bar. The brand returns to the overview. Light/dark appearance is local and included in a full backup.

## Protect personal data

The existing notebook key, `osc_field_notes_v1`, is retained. New bookmarks, recent reading, annotations and appearance are stored separately as `osc_workspace_v2`. Neither is cleared by application or library updates. A malformed workspace record is preserved and can be exported for recovery; it does not hide the original notebook.

Notes-only JSON remains compatible with format `osc-notes`, version 1. Full backups use `osc-backup`, version 2 and include the current notebook editor, saved reading, annotations, recent reading, and theme. An unsaved article annotation must be saved before full export. Restores validate sizes, types, IDs, schema version, and allowed fields before explicit replacement confirmation. If the second local-storage write fails, the first write is rolled back. Importing a notes-only file changes the editor and still requires Save Notes; a full restore persists the restored data immediately.

Storage is local to a device/profile/origin, may be unavailable or full, and may be cleared by the user or browser. Requesting persistence is not guaranteed. Export backups to another device. Printed guides exclude private annotations and the notebook. External reference links need a network connection; the article text does not after installation.

## Develop and validate

Use the existing isolated checkout; do not create a worktree unless explicitly requested. Python 3.12 and Node.js 24 are used in CI.

```sh
npm ci
# Required on machines without the cloud image's /usr/bin/chromium:
npx playwright install --with-deps chromium
npm run build
npm test
python3 -m http.server 8000
```

The cloud image uses `/usr/bin/chromium`; GitHub Actions uses Playwright's Chromium on pinned Ubuntu 24.04. `app.js`, `app.css`, and `app-data.js` are ordinary locally hosted assets with no frontend build framework. `app-data.js` retains the original three embedded references verbatim and the category divisions.

`npm run build` validates content, generates catalog/search data, builds a clean `_site/`, and writes `dist/offline-survival-cache.zip` and `SHA256SUMS`. The Pages site also hosts the downloadable ZIP. The archive includes local server launchers but excludes developer tools, test fixtures, and unpublished JSON packs. Build outputs are ignored. The existing article studio and checklist JSON files remain intact in the repository, outside the published collection.

Tests cover startup, reading, multiword search, ampersand-containing category routes, filters, mobile layout, printing, browser restart offline, saved reading and annotations, notes-only and full restore, malformed records, storage-write rollback, update fetch/checksum failure, missing-module readiness, previous-release migration, and release hosting under a subdirectory. The migration fixture is the actual v0.7 HTML/worker from commit `cca5d1a`. Publishing tests reject invalid IDs, fields, duplicate content, unsupported approvals, and future review evidence; they also inspect archive hashes and manuscript coverage. CI gates publication on the suite.

## Publishing and editorial work

See [the publishing contract](README_PUBLISHING.txt) and [the new manuscripts' editorial handoff](knowledge/editorial/field-manual-review.md). Modules and catalog records are the source of truth; actual review must precede approval. Source access evidence does not certify the manuscript's accuracy or establish agency endorsement.

The service worker downloads and hashes every module into a staged generation before a durable pointer commits it. Failed updates keep the previous committed library. New cache generations use a scope/release namespace so an older worker cannot delete a new installation while cleaning up. The previous shell is retained during application takeover to protect interrupted upgrades; library generations are bounded within each release. Previous-release caches are retained during migration rather than risking private data or offline availability. Changes to shell assets require a worker version bump.

Remaining content work is substantial: 3,544 more catalog articles are needed to reach the numerical target, and all content needs independent editorial work. The existing duplicate-title pairs remain flagged. Full-corpus performance, factual accuracy, physical mobile devices, Safari, Firefox and native installers have not been certified by the current Chromium tests.
