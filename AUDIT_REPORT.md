# THALES OS — Comprehensive Codebase Audit Report
**Date:** April 19, 2026 | **Status:** Complete Scan Required

---

## CRITICAL ERRORS

### 1. **CORS Headers Set to Wildcard (Security Risk)**
- **File:** All Edge Functions (10+ files)
- **Issue:** `"Access-Control-Allow-Origin": "*"` exposes API to CSRF attacks
- **Location:** `supabase/functions/canvas-deployer/index.ts:8-10`, `canvas-deploy-assignment/index.ts:3-6`, etc.
- **Severity:** 🔴 **CRITICAL**
- **Fix:** Restrict to specific origins or proxy through authenticated Supabase client

```typescript
// ❌ BEFORE
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, ...",
};

// ✅ AFTER
const corsHeaders = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin === "https://thalesacademy.instructure.com" ? origin : "false",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
});
```

### 2. **Multiple Implementations of `getNextFriday4PM()` with Inconsistent Logic**
- **Files:** 
  - `src/lib/date-utils.ts:40` — Returns ISO string via `etDateAt()`
  - `supabase/functions/canvas-deployer/index.ts:482` — Direct Date manipulation
- **Issue:** Different logic paths cause inconsistent scheduling
- **Severity:** 🔴 **CRITICAL**
- **Fix:** Keep `src/lib/date-utils.ts` as canonical, import in canvas-deployer

```typescript
// In canvas-deployer/index.ts, replace lines 482-490 with:
import { getNextFriday4PM } from '../_shared/date-utils.ts'; // Create this shared module
const nextFri = getNextFriday4PM();
```

### 3. **Permissive RLS Policies Allow All Access**
- **File:** `supabase/migrations/20260410192446_*.sql:100-120`
- **Issue:** `CREATE POLICY "allow_all" ... USING (true) WITH CHECK (true)` enables unauthenticated data access
- **Severity:** 🔴 **CRITICAL** (if app goes multi-tenant)
- **Fix:** Implement proper user/session isolation

```sql
-- ❌ BEFORE
CREATE POLICY "allow_all" ON public.weeks FOR ALL USING (true) WITH CHECK (true);

-- ✅ AFTER (for single-user app, still add auth_uid context)
CREATE POLICY "authenticated_access" ON public.weeks 
  FOR ALL USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');
```

---

## HIGH PRIORITY

### 4. **Duplicate `fetchWithRetry()` Implementations with Different Backoff Logic**
- **Files:**
  - `supabase/functions/_shared/canvas-api.ts:49` — Exponential backoff: [1000, 4000, 12000]ms
  - `supabase/functions/canvas-deploy-assignment/index.ts:40` — Backoff: `400 * Math.pow(2, i)`
  - `supabase/functions/canvas-deploy-page/index.ts:9` — Backoff: `500 * Math.pow(2, i)`
- **Issue:** Inconsistent retry behavior causes unpredictable network handling
- **Severity:** 🟠 **HIGH**
- **Fix:** Extract to shared module

```typescript
// Create: supabase/functions/_shared/fetch-retry.ts
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  maxAttempts: number = 3
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status < 500 && res.status !== 429) return res;
      if (attempt < maxAttempts - 1) {
        const backoffMs = [1000, 4000, 12000][attempt];
        await new Promise(r => setTimeout(r, backoffMs));
      }
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr ?? new Error('Fetch retries exhausted');
}
```

### 5. **Duplicate `invokeFn()` Implementations**
- **Files:**
  - `supabase/functions/automation-friday-deploy/index.ts:22`
  - `supabase/functions/automation-nightly/index.ts:11`
- **Issue:** 2 nearly identical implementations → maintenance burden
- **Severity:** 🟠 **HIGH**
- **Fix:** Extract to `_shared/invoke-function.ts`

### 6. **Multiple Date Calculations Duplicated in `date-utils.ts` Functions**
- **File:** `src/lib/date-utils.ts:66-125`
- **Issue:** All three functions (`getWednesdayBefore`, `getOneWeekBefore`, `getTwoDaysBefore`) repeat:
  ```typescript
  const targetDow = DAY_INDEX[testDay] ?? 5;
  const now = new Date();
  const today = now.getDay();
  const daysUntilTest = (targetDow - today + 7) % 7 || 7;
  const test = new Date(now);
  test.setDate(now.getDate() + daysUntilTest);
  ```
