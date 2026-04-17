
This is a system identity / context-setting prompt — Prompt 1 of the Ultimate Pack. No code changes required. The user is establishing rules for all subsequent prompts.

I should acknowledge the operating constraints and confirm alignment with the existing codebase, then wait for the next prompt.

Key constraints to internalize:
- Existing production system, no rebuilds
- React + Supabase + Canvas + Lovable stack ✅ matches
- Single user (Owen Reagan, Grade 4, Thales) ✅ matches memory
- Canvas API only through Edge Functions ✅ already the pattern (`canvas-deploy-page`, `canvas-deploy-assignment`, `canvas-post-announcement`, etc.)
- No tokens in frontend ✅ `CANVAS_API_TOKEN` already secret-only

## Plan: Acknowledge & Lock In Operating Rules

No files to edit. This prompt sets the contract for the next prompts in the pack.

### Confirmed alignment with existing codebase
- Stack matches: React 18 + Vite + Supabase + Canvas API + Lovable Cloud
- Single-user mode: anonymous Supabase auth, permissive RLS
- Canvas calls already routed through edge functions: `canvas-deploy-page`, `canvas-deploy-assignment`, `canvas-post-announcement`, `canvas-deployer`, `friday-publish`
- `CANVAS_API_TOKEN` and `CANVAS_BASE_URL` live as Supabase secrets — never bundled to frontend
- Memory file `mem://architecture/system-logic-engine` already encodes "Thin Client React → GAS → Supabase proxy" pattern

### Operating rules I'll follow for the rest of the pack
1. Extend, never rebuild — audit before writing
2. All Canvas mutations go through edge functions
3. No Canvas tokens, secrets, or service-role keys in frontend code
4. Single-user assumptions: no multi-tenant, no per-user RLS gymnastics
5. Reuse existing helpers (`canvas-html.ts`, `assignment-build.ts`, `auto-link.ts`, `risk-engine.ts`, `useSystemStore`)
6. Reuse existing tables — schema is now complete (14 tables incl. memory/automation/health)
7. Persist learning to `teacher_memory` / `teacher_patterns` when prompts introduce learned behavior

### Ready for Prompt 2
Awaiting the next prompt in the pack. No action needed on this one beyond acknowledgment.
