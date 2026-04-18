---
name: Teacher Memory Layer
description: Capture-resolve loop that learns teacher edits and applies them via Memory > Templates > AI precedence
type: feature
---

# Teacher Memory Layer

## Tables
- `teacher_feedback_log` — raw audit (entity_type, before, after, diff_summary, action)
- `teacher_memory` — derived patterns (category, key, value jsonb, confidence 0-1, usage_count)
- `teacher_patterns` — reserved for AI-discovered cross-edit patterns awaiting promotion

## Capture flow
Any UI edit point calls **both**:
```ts
await logEdit('assignment', id, before, after, 'edit');   // audit
await learnFromEdit('assignment', before, after);          // extract pattern
```
Captured at: AssignmentsPage (title edits + deploy), PageBuilderPage (HTML edits + deploy),
AnnouncementCenterPage (content edits + post), FileOrganizerPage (rename), all deploy buttons (timing).

## Pattern categories
| category | key format | value |
|---|---|---|
| assignment_name | `<subject>:<type>` | `{ titlePattern }` (lesson# → `{N}`) |
| page_title | `<subject>:<Q#W#>` | `{ template }` |
| page_section_order | `<subject>` | `{ order: [...] }` |
| announcement_phrase | `<subject>:<type>` | `{ opener, closer }` |
| file_naming | `<subject>:<type>` | `{ pattern }` |
| deploy_timing | `<subject>:<dayOfWeek>` | `{ hourET }` |

## Confidence math
- New entry: `confidence = 0.3`
- Repeat with same value: `new = old + (1 - old) * 0.3` (asymptotes to 1.0)
- Different value (correction): `new = max(0.1, old * 0.7)`

## Resolve precedence (Memory > Templates > AI)
```ts
const title = await resolve('assignment_name', `${subject}:${type}`,
  () => buildAssignmentTitleFallback(),  // template
  { lessonNum });
```
Memory wins only when `confidence >= 0.6`. Otherwise the fallback (template) runs.
AI generators (`generate-announcement`, `pacing-parse`) are the third tier — invoked
inside fallbacks when no template applies.

## UI: `/memory`
Tabs: Learned Patterns | Edit History | Suggested Patterns | Deploy Habits | Stats.
Memory hit rate tracked in `localStorage['thales.memory.hits']` (memory/template/ai counters).
