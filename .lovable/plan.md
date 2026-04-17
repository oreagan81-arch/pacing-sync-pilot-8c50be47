
Audit:
- `assignment-logic.ts` already handles LA titles for `Test` ("ELA4A Shurley Test") and `CP` ("ELA4A Classroom Practice N")
- `assignment-build.ts` does NOT currently filter LA non-CP/non-Test rows — they would still produce assignments
- Course ID 21944 already hardcoded in `course-ids.ts` ✅
- Prefix in `system_config.assignment_prefixes` is `"ELA4:"` — needs update to `"ELA4A"` to match user spec
- No CP type recognition in pacing entry UI — need to verify it's a selectable type

## Plan: Language Arts CP/Test-Only Rule

### 1. Build-time filter — `src/lib/assignment-build.ts`
In `buildAssignmentForCell()`, after type resolution, add LA guard:
- If `subject === 'Language Arts'` AND `type` is NOT one of `['CP', 'Classroom Practice', 'Test']` → set `skipReason = 'LA — only CP and Test create assignments'`
- Use a helper `isLanguageArtsAssignable(type)` in a new section of `friday-rules.ts` or inline (simple enough inline)

### 2. Prefix update — DB migration
- Update `system_config.assignment_prefixes` JSONB: `"Language Arts": "ELA4A"` (was `"ELA4:"`)
- Single UPDATE statement in migration

### 3. Title format verification — `src/lib/assignment-logic.ts`
Current LA titles:
- Test → `"ELA4A Shurley Test"` (no lesson num) ✅
- CP → `"ELA4A Classroom Practice N"` ✅
- Default lesson → `"ELA4A English N"` (will never deploy now per rule above)

No code change needed — prefix flows through from config.

### 4. Pacing entry — `src/pages/PacingEntryPage.tsx`
- Verify `CP` is in the LA type dropdown options (alongside `Lesson`, `Test`)
- For LA rows where type is NOT CP/Test, display a small muted hint "No assignment will be created" next to the create_assign checkbox (which should auto-disable)
- Auto-set `create_assign = false` on LA rows when type is `Lesson` (or anything not CP/Test)

### 5. DB trigger hardening — migration
Extend `enforce_friday_rules` (or add a sibling trigger `enforce_subject_rules`) to also force `create_assign = false` on `pacing_rows` where:
- `subject = 'Language Arts'` AND `type NOT IN ('CP', 'Classroom Practice', 'Test')`
- Bypass for synthetic rows

Defense-in-depth: ensures GAS sync, manual SQL, or paste imports respect the rule.

### 6. Memory updates
- Update `mem://business-rules/subject-logic` LA section: only CP + Test deploy as assignments; prefix `ELA4A`; course `21944`
- Update `mem://business-rules/assignment-logic` if it references LA
- Add Core line to `mem://index.md`: "Language Arts: only CP and Test rows create assignments; prefix ELA4A; course 21944"

### Out of scope
- LA page rendering (lesson rows still appear on Canvas pages, just no assignments)
- LA announcement rules (no spec given)

### Order
1. DB migration: prefix update + trigger extension for LA rule
2. `assignment-build.ts` LA assignable filter
3. `PacingEntryPage.tsx` UI hint + auto-disable create_assign for non-CP/Test LA rows
4. Memory updates

After build: verify by adding a Language Arts row of type `Lesson` in Pacing Entry, opening the Assignments page, and confirming no LA assignment appears in preview. Then add a `CP` row and confirm `"ELA4A Classroom Practice N"` appears with course 21944.
