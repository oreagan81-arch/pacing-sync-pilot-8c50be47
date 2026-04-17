
Audit of existing code:
- `supabase/functions/canvas-deploy-assignment/index.ts` exists — handles course routing, group resolution, due_at conversion, create vs update via `existingId`, logs to `deploy_log`, updates `pacing_rows`. ✅ Solid foundation.
- `src/lib/assignment-logic.ts` exists — `generateAssignmentTitle()` produces SM5/RM4/ELA4-prefixed titles, `resolveAssignmentGroup()` maps subject+type → group/points, `computeContentHash()` for change detection. ✅
- `src/pages/AssignmentsPage.tsx` exists — needs verification of preview/deploy UX.

Gaps to close for "production-grade":
1. **Change detection** — edge function doesn't compare `content_hash`; redeploys even when nothing changed. Need to skip with `NO_CHANGE` status when hash matches stored `pacing_rows.content_hash`.
2. **DST-correct due dates** — current `toDueAt()` hardcodes EST (+5h), wrong half the year. Need real America/New_York handling.
3. **Retries + notifications** — match the page engine: 3-attempt retry on 5xx/429, write to `deploy_notifications` on success/error.
4. **Preview screen** — need a dedicated preview UI that shows, per pacing row: resolved title, course, assignment group, points, due date (in ET), description preview, and current state (NEW / UPDATE / NO_CHANGE / SKIP). Then a "Deploy Selected" with the existing `SafetyDiffModal`.
5. **Friday + history/science skip rules** — config has `fridayNoHomework` and `historyScienceNoAssign` flags; surface as SKIP rows in preview with reason.
6. **Description HTML** — assignments currently get `description: ""`. Inject a small description with lesson context + auto-linked content_map references (reuse `injectFileLinks` from the page engine).

## Plan: Premium Assignment Deployment Engine

### 1. Upgrade `canvas-deploy-assignment` edge function
- Accept new fields: `contentHash`, `rowId` (already accepted), and check existing `pacing_rows.content_hash` — if equal AND `canvas_assignment_id` exists → return `NO_CHANGE`, log skip, no Canvas call
- Replace `toDueAt()` with proper DST-aware ET → UTC conversion using `Intl.DateTimeFormat` offset lookup
- Add `fetchWithRetry()` helper (3 attempts, exp backoff on 5xx/429) — mirror the pattern from `canvas-deploy-page`
- On success: insert `deploy_notifications` (level=success, title="Assignment deployed", entity_ref=canvas_url)
- On error: insert `deploy_notifications` (level=error)
- Persist `content_hash` back to `pacing_rows` after successful deploy

### 2. New helper `src/lib/assignment-build.ts`
- `buildAssignmentPayload(row, week, config, contentMap)` → returns `{ title, description, points, gradingType, assignmentGroup, courseId, dueDate, omitFromFinal, contentHash, skipReason? }`
- Encapsulates: course routing (incl. Reading+Spelling Together Logic → 21919), prefix lookup, group resolution, Friday/History/Science skip rules, due date = day-of-week mapped to week start
- Description = subject-specific short HTML (e.g. "Complete Lesson 96 odds. Show all work.") + `injectFileLinks()` for content_map auto-links

### 3. Rebuild `src/pages/AssignmentsPage.tsx` with preview-first flow
- Top: week selector + subject filter chips (All / Math / Reading / LA / Spelling)
- Table of pacing rows for selected week with computed columns:
  - Status badge: NEW (no canvas_assignment_id) / UPDATE (hash differs) / NO_CHANGE / SKIP (with reason tooltip) / ERROR
  - Title (resolved), Course, Group, Points, Due (formatted in ET), checkbox
- Row expand → shows full description preview (rendered HTML)
- "Deploy Selected" button → `SafetyDiffModal` listing only NEW + UPDATE rows → batches calls to `canvas-deploy-assignment`
- "Deploy All Pending" shortcut (selects all NEW/UPDATE)
- Toast feedback via existing `useRealtimeDeploy` hook

### 4. Wire content_hash flow
- Compute on client when building payload, send to edge function
- Edge function stores it in `pacing_rows.content_hash` after success

### Technical details (devs only)
- DST conversion: format target date with `Intl.DateTimeFormat('en-US', {timeZone:'America/New_York', timeZoneName:'shortOffset'})` to extract `GMT-4` vs `GMT-5`
- Course routing already in `useSystemStore`; reuse via `system_config.course_ids`
- Spelling routes to Reading course (21919) per Together Logic memory

### Out of scope (later prompts)
- Bulk re-grading or Canvas SpeedGrader integration
- Assignment override (per-student due dates)
- Quiz/discussion deployment (only standard assignments here)

### Order
1. `assignment-build.ts` helper
2. Edge function upgrade (DST + hash skip + retry + notifications)
3. AssignmentsPage rebuild with preview table

After building, you'll verify by selecting a current week, reviewing the preview table, and clicking Deploy Selected on 1-2 rows.
