OFFLINE SURVIVAL CACHE | KNOWLEDGE PUBLISHING SYSTEM

Install these three files at their exact repository paths:
  tools/build_catalog.py
  .github/workflows/publish-library.yml
  knowledge/templates/article-template.json

The template is an example only. To publish a new module, copy it into
knowledge/modules/ with a unique filename and update its article fields.

Status values: draft, in_review, approved, retired.
Approved articles must include reviewed_by, reviewed_on (YYYY-MM-DD),
source_review documenting completed verification, and at least one source.
Automated validation does not certify medical or operational safety.

On a commit to main involving a module or the publisher, GitHub Actions
validates content and generates knowledge/catalog.json and
knowledge/search-index.json. This does not modify index.html or sw.js.
Existing articles and offline functionality are preserved.

If the workflow cannot push generated files, repository Settings > Actions >
General > Workflow permissions may need Read and write permissions, and
branch protection rules must allow the action's commit. Do not disable
branch protection without understanding its consequences.

The current app still loads the starter module directly. Catalog consumption
and automated offline pack installation are separate future integrations.
