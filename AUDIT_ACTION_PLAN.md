# THALES OS — Audit Action Plan
**Generated:** April 19, 2026

---

## What Was Done

✅ **Comprehensive audit completed** across entire codebase:
- Scanned 100+ files
- Identified 30 issues (critical, high, medium, quick wins)
- Created detailed AUDIT_REPORT.md
- Generated shared utilities and fixes

### Files Created/Modified

| File | Type | Purpose |
|------|------|---------|
| `AUDIT_REPORT.md` | 📄 New | Comprehensive findings & fixes |
| `supabase/functions/_shared/fetch-retry.ts` | 🔧 New | Unified retry logic |
| `supabase/functions/_shared/invoke-fn.ts` | 🔧 New | Unified edge function invoker |
| `src/hooks/use-async-operation.ts` | 🔧 New | Reusable async + error pattern |
| `src/components/ErrorBoundary.tsx` | 🔧 New | Top-level crash handler |
| `src/App.tsx` | ✏️ Modified | Added ErrorBoundary wrapper |
| `index.html` | ✏️ Modified | Updated OG meta tags |
| `src/pages/NewsletterPage.tsx` | ✏️ Modified | Fixed error handling (5+ fixes) |
| `src/pages/AnnouncementCenterPage.tsx` | ✏️ Modified | Fixed error handling (2+ fixes) |
| `src/lib/date-utils.ts` | ✏️ Existing | Extract shared date utilities |

---

## Top 5 Issues (By Severity)

### 🔴 **1. CORS Headers Set to Wildcard**
```
Status: SECURITY RISK
Impact: CSRF attacks possible
Fix Time: 30 minutes
```
**Next Step:** Replace `"Access-Control-Allow-Origin": "*"` in ALL edge functions with origin validation. See AUDIT_REPORT.md section 1.

### 🔴 **2. Duplicate `getNextFriday4PM()` with Inconsistent Logic**  
```
Status: CAUSES SCHEDULING BUGS
Impact: Announcements post at wrong times
Fix Time: 20 minutes
```
**Next Step:** 
1. Create `supabase/functions/_shared/date-utils.ts`
2. Import canonical version from `src/lib/date-utils.ts`
3. Replace canvas-deployer implementation

### 🔴 **3. Permissive RLS Policies Allow All Access**
```
Status: SECURITY RISK (if multi-tenant)
Impact: Unauthenticated data access
Fix Time: 15 minutes
```
**Next Step:** Update migration 20260410 to validate `auth.role()` on all tables (see AUDIT_REPORT.md section 3).

### 🟠 **4. Duplicate `fetchWithRetry()` with Different Backoff**
```
Status: INCONSISTENT NETWORK BEHAVIOR
Impact: Unpredictable Canvas API errors
Fix Time: 30 minutes
```
**Next Step:**
- ✅ Created `supabase/functions/_shared/fetch-retry.ts`
- Update canvas-deploy-assignment/index.ts line 40
- Update canvas-deploy-page/index.ts line 9  
- Import from `_shared/fetch-retry.ts` instead

### 🟠 **5. AnnouncementCenterPage.tsx Too Large (935+ Lines)**
```
Status: MAINTAINABILITY RISK
Impact: Hard to modify, test, review
Fix Time: 4 hours across sprint
```
**Next Step:** Split into 4 sub-components (see AUDIT_REPORT.md section 29).

---

## Implementation Priority

### This Week (Critical)
- [x] **Day 1:** Fix CORS headers (1 hour, all edge functions) ✅ **COMPLETED**
  - Fixed wildcard CORS in canvas-pattern-train/index.ts
  - Verified: All 19 CORS headers now properly validated (no wildcards)
- [x] **Day 2:** Consolidate date utilities + fetch-retry (1 hour) ✅ **COMPLETED**
  - `supabase/functions/_shared/fetch-retry.ts` — imported by canvas-deploy-* functions
  - `supabase/functions/_shared/date-utils.ts` — created (canonical getNextFriday4PM, etc.)
  - Updated canvas-deployer/index.ts to use shared date-utils
  - Updated canvas-deploy-assignment & canvas-deploy-page to import shared fetch-retry
- [ ] **Day 3:** Test deployment to verify no regressions

### Next Sprint (High Priority)
- [ ] Consolidate duplicate functions (1 day)
- [ ] Split AnnouncementCenterPage (2 days)
- [ ] Update RLS policies (2 hours)
- [ ] Add proper logging service (1 day)

### Later (Medium Priority)
- [ ] Split other large pages (PageBuilderPage, AssignmentsPage)
- [ ] Replace `any` types with proper error handling (1 day)
- [ ] Add Suspense boundaries for async operations
- [ ] Implement proper state management with Zustand

### Quick Wins (Anytime)
- [ ] ✅ Remove TODO comments from `index.html` (DONE)
- [ ] Remove console.log from production files (30 mins)
- [ ] Replace `e: any` with proper error types (1 hour, 10+ files)
- [ ] Add empty state UI to components (1 hour)

---

## Testing Checklist After Each Fix

```bash
# Build
bun run build

# Type check
bun run check

# Unit tests (if any)
npm test

# Manual smoke test:
# 1. Auto-generate announcements (tests date utils)
# 2. Deploy assignments (tests fetch-retry)
# 3. Create pages (tests edge functions)
# 4. Trigger intentional error (tests ErrorBoundary)
```

---

## New Tools Created & How to Use

### 1. `useAsyncOperation()` Hook
**Replaces:** Manual `useState(loading) + try/catch` pattern in 10+ pages

```typescript
// Before (10 lines per operation):
const [loading, setLoading] = useState(false);
try {
  setLoading(true);
  await operation();
  toast.success('Done');
} catch (e: any) {
  toast.error(e.message);
} finally {
  setLoading(false);
}

// After (2 lines):
const { loading, executeAsync } = useAsyncOperation();
executeAsync(() => operation(), { successMsg: 'Done', errorMsg: 'Failed' });
```

### 2. `src/lib/date-utils.ts` Module
**Canonical location for all date functions** — use across frontend and backend.

```typescript
import {
  getNextFriday4PM,
  getPreviousFriday4PM,
  getOneWeekBefore,
  getTwoDaysBefore,
} from '@/lib/date-utils';
```

### 3. `ErrorBoundary` Component
**Wraps entire app** — catches unhandled errors from child components.

Already added to App.tsx at line ~138.

---

## Files to Read for Context

1. **AUDIT_REPORT.md** (this repo) — Full audit findings & code examples
2. **ANNOUNCEMENT_LOGIC.md** (this repo) — Announcement creation system overview
3. Edge functions in `supabase/functions/` — Canvas deployment logic

---

## Notes for Future Audit

- Run audit again after CRITICAL fixes applied (expect 10-15 new issues to surface)
- Enable ESLint rule `no-any` to prevent future `any` type usage
- Add pre-commit hook to prevent TODO comments in commits
- Update TypeScript config: add `"strict": true` progressively

---

## Quick Links

- **Security Issues:** AUDIT_REPORT.md sections 1-3
- **Duplicate Functions:** AUDIT_REPORT.md sections 4-7  
- **Component Refactoring:** AUDIT_REPORT.md section 29
- **All Issues:** AUDIT_REPORT.md sections 14-30

---

**Next Action:** Start with CORS headers fix (1 hour, high impact). 🚀
