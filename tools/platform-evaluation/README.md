# Reuse-first platform evaluation

This builds two **upstream interfaces**, using all 106 cataloged articles and the three preserved originals. It does not replace or deploy the production application and never reads browser notes. Generated editions are under ignored `dist/platform-evaluation/`.

## Reproduce

Python 3.12 and Node 24 are used in this environment. From the repository root:

```sh
npm ci
npm ci --prefix tools/platform-evaluation
npm run build --prefix tools/platform-evaluation
npm test --prefix tools/platform-evaluation
npm run package --prefix tools/platform-evaluation
```

The evaluation has its own lockfile and pinned dependencies. Production dependencies and lockfile are unchanged. Astro telemetry is disabled by the build helper. The browser checks start and stop their own loopback servers and use `/usr/bin/chromium` on the cloud image or Playwright Chromium in CI.

To inspect interactively, serve `dist/platform-evaluation/starlight/dist/` with a local HTTP server, or open `dist/platform-evaluation/tiddlywiki/output/offline-survival-cache.html` in a browser that permits file URLs. These are evaluation artifacts, not the replacement production release.

## What is reused

- **Starlight 0.42.9 / Astro 7.4.7:** upstream topic tree, active article, reader layout, section table of contents, mobile menu, keyboard search dialog, Pagefind body-text search, theme controls, and previous/next navigation. No replacement reader or search engine is written.
- **TiddlyWiki 5.4.1:** upstream wiki navigation, Markdown rendering, search, editing, comments, JSON import/export and all-in-one HTML saving. Personal-note persistence uses the official browser-storage plugin, not a new storage engine.
- Existing JSON modules, IDs, editorial statuses, sources and text are exported. Duplicate titles remain separate records. TiddlyWiki records retain the full original normalized article JSON for lossless recovery.

## Deliberate limits

Starlight is a reading/navigation evaluation. PWA installation, offline restart, saved-reading/notes migration, and full backup compatibility are not implemented in that edition. The current production app continues to provide them. Do not deploy the reading prototype as if it had reached feature parity.

TiddlyWiki native editing, search, browser-storage reload and saved-HTML restoration were tested. The managed browser blocks actual `file://` URLs; a clean-profile saved-artifact test used a routed local URL with network disabled. This tests that saved HTML contains its dependencies and personal edits, but does not certify file transport on every browser. Native file saving and mobile file handling still need target-device testing.

The source collection currently has zero independently approved records. Exporting to another reader changes no approval status. No Kiwix content is downloaded by this tool. Existing third-party archives need their own provenance, license and applicability assessment before product distribution.
