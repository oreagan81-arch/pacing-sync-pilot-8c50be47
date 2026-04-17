
The user wants a premium Canvas Weekly Agenda Page engine. Looking at existing code:

- `src/lib/canvas-html.ts` already generates Canvas HTML with banner, reminders, resources, daily blocks, In Class/At Home
- `supabase/functions/canvas-deploy-page/index.ts` already does safe-overwrite (body hash compare → NO_CHANGE), front-page activation, skip unchanged
- `src/pages/PageBuilderPage.tsx` is the UI

So most of this exists. The user is asking to LEVEL IT UP to "premium" — better mobile typography, friendly file links, assignment link injection, polish across all 6 subjects.

Gaps to address:
1. **Friendly file links** — current HTML doesn't auto-link `content_map` entries when pacing references a lesson (e.g., "Lesson 96" → link to canonical file URL)
2. **Assignment link injection** — when a `pacing_row` has `canvas_url` (deployed assignment), the In Class line should hyperlink to it
3. **Mobile typography** — current template uses fixed `width: 60%` headers that break on mobile; needs responsive inline styles
4. **Homeroom support** — current `BLOCK_IDS`/`DAYS_ORDER` only handles M-F school subjects; Homeroom course (22254) needs its own template variant (announcements-style, no daily blocks)
5. **Premium polish** — better spacing, typography hierarchy, consistent icon usage, quarter-color accents beyond just the banner
6. **PageBuilderPage UI** — preview rendering, per-subject deploy buttons, "Deploy All 6" with safety diff, set-as-front-page toggle per course

## Plan: Premium Canvas Page Engine

### 1. Enrich `src/lib/canvas-html.ts`
- **Friendly file links**: accept `contentMap` array; scan `in_class`/`at_home` text for lesson refs (`L\d+`, `SG\d+`, `Lesson \d+`) → wrap with `<a href="canvas_url">` from matching content_map entry
- **Assignment hyperlinks**: when `row.canvas_url` exists, wrap the lesson title in In Class with link to assignment
- **Mobile-responsive styles**: replace fixed `width: 60%` with `max-width: 100%; width: auto;` on H4 headers; ensure no horizontal overflow
- **Premium typography**: tighter line-height on `<p>`, consistent `<strong>` for lesson nums, italic for "no homework" notes
- **Quarter-color accents**: extend quarter color beyond banner — apply to In Class/At Home dividers as subtle left border instead of black

### 2. New `generateHomeroomPageHtml()` in same file
- Different structure: banner + reminders + announcements digest + birthdays + resources
- No daily blocks (Homeroom isn't lesson-based)
- Pulls from `newsletters` table latest entry if available

### 3. Update `canvas-deploy-page` edge function
- Already does body-hash compare ✅, front_page logic ✅
- **Add**: insert into `deploy_notifications` on success/error (success → info, error → error level)
- **Add**: 3-attempt retry on 5xx Canvas responses with exponential backoff

### 4. Rebuild `PageBuilderPage.tsx`
- Subject grid (6 cards: Math, Reading, LA, Science, History, Homeroom)
- Each card: live HTML preview (sandboxed iframe), Last Deployed timestamp, status badge (DEPLOYED/NO_CHANGE/ERROR/PENDING), "Set as Front Page" toggle, Deploy button
- Top bar: week selector + "Deploy All Subjects" → opens existing `SafetyDiffModal` → batches calls to `canvas-deploy-page`
- Hash-skip indicator: cards show "✓ Up to date" when last deploy was NO_CHANGE

### 5. Auto-link helper `src/lib/auto-link.ts`
- `injectFileLinks(text, contentMap, subject)` — regex-replaces lesson refs with anchor tags
- `injectAssignmentLink(text, lessonNum, canvasUrl)` — wraps the lesson title

### Out of scope
- Editing `canvas-html.ts` for non-school subjects beyond Homeroom
- Drag-to-reorder day blocks
- Per-day custom icon override

### Order
1. Auto-link helper + canvas-html upgrade
2. Homeroom variant
3. Edge function retry + notifications
4. PageBuilderPage rebuild with preview + safety diff

After implementation, you'll verify in preview by opening Page Builder, picking a week with pacing data, and clicking Deploy All.
