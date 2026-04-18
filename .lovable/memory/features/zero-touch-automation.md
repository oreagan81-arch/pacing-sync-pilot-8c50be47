---
name: Zero-Touch Automation
description: Cron schedule, retry policy, and orchestrator edge functions for hands-off operation
type: feature
---

## Cron Schedule (UTC)
- `friday-publish` — Friday 21:00 UTC (4 PM ET) — posts scheduled DRAFT announcements
- `automation-friday-deploy` — Friday 21:00 UTC — deploys NEXT week's pages, assignments, schedules announcements
- `automation-nightly` — Daily 07:00 UTC (2 AM ET) — files sync, repair mappings, train memory, health snapshot
- `automation-daily-summary` — Daily 11:30 UTC (6:30 AM ET) — inserts a `deploy_notifications` row with today's plan

## Retry Policy
`runWithRetry` (in `supabase/functions/_shared/retry.ts`):
- 3 attempts, backoff `[2s, 8s, 30s]`
- On success: `automation_jobs.status='idle'`, retry_count=0, last_result={success:true, attempts}
- On final failure: status='error', insert `deploy_notifications` (level='error') + `deploy_log` (status='ERROR')

## Manual Override
`/automation` page: Run Now per job, Toggle Enabled, Retry on failed deploys.
Realtime subscription on `automation_jobs` keeps the table fresh.