- **Severity:** 🟠 **HIGH**
- **Fix:** Extract common logic

```typescript
// Create helper function
function getNextOccurrenceOfDay(dayName: string): Date {
  const targetDow = DAY_INDEX[dayName] ?? 5;
  const now = new Date();
  const today = now.getDay();
  const daysUntil = (targetDow - today + 7) % 7 || 7;
  const result = new Date(now);
  result.setDate(now.getDate() + daysUntil);
  return result;
}

// Then simplify:
export function getWednesdayBefore(testDay: string): string {
  const test = getNextOccurrenceOfDay(testDay);
  const back = (test.getDay() - 3 + 7) % 7 || 7;
  const wed = new Date(test);
  wed.setDate(test.getDate() - back);
  return etDateAt(wed.getFullYear(), wed.getMonth(), wed.getDate(), 16);
}
```

### 7. **Duplicate `subjectForCourseId()` Functions**
- **Files:**
  - `src/lib/canvas-brain.ts:66` — No parameters, uses `COURSE_IDS` constant
  - `supabase/functions/_shared/canvas-courses.ts:30` — Takes `map` parameter
- **Issue:** Inconsistent APIs, maintenance burden
- **Severity:** 🟠 **HIGH**
- **Fix:** Unify in shared location

### 8. **AnnouncementCenterPage.tsx is 935+ Lines (Component Too Large)**
- **File:** `src/pages/AnnouncementCenterPage.tsx`
- **Issue:** Single component handles:
  - Auto generation (6 announcement types × 5 subjects)
  - Quick-create dialogs (Reading Mastery, Math Urgent Reminders)
  - Manual CRUD operations
  - Canvas posting orchestration
- **Severity:** 🟠 **HIGH** (maintainability)
- **Fix:** Split into smaller components:
  - `components/announcements/AutoGenerateSection.tsx` (handleAutoGenerate logic)
  - `components/announcements/ReadingMasteryDialog.tsx` (handleRMSubmit)
  - `components/announcements/AnnouncementTable.tsx` (list + delete)
  - `components/announcements/AnnouncementForm.tsx` (manual create)

### 9. **Excessive TypeScript `any` Type Usage (30+ instances)**
- **Files:** `PasteImportDialog.tsx`, `AutomationPage.tsx`, `NewsletterPage.tsx`, `AnnouncementCenterPage.tsx`, `FileOrganizerPage.tsx`, `PacingEntryPage.tsx`, `PageBuilderPage.tsx`
- **Issue:** `catch (e: any)`, `(data as any)?.field` — defeats TypeScript safety
- **Severity:** 🟠 **HIGH**
- **Example from NewsletterPage.tsx:71:**
  ```typescript
  // ❌ BEFORE
  } catch (e: any) {
    toast.error('Extraction failed', { description: e.message });
  }

  // ✅ AFTER
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    toast.error('Extraction failed', { description: message });
  }
  ```

### 10. **useEffect Dependencies Missing or Incorrect**
- **Files:** `PageBuilderPage.tsx:75-125`, `AssignmentsPage.tsx:83-145`, `MemoryPage.tsx:81-115`
- **Issue:** `fetchPacingData` in dependency array but defined inline → infinite loops possible
- **Severity:** 🟠 **HIGH**
- **Example from PageBuilderPage.tsx:93:**
  ```typescript
  // ❌ BEFORE
  useEffect(() => {
    if (selectedWeekId || weeks.length === 0) return;
    const matchingWeek = weeks.find((week) => week.quarter === selectedMonth && week.week_num === storeWeek);
    if (matchingWeek) {
      setSelectedWeekId(matchingWeek.id);
    }
  }, [weeks, selectedWeekId, selectedMonth, storeWeek]); // fetchPacingData missing but used

  // ✅ AFTER
  const memoFetchPacingData = useCallback(
    (q: string, w: number) => { /* fetch logic */ },
    []
  );

  useEffect(() => {
    memoFetchPacingData(selectedMonth, selectedWeek);
  }, [selectedMonth, selectedWeek, memoFetchPacingData]);
  ```

### 11. **N+1 Query Pattern in PageBuilderPage.tsx**
- **File:** `src/pages/PageBuilderPage.tsx:75-125`
- **Issue:** Loading weeks, content_map, and latest newsletter in separate queries inside useEffect
- **Severity:** 🟠 **HIGH**
- **Fix:** Use `Promise.all()` to parallelize

