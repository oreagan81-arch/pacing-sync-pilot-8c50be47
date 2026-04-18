
Audit:
- ✅ `content_map` table exists (subject, lesson_ref, type, canonical_name, canvas_file_id, canvas_url)
- ✅ `files` table exists with classification fields + `confidence` (regex/ai/ai-vision/manual/unclassified)
- ✅ `FileOrganizerPage` already does AI classify + orphan detection vs pacing
- ✅ Edge fns: `file-classify`, `file-vision-classify`
- ⚠️ No Canvas Files API sync — need new edge fn `canvas-files-sync`
- ⚠️ No `content_map` UI — table is referenced by `auto-link.ts` but no management page
- ⚠️ No "rename queue" workflow (rename in Canvas via PUT /api/v1/files/:id)
- ⚠️ No registry health view
- ⚠️ Missing-files detection currently only on FileOrganizerPage (against pacing); needs to also check `content_map` coverage

## Plan: Content Registry System

### 1. DB migration
Add to `content_map`:
- `slug text` — short identifier (e.g. `sm5-l078`)
- `confidence text` — regex/ai/manual
- `auto_linked boolean default false` — whether it's wired into pages/announcements
- `last_synced timestamptz`
- Unique index on `(subject, lesson_ref, type)`

Add to `files`:
- `slug text`
- `canvas_url text` — direct download
- `needs_rename boolean default false` — true when `original_name !== friendly_name`
- `renamed_at timestamptz`

### 2. New edge function: `canvas-files-sync`
- GET `/api/v1/courses/{id}/files?per_page=100` paginated for each course in `system_config.course_ids`
- Upsert into `files` table by `drive_file_id` (Canvas file ID)
- Run regex classifier; if no match, queue for AI vision
- For high-confidence matches (regex or ai≥0.85), upsert into `content_map` with `auto_linked=true` and generate slug
- Returns: `{ synced, classified, mapped, needsReview }`

### 3. New edge function: `canvas-file-rename`
- PUT `/api/v1/files/{id}` with `name: friendly_name`
- Updates `files.original_name`, sets `renamed_at`, clears `needs_rename`
- Logs to `deploy_log`

### 4. New page: `src/pages/ContentRegistryPage.tsx`
Five tabs (shadcn `Tabs`):

**Sync tab**
- Big "Sync Canvas Files" button → calls `canvas-files-sync`
- Per-course progress + last-sync timestamp
- Result summary cards: synced / classified / needs review

**Content Map tab**
- Table of `content_map` entries: Subject | Lesson Ref | Type | Slug | Canonical Name | Canvas Link | Confidence | Auto-linked toggle
- Inline edit slug + canonical name
- Filter by subject

**Missing Files tab**
- Cross-references `pacing_rows` with `content_map` for the current quarter
- Shows: Subject | Lesson | Day | Week | Expected Type | "🔴 Missing"
- Same logic as existing FileOrganizerPage orphan check, expanded across all weeks

**Rename Queue tab**
- Lists `files` where `needs_rename = true`
- Columns: Original Name → Friendly Name | Subject | Confidence | [Rename in Canvas] button
- Bulk "Rename All" action

**Registry Health tab**
- Stats cards: Total mapped / Coverage % (mapped / expected from pacing) / Unclassified count / Orphan count / Needs rename count
- Confidence breakdown chart (regex vs AI vs manual)
- "Last full sync" timestamp

### 5. Auto-link wiring (already exists)
`src/lib/auto-link.ts` already reads `content_map` — confirm `injectFileLinks` is called wherever Canvas HTML/announcements are built. Add note in memory.

### 6. Add route + sidebar entry
- Route `/content-registry` in `App.tsx`
- Sidebar item in `AppSidebar.tsx` with `Library` icon

### 7. Memory update
Update `mem://db/content-map-registry` with: slug field, confidence, auto-link toggle, sync flow.

### Files
1. Migration: `content_map` (slug, confidence, auto_linked, last_synced) + `files` (slug, canvas_url, needs_rename, renamed_at)
2. `supabase/functions/canvas-files-sync/index.ts` (new)
3. `supabase/functions/canvas-file-rename/index.ts` (new)
4. `src/pages/ContentRegistryPage.tsx` (new, 5 tabs)
5. `src/App.tsx` — add route
6. `src/components/AppSidebar.tsx` — add nav entry
7. `mem://db/content-map-registry` — update flow notes

### Verify
Open Content Registry → Sync tab → click Sync. Confirm files populate from all 6 Canvas courses. Switch to Content Map → confirm regex-classified files (e.g. SM5_L078) auto-mapped with slug `sm5-l078`. Drop an ugly filename like `scan_001.pdf` → appears in Rename Queue with AI-suggested friendly name. Click Rename → Canvas file gets renamed, row leaves queue. Missing Files tab lists pacing rows with no content_map match. Registry Health shows coverage %.
