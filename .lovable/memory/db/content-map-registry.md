---
name: Content Map Registry
description: Maps lesson identifiers to Canvas resources for linking and Orphan detection. Now includes slug, confidence, auto_linked toggle, and last_synced from canvas-files-sync flow.
type: feature
---

`content_map` table fields:
- `subject`, `lesson_ref` (e.g. `L78`, `T15`), `type` (worksheet/test/study_guide/answer_key/resource)
- `slug` — short id like `math-worksheet-078`
- `canonical_name` — friendly filename (e.g. `SM5_L_078.pdf`)
- `canvas_file_id`, `canvas_url` — direct Canvas link
- `confidence` — `regex` | `ai` | `manual`
- `auto_linked` — when true, `injectFileLinks` (src/lib/auto-link.ts) wires the URL into Canvas page/announcement HTML
- `last_synced` — set by `canvas-files-sync` edge fn

Unique index: `(subject, lesson_ref, COALESCE(type, ''))`.

Sync flow: `canvas-files-sync` paginates `/api/v1/courses/{id}/files`, applies regex classifier, upserts into `files` (with `needs_rename` when friendly_name differs) and into `content_map` for high-confidence matches. UI lives at `/content-registry` (Sync, Content Map, Missing Files, Rename Queue, Health tabs). `canvas-file-rename` PUTs renamed file back to Canvas and clears the queue flag.