```typescript
// ❌ BEFORE
useEffect(() => {
  supabase.from('weeks').select('*')...then(({ data }) => setWeeks(data));
  supabase.from('content_map').select(...)...then(({ data }) => setContentMap(data));
  supabase.from('newsletters').select(...).then(({ data }) => setLatestNewsletter(data));
}, []);

// ✅ AFTER
useEffect(() => {
  Promise.all([
    supabase.from('weeks').select('*'),
    supabase.from('content_map').select(...),
    supabase.from('newsletters').select(...),
  ]).then(([weeksRes, mapRes, newsRes]) => {
    if (weeksRes.data) setWeeks(weeksRes.data);
    if (mapRes.data) setContentMap(mapRes.data);
    if (newsRes.data) setLatestNewsletter(newsRes.data);
  });
}, []);
```

### 12. **Missing Error Handling in Edge Functions**
- **Files:** `supabase/functions/automation-daily-summary/index.ts`, `automation-nightly/index.ts`
- **Issue:** `runWithRetry` catches errors but doesn't expose failure modes clearly
- **Severity:** 🟠 **HIGH**
- **Fix:** Return structured error object with retry count

```typescript
// In functions that invoke other edge functions:
try {
  const result = await invokeFn('canvas-deploy-assignment', { rowId: row.id });
  // Handle result
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  // Log WITH context for debugging
  console.error(`[assignment-deploy] rowId=${row.id}, error=${msg}`);
  await sb.from('deploy_log').insert({
    week_id: weekId,
    subject: row.subject,
    action: 'assignment_deploy',
    status: 'FAILED',
    message: msg,
  });
}
```

### 13. **Canvas Token Exposed in Default Fallback**
- **File:** `supabase/functions/_shared/canvas-courses.ts:4`
- **Issue:** `const FALLBACK: Record<string, number> = {...}` hardcodes course IDs, but if env fetch fails, RLS allows reading from DB without auth
- **Severity:** 🟠 **HIGH**
- **Fix:** Add explicit auth check before DB fallback

---

## MEDIUM PRIORITY

### 14. **Console.log Statements in Production Code**
- **Files:**
  - `supabase/functions/sheets-import/index.ts:25, 38`
  - `supabase/functions/canvas-deployer/index.ts:564` (`console.warn`)
  - `src/lib/teacher-memory.ts:49, 89`
- **Severity:** 🟡 **MEDIUM**
- **Fix:** Remove or wrap in debug flag

```typescript
// ❌ BEFORE
console.log("Fetching from:", url.toString());

// ✅ AFTER (use DEBUG env var)
if (Deno.env.get('DEBUG')) console.log("Fetching from:", url.toString());
```

### 15. **Course ID Mapping Drift Risk**
- **Files:**
  - `src/lib/course-ids.ts` — hardcoded canonical IDs
  - `supabase/functions/_shared/canvas-courses.ts` — DB fallback with merge
  - `supabase/functions/canvas-deployer/index.ts:16-24` — separate hardcoded copy
- **Issue:** 3 different sources of COURSE_IDS = collision hazard (code out of sync with DB)
- **Severity:** 🟡 **MEDIUM**
- **Fix:** Implement validation in canvas-deployer:

```typescript
// Canvas deployer already does this at lines 544-556:
try {
  const { data: dbConfig } = await sb
    .from('system_config')
    .select('course_ids')
    .eq('id', 'current')
    .single();
  const dbIds = dbConfig?.course_ids ?? {};
  const drift = Object.entries(COURSE_IDS).filter(([s, id]) => dbIds[s] !== id);
  if (drift.length > 0) {
    console.warn("[course-id-drift] Code and DB diverged:", drift.map(([s, id]) => `${s}: code=${id}, db=${dbIds[s]}`));
  }
} catch { /* skip */ }
// ✅ Good! Keep this pattern.
```

### 16. **No Error Boundary Components in React**
- **Impact:** Async errors in child components crash entire app
- **Severity:** 🟡 **MEDIUM**
- **Fix:** Add Error Boundary wrapper in App.tsx

```typescript
// Create: src/components/ErrorBoundary.tsx
import React from 'react';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="space-y-4">
            <p className="text-destructive font-bold">Something went wrong</p>
            <p className="text-sm text-muted-foreground">{this.state.error?.message}</p>
            <button onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// In App.tsx:
<ErrorBoundary>
  <BrowserRouter>
    {/* routes */}
  </BrowserRouter>
</ErrorBoundary>
```

