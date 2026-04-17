
Friday rules are mostly already enforced; need to audit and tighten gaps.

Current state:
- `assignment-build.ts` already skips Friday non-Test rows via `auto.fridayNoHomework` (sets `skipReason`)
- `canvas-html.ts` likely renders At Home on Friday — needs guard
- `friday-publish` edge function exists for the 4 PM reminder exception
- `pacing-entry` already auto-sets `create_assign=false` on paste for Friday (per memory) but manual entry may not
- Memory `mem://business-rules/automated-publishing` covers the cron

## Plan: Lock In Friday Rules Globally

### 1. Friday rules constant — `src/lib/friday-rules.ts` (new)
- `FRIDAY = 'Friday'`
- `isFridayHomeworkBlocked(day, type)` → true unless `type==='Test'` (tests still allowed)
- `shouldOmitAtHome(day)` → true on Friday
- `shouldDefaultCreateAssign(day, type)` → false on Friday unless Test

### 2. Page rendering — `src/lib/canvas-html.ts`
- In daily block renderer, when `day === 'Friday'`: skip the "At Home" `<p>` entirely (don't render the label, don't render content)
- Keep "In Class" intact

### 3. Assignment build — `src/lib/assignment-build.ts`
- Already handles Friday skip via `auto.fridayNoHomework`. Harden it:
  - Use the new `isFridayHomeworkBlocked()` helper (single source of truth)
  - Ensure `skipReason='Friday — no homework'` is set even if `auto_logic` flag is missing/false (rule is mandatory, not optional)

### 4. Pacing entry UI — `src/pages/PacingEntryPage.tsx`
- When user toggles a row to Friday OR enters a new Friday row:
  - Auto-set `create_assign=false` (unless type is `Test`)
  - Disable the At Home textarea on Friday rows with helper text "Friday — no At Home content"
  - Disable the create_assign checkbox on Friday rows (force false unless Test)
- Smart Paste already does this (`pacing-parse` edge function); add same guard in the manual entry mutation path

### 5. Announcement exception — `friday-publish` edge function
- Already runs Friday afternoons. Verify cron expression targets Friday 4 PM ET (`0 21 * * 5` UTC during EST, `0 20 * * 5` during EDT)
- Update cron job SQL to use the correct Friday 4 PM ET schedule via insert tool (per useful-context, don't use migration tool)
- Edge function should only post announcements with `type='reminder'` and `scheduled_post` on Friday — tighten filter

### 6. DB defaults — migration
- Add a database trigger `enforce_friday_rules()` on `pacing_rows` (BEFORE INSERT/UPDATE):
  - If `day = 'Friday'` AND `type != 'Test'` → force `create_assign = false` and `at_home = NULL`
- Defense-in-depth so even GAS sync or direct inserts respect the rule

### 7. Memory
- New `mem://business-rules/friday-rules.md` consolidating all four rules
- Add Core line to `mem://index.md`: "Friday: no At Home, no homework assignments, only Test assignments allowed; reminder announcements may post Friday 4 PM ET"

### Out of scope
- Changing test-day rules (tests on Friday still allowed)
- Holiday/no-class Friday handling (already covered by `isNoClass`)

### Order
1. `friday-rules.ts` helper + memory file
2. `canvas-html.ts` At Home guard
3. `assignment-build.ts` hardened skip
4. `PacingEntryPage` UI guards
5. DB trigger migration
6. `friday-publish` filter + cron verification
