
Audit `canvas-deploy-page/index.ts`:
- ✅ Already does GET first (line ~85)
- ✅ Already detects `isFrontPage = pageData.front_page === true`
- ✅ Already forces `pub = true` when `isFrontPage || setFrontPage`
- ✅ Body-compare branch already PUTs `published: true` when `isFrontPage`
- ⚠️ Gap: hash-match early-skip branch (lines ~60-80) returns NO_CHANGE WITHOUT calling Canvas at all — so if Canvas state drifted (someone unpublished the front page manually), we never re-assert `published:true`
- ⚠️ Gap: `canvas-deploy-assignment` and any other PUT paths don't matter here (assignments aren't pages)

## Plan: Harden front-page publish guard

### 1. `supabase/functions/canvas-deploy-page/index.ts`
Modify the **hash pre-skip branch** (the fast path that skips when `contentHash` matches stored hash):
- Still do the GET to learn `front_page` + `published` state
- If `front_page === true` AND `published === false`, fire a corrective PUT with `{ wiki_page: { published: true, front_page: true } }` and log `REPAIRED`
- Otherwise keep the NO_CHANGE skip
- This makes hash-skip safe against manual Canvas drift

Also tighten the **body-compare branch**:
- Currently only PUTs when `setFrontPage && !isFrontPage` OR `isFrontPage`. Confirm the PUT always sends `published: true` when the page is/was a front page (already does, but add explicit comment + assertion).

Add a dedicated helper `assertFrontPagePublished(pageData)` that returns the corrective payload when needed, used by both skip branches.

### 2. Memory update
Append to `mem://integrations/canvas/page-management`:
> Front-page publish guard: every code path that touches a Canvas page MUST GET first, and if `front_page === true`, every subsequent PUT MUST include `published: true`. The hash-skip fast path also performs the GET to detect manual unpublish drift and auto-repairs.

### Files
1. `supabase/functions/canvas-deploy-page/index.ts` — add GET + repair PUT inside hash-skip branch, factor out helper
2. `mem://integrations/canvas/page-management` — append guard rule

### Verify
- Unpublish the Q1W1 Math front page manually in Canvas
- Click Deploy on the same week (content hash matches → would normally skip)
- Confirm the function now GETs, detects `published:false` on a front page, fires the repair PUT, logs `REPAIRED`, and the Canvas page is published again
- Click Deploy a second time → returns clean `NO_CHANGE` with no PUT
