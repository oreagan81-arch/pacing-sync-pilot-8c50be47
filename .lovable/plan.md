
The previous user message about scope/hooks/tables was already approved and implemented in earlier turns. The most recent actionable request was the Canvas hardening audit, where items 1+2 are now done. There is no new work to plan from this duplicate approval.

Re-stating recent state to confirm: 10 additive files shipped (QuickStats, UpcomingPosts, FileRenameCard, ConfidenceMeter, AnnouncementPreview, useCanvas, useAnnouncements, useTeacherMemory, types/thales.ts, DashboardPage edit), and hardening items 1+2 (drift assertion + URL normalization in canvas-deployer) are deployed.

## Next available hardening work (pick to implement)

**Item 3 — Announcement double-post guard** (`canvas-post-announcement`)
- Add ET-time check: Friday posts only allowed if `type='reminder'` AND hour ≥ 16
- Add idempotency: before POST, query `announcements` for matching `(week_id, subject, type)` with `posted_at IS NOT NULL` → return existing `canvasUrl` instead of re-posting

**Item 4 — Page deploy precheck** (`canvas-deploy-page`)
- Before PUT/POST, count `pacing_rows` for `weekId` where `create_assign=true` OR row contributes to page body
- If zero deployable rows AND no synthetic content → log `BLOCKED` + return early

**Item 5 — files-sync retry resilience** (`canvas-files-sync`)
- Wrap paginated GETs with the same `fetchWithRetry` already used in `canvas-deploy-assignment` (handles Canvas 429 + 5xx with exponential backoff)

## Recommendation
Do **item 3 first** — it closes a real double-post path (cron retry → duplicate parent announcement). Items 4 and 5 are defensive but lower-risk.

Tell me which to implement (3, 4, 5, or all three) and I'll switch to default mode and ship.
