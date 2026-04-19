
## Phase 2.1 — Mobile layout + multi-resource entry

### What's wrong
1. **Mobile (623px)**: `min-w-[1100px]` grid forces horizontal page scroll across all 6 subjects. Cards become unreadable.
2. **Resources**: single `Input` field stores raw string (e.g. `"a,b,c"`) → renders verbatim on Canvas as one blob. No structure, no links, no friendly names.

### Fix 1 — Responsive layout
In `PacingEntryPage.tsx`, swap the single grid for a breakpoint switch:
- **≥ md (768px+)**: keep current Day × Subject grid (unchanged).
- **< md**: stack by subject. Each subject becomes a row containing a horizontal-scroll strip of 5 day cards (`overflow-x-auto snap-x`). Subject label sticky on the left.

```text
Mobile:
┌─ Math ──────────────────┐
│ [Mon][Tue][Wed][Thu][Fri] →
└─────────────────────────┘
┌─ Reading ───────────────┐
│ [Mon][Tue][Wed][Thu][Fri] →
└─────────────────────────┘
```

No changes to `DaySubjectCard` internals — same component, different container.

### Fix 2 — Structured resources
Change `cell.resources` from `string` → `Resource[]` where:
```ts
type Resource = { label: string; url?: string };
```

**Storage**: keep DB column as `text` for backward compat. Serialize as JSON when saving, parse on load. Fallback: if existing value isn't valid JSON, treat as single `{ label: value }` entry (no breaking changes for old rows).

**UI in `DaySubjectCard`** (replaces single Resources input):
- List of resource rows, each with: `[Friendly name] [URL (optional)] [×]`
- `+ Add resource` button below
- Auto-detect `content_map` URL when label matches a `lesson_ref` (e.g. type "SG92" → autofill URL from contentMap)

**Canvas output**: when generating page/announcement HTML, render as `<ul><li><a href="url">label</a></li>…</ul>` (or plain `<li>label</li>` if no URL). This change lives in the HTML emitter — out of scope for this phase, will note as a follow-up so existing deploys don't break mid-change.

### Files to modify
1. `src/components/pacing/DaySubjectCard.tsx` — replace Resources `Input` with multi-row editor + Add button + per-row delete. Update `DayCellData.resources` type.
2. `src/pages/PacingEntryPage.tsx` — add mobile breakpoint layout; update serialize/parse for resources on save/load.
3. `src/types/thales.ts` (if `Resource` type belongs there) — add shared `Resource` type.

### Out of scope (flagged for next phase)
- Updating `canvas-html.ts` / page builder to emit `<ul><li>` from structured resources. Until then, the planner stores structured data but Canvas output uses `resources.map(r => r.label).join(', ')` so nothing breaks.
- Phase 3 (StyleSuggestions in cards) — still queued after this.

### Verify
- Resize to 623px → subjects stack, days scroll horizontally inside each row.
- Add 3 resources to a Math card → each gets own row with name + URL fields.
- Save, reload page → resources persist as separate rows (not "a,b,c").
- Old rows with comma strings load as single resource (no data loss).
