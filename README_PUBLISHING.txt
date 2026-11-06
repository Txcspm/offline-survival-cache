OFFLINE SURVIVAL CACHE | PUBLISHING CONTRACT

Canonical inputs: survival_cache_starter_25.json and knowledge/modules/*.json.
Run python3 tools/build_catalog.py. Validation completes before generated files
are written. The template is an example, not a published module.

Module schema 1.0 requires module_id, module_title, review_status, articles.
Article fields: id, title, category, priority, status, summary, body, sources,
source_review. Optional: content_stage, reviewed_by, reviewed_on.
Unknown fields are rejected. IDs use OSC- followed by 4–6 digits and must be
unique across all modules; module IDs must also be unique. Categories must be
one of the 30 categories in the validator. Priorities: P0, P1, P2, P3.
Status: draft, in_review, approved, retired. content_stage: outline, draft,
complete; omitted stage defaults to draft, never complete. Nonempty body steps
are required even for outlines. Do not fabricate completed articles or sources.

Sources require organization and an HTTPS URL with a hostname and no embedded
credentials. Optional source fields: title, locator, accessed_on. Approval
requires complete content, nonempty reviewer identity, a valid nonfuture review
date, completed source_review without a pending marker, and at least one source
with title, specific locator, and valid nonfuture access date. These records
must represent actual editorial work; passing validation cannot certify safety,
source accuracy, or reviewer identity. Do not mark unverified articles approved.

Duplicate normalized bodies and new duplicate normalized titles fail publishing.
Two pre-existing duplicate-title pairs are explicitly grandfathered, warned,
and listed in catalog.editorial. They remain drafts pending human reconciliation:
OSC-0011 / OSC-0035; OSC-0034 / OSC-0045. No text or user data was removed.
Near-duplicate ideas and paraphrases still require human editorial review.

Generated outputs: knowledge/catalog.json and knowledge/search-index.json.
The catalog includes module SHA-256 hashes, review counts, and editorial flags.
Run npm run build to also produce the Pages bundle and downloadable ZIP.
Pages publication does not commit generated files back to the branch.

Version 0.8 adds knowledge/modules/osc_field_manual_1001_1030.json: 30
original manuscripts, 10,544 body words, all draft content and draft review.
See knowledge/editorial/field-manual-review.md for article-level handoff and
field-manual-source-access.json for access evidence. Consulted pages are not
independent validation. Nine of these manuscripts still have no external
references; their source_review explicitly records that gap.

The app now loads app.js, app.css and app-data.js as local shell assets. Update
sw.js VERSION when changing the shell; do not silently keep old shell bytes.
Generated releases include serve.py and Windows/macOS starter scripts, plus
START_HERE.txt. Private notebook and article annotations are never included
in the published bundle. Full backup/restore is a user action in the app.
