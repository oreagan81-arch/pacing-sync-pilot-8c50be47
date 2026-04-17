
Most of this already ships. Tightening the remaining gaps for "premium" feel + faster skip path.

### Already in place ✅
- `generateCanvasPageHtml` renders Banner → Week Range → Reminders → Resources → Mon–Fri blocks with In Class / At Home, Friday At Home omitted, mobile-friendly inline styles
- `canvas-deploy-page` GETs existing page, body-compares, returns `NO_CHANGE` when identical
- Front-page support: `setFrontPage` flag, post-create PUT, `published: true` on front pages
- Retry on 5xx/429, full deploy_log + deploy_notifications

### Gaps to close

**1. Hash-based pre-skip (faster than body compare)**
- Add `page_hashes jsonb default '{}'::jsonb` to `weeks` table
- Client computes SHA-256 of generated `bodyHtml`, sends as `contentHash` in deploy payload
- Edge function: if incoming hash matches `weeks.page_hashes[subject]` → skip Canvas GET entirely, return `NO_CHANGE`
- On successful deploy, write hash back to `weeks.page_hashes[subject]`
- Net: 1 fewer Canvas API call per unchanged page

**2. Front-page published guard**
- In `canvas-deploy-page`, ensure PUT body always includes `published: true` when existing page has `front_page: true`, even when `setFrontPage` flag isn't passed (prevents accidental unpublish of homepage)

**3. Banner polish**
- Quarter-color linear gradient on banner background (with solid fallback for RCE)
- Muted "Last updated: {date}" line under subtitle

**4. Empty-state + resource labels**
- Empty `in_class` on a class day → render `<em>Lesson plan TBD</em>` instead of blank `<p>`
- Resources support `Label | URL` pipe-separated format; falls back to URL-segment label

### Files
1. Migration: `weeks.page_hashes jsonb`
2. `src/lib/canvas-html.ts` — gradient banner, last-updated stamp, TBD fallback, pipe-label resources
3. `supabase/functions/canvas-deploy-page/index.ts` — accept `contentHash`, hash pre-skip, harden front_page published guard, write hash back on success
4. `src/pages/PageBuilderPage.tsx` — compute SHA-256 client-side, pass `contentHash`, refresh `page_hashes` after deploy
5. `mem://integrations/canvas/deployment-optimization` — append page-hash flow

### Verify
Deploy the same week's Reading page twice. First: `DEPLOYED`. Second: `NO_CHANGE` with no Canvas GET in logs. Toggle "Set as homepage" → page becomes front page and stays published on re-deploy.