### 17. **State Explosion in Component Props**
- **Files:** `App.tsx:41-70`, `PacingEntryPage.tsx:89-97`, `AnnouncementCenterPage.tsx:103-122`
- **Issue:** Props drilling through 3+ levels, 10+ separate useState calls in single component
- **Severity:** 🟡 **MEDIUM**
- **Fix:** Use Zustand store for global pacing state

```typescript
// Create: src/store/usePacingStore.ts
import { create } from 'zustand';

export const usePacingStore = create((set) => ({
  activeQuarter: 'Q3',
  activeWeek: 1,
  riskLevel: 'LOW' as const,
  riskScore: 100,
  setActiveQuarter: (q: string) => set({ activeQuarter: q }),
  setActiveWeek: (w: number) => set({ activeWeek: w }),
  setRiskLevel: (l: 'LOW' | 'MEDIUM' | 'HIGH') => set({ riskLevel: l }),
  setRiskScore: (s: number) => set({ riskScore: s }),
}));

// Then in App.tsx, remove prop drilling:
<PacingEntryPage /> // no props needed
```

### 18. **HealthMonitorPage Realtime Subscription Missing Cleanup**
- **File:** `src/pages/HealthMonitorPage.tsx:57-70`
- **Issue:** Channel subscription created in useEffect but never unsubscribed
- **Severity:** 🟡 **MEDIUM**
- **Fix:** Add cleanup function

