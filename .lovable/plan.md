
The user wants course IDs hardcoded. They're already in `system_config.course_ids` (loaded via `loadConfig()`). The user is asking me to ensure these exact values are the source of truth.

Best approach: add a constant module `src/lib/course-ids.ts` as the canonical hardcoded fallback, AND update the `system_config` row in DB so both layers agree. This way the runtime config remains overridable but the hardcoded constants act as the safety net per Prompt 1's "no Canvas IDs drift" rule.

Let me check current state quickly via plan rather than reads — I already have `useSystemStore` and `config.ts` in context. The Spelling→Reading routing is already handled in `assignment-build.ts` via `togetherLogicCourseId`.

## Plan: Hardcode Canonical Course IDs

### 1. New `src/lib/course-ids.ts` — single source of truth
```ts
export const COURSE_IDS = {
  Math: 21957,
  Reading: 21919,
  Spelling: 21919,        // Together Logic — shares Reading course
  'Language Arts': 21944,
  History: 21934,
  Science: 21970,
  Homeroom: 22254,
} as const;

export const TOGETHER_LOGIC_COURSE_ID = 21919;

export function getCourseId(subject: string): number | null {
  return COURSE_IDS[subject as keyof typeof COURSE_IDS] ?? null;
}
```

### 2. Update `src/lib/config.ts`
- After `loadConfig()` returns, merge `COURSE_IDS` over `data.course_ids` so hardcoded values always win
- Same for `autoLogic.togetherLogicCourseId` → force to `21919`

### 3. Update `src/lib/assignment-build.ts`
- `resolveCourseId()` → use `getCourseId()` from the new module instead of `config.courseIds[subject]`
- Spelling continues to route via Together Logic (already handled, just point to constant)

### 4. DB sync migration
- Update `system_config` row `course_ids` JSONB to the exact hardcoded values so any other consumer (edge functions reading the config row) sees the same truth
- Update `auto_logic.togetherLogicCourseId` = 21919

### 5. Update `mem://integrations/canvas/routing-logic`
- Refresh the memory file with the exact 6 IDs so future sessions don't drift

### Why both code constant AND DB
- Code constant = compile-time safety, no runtime config can break Canvas routing
- DB row = edge functions and admin UI still see consistent values
- If they ever diverge, code wins (merge order)

### Out of scope
- Per-quarter course rotation (not requested)
- Editing `SettingsPage.tsx` UI for course IDs (kept read-only, since hardcoded)