```typescript
// ❌ BEFORE
useEffect(() => {
  const channel = supabase.channel(...).on(.../);
  return () => { /* missing cleanup */ };
}, []);

// ✅ AFTER
useEffect(() => {
  const channel = supabase
    .channel('deploy-log-realtime')
    .on('postgres_changes', { event: 'INSERT', ... }, (payload) => {
      // handle
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

### 19. **Missing Suspense Boundaries for Async Operations**
- **Impact:** Loading states not handled for async component data
- **Severity:** 🟡 **MEDIUM**
- **Workaround:** Ensure all pages with async data show loading UI (most do via useState)

### 20. **Assignment Group Not Validated Before Deploy**
- **File:** `supabase/functions/canvas-deploy-assignment/index.ts:176-191`
- **Issue:** `resolveGroupId()` can return `null`, but code doesn't fail gracefully
- **Severity:** 🟡 **MEDIUM**
- **Fix:** Require group always exist or provide default

```typescript
// Line 176
if (assignmentGroup) {
  groupId = await resolveGroupId(courseBase, canvasHeaders, assignmentGroup);
  if (!groupId) {
    return new Response(JSON.stringify({ error: `Assignment group not found: ${assignmentGroup}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
```

---

## QUICK WINS

### 21. **TODO Comments Left in Production Code**
- **File:** `index.html:10`, `README.md:3`
- **Fix (1 minute):**
  ```html
  <!-- In index.html -->
  <!-- ❌ BEFORE --><meta property="og:title" content="..."> <!-- TODO: Update og:title... -->
  <!-- ✅ AFTER --><meta property="og:title" content="Thales Academy 4th Grade Pacing Guide">
  ```

### 22. **`readingTestPhrases` Not Initialized in `config.autoLogic`**
- **File:** `src/lib/config.ts:10`
- **Issue:** Interface requires `readingTestPhrases: string[]` but DB seed doesn't guarantee it
- **Fix (2 minutes):**
  ```typescript
  export interface AutoLogic {
    mathEvenOdd: boolean;
    mathTestTriple: boolean;
    readingTestPhrases: string[] = [];  // Default empty array
    readingFluencyBenchmarks: Record<string, { wpm: number; errors: number }> = {}; // Default
    // ... rest
  }
  ```

### 23. **Missing Empty State UI in Components**
- **Files:** `ContentRegistryPage.tsx`, `FileOrganizerPage.tsx`, `MemoryPage.tsx`
- **Issue:** Loading completed but data is empty → confusing UX
- **Fix:** Add empty state messages

```typescript
if (contentMap.length === 0) {
  return (
    <div className="text-center py-12">
      <p className="text-muted-foreground">No content mapped yet. Start by syncing Canvas files.</p>
    </div>
  );
}
```

### 24. **Unused Type Assertions in Pages**
- **File:** `PacingEntryPage.tsx:166-168`
- **Issue:** `} as any,` cast defeats TypeScript
- **Fix:** Type the object properly instead

```typescript
// ❌ BEFORE
} as any,

// ✅ AFTER (define proper interface)
} as {
  quarter: string;
  week_num: number;
  date_range: string | null;
  reminders: string | null;
  resources: string | null;
  active_hs_subject: string | null;
},
```

### 25. **Unused Variables in FileOrganizerPage**
- **File:** `src/pages/FileOrganizerPage.tsx:88`
- **Issue:** `loadFiles` dependency array is empty, will cause stale closure
- **Fix:** Use `useCallback`

```typescript
const loadFiles = useCallback(async () => {
  setLoading(true);
  const { data } = await supabase.from('files').select('*').order('created_at', { ascending: false }).limit(100);
  if (data) setFiles(data);
  setLoading(false);
}, []);

useEffect(() => {
  loadFiles();
}, [loadFiles]);
```

---

## REFACTOR OPPORTUNITIES

### 26. **Extract Common Toast Error Pattern**
**Status:** Could save 20+ lines repeated across pages

```typescript
// Create: src/hooks/useAsyncOperation.ts
export function useAsyncOperation() {
  const [loading, setLoading] = useState(false);

  const executeAsync = useCallback(async <T,>(
    fn: () => Promise<T>,
    options?: { onSuccess?: (r: T) => void; errorMsg?: string }
  ): Promise<T | null> => {
    setLoading(true);
    try {
      const result = await fn();
      options?.onSuccess?.(result);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      toast.error(options?.errorMsg || 'Operation failed', { description: msg });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, executeAsync };
}
```

### 27. **Create Shared Date Utils Across Frontend + Backend**
**Status:** Currently duplicated between `src/lib/date-utils.ts` and canvas-deployer

```typescript
// Move to shared ESM module for both client + server
// supabase/functions/_shared/date-utils.ts
// Then import in both places
```

### 28. **Consolidate Course ID Logic**
**Status:** 3 separate COURSE_IDS objects

```typescript
// Create: src/lib/course-ids.ts as canonical source
// Import in canvas-deployer + all edge functions
// Update seed migration to load from this source
```

### 29. **Split Large Pages into Routes + Sections**
| Page | Current Lines | Recommendation |
|------|---|---|
| AnnouncementCenterPage | 935+ | ➡️ Split into 4 sub-components |
| PageBuilderPage | 500+ | ➡️ Extract preview + deployment to hooks |
| AssignmentsPage | 400+ | ➡️ Extract deploy + preview logic |
| HealthMonitorPage | 300+ | ➡️ Component is OK, add realtime cleanup |

### 30. **Implement Proper Logging Service**
**Status:** Mix of console.warn, console.log, and no logging in some functions

```typescript
// Create: src/lib/logger.ts
export const logger = {
  debug: (msg: string, data?: unknown) => {
    if (Deno.env.get('DEBUG')) console.log(`[DEBUG] ${msg}`, data);
  },
  warn: (msg: string, data?: unknown) => console.warn(`[WARN] ${msg}`, data),
  error: (msg: string, data?: unknown) => console.error(`[ERROR] ${msg}`, data),
};
```

---

## SUMMARY TABLE

| Category | Count | Status |
|----------|-------|--------|
| **Critical Security Issues** | 3 | 🔴 Requires immediate fix |
| **High Priority Logic Bugs** | 10 | 🟠 Causes crashes/conflicts |
| **Medium Priority Maintenance** | 7 | 🟡 Threatens reliability |
| **Quick Wins** | 5 | 🟢 < 5 minutes each |
| **Refactor Opportunities** | 5 | 💡 Improves maintainability |
| **Total Issues** | **30** | — |

---

## RECOMMENDED PRIORITY ORDER

1. **Today:** Fix CORS headers (Critical Security)
2. **This sprint:** Consolidate duplicate functions (High Priority)
3. **Next sprint:** Split large components + add Error Boundary (Medium Priority + UX)
4. **Ongoing:** Remove console.logs + add proper logging (Quick Wins)

---

## NOTES FOR NEXT AUDIT

- Re-run after fixing core issues (expect 10-15 new issues to surface)
- Add TypeScript strict mode: `"strict": true` in `tsconfig.json`
- Enable ESLint rules: `no-console`, `no-any`, `prefer-const`
- Add pre-commit hook to prevent TODOs in production code
