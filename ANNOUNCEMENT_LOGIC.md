# Thales Academy — Announcement Creation Logic

## Overview

Announcements are created via the **Announcement Center** (`AnnouncementCenterPage.tsx`). The system supports both **auto-generation** (triggered by test/content in pacing data) and **manual creation**. The auto-generation system intelligently creates course-specific announcements based on pacing row data, with specialized logic for each subject's test types.

---

## Auto-Generation Architecture

The `handleAutoGenerate` function reads **pacing_rows** for a selected week and generates drafts across **6 course types**:

1. **Math** — 2 announcements per test (early + urgent)
2. **Reading + Spelling (Together Logic)** — 1 combined announcement to course 21919
3. **Language Arts** — Weekly summary
4. **History or Science** — Weekly summary (whichever has content)
5. **Homeroom** — Weekly overview across all subjects

### Auto-Generation Flow

```typescript
// Triggered by clicking "Auto-Generate" button
const handleAutoGenerate = async () => {
  1. Fetch pacing_rows for selected week
  2. Filter rows by subject & type
  3. Generate course-specific drafts:
     - Math tests → 2 announcements each
     - Reading test → 1 combined announcement (with Spelling)
     - Spelling test → included in Reading announcement
     - LA/History/Science → weekly summaries
     - Homeroom → full week overview
  4. Insert all drafts as status='DRAFT'
  5. User can review & post individually or via "Post All Drafts" button
}
```

---

## Subject-Specific Test Announcement Logic

### 1. **MATH TEST ANNOUNCEMENTS**

**Trigger:** Any pacing row where `subject === 'Math'` AND `type` matches `/test/i`

**Generated Announcements Per Test:** 2

#### A. **Early Warning Announcement**
- **Course ID:** Retrieved via `getCourseId('Math')`
- **Scheduled Post:** Previous Friday 4 PM ET (relative to current date)
- **Title Format:** `🔢 Heads Up: Math Test — Lesson {lesson} ({day})`
- **Content Rules:**
  - Includes lesson number (from `pacing_row.lesson_num`)
  - Links to study guide if `canvas_url` is present
  - Displays "Power Up" from config (looked up via `config.powerUpMap[lesson]`)
  - Displays "Fact Test {lesson}" (or just "Fact Test" if no lesson number)
  - Target audience: Parents (weekday afternoon messaging)
  - Tone: Proactive, preparatory ("heads up")

**HTML Template Function:** `buildMathEarlyHtml()`
```html
<div class="kl_wrapper" style="...">
  <div class="kl_banner" style="background:#ea580c;color:#fff;...">
    <h2>Math Test Coming Up — Lesson {lesson}</h2>
  </div>
  <p>Hi parents, a heads up that <strong>Math Test {lesson}</strong> is scheduled for <strong>{day}</strong>.</p>
  <ul>
    <li><strong>Power Up:</strong> {power_up}</li>
    <li><strong>Fact Test:</strong> {factTest}</li>
  </ul>
  {optional study guide link}
  <p>Please review the study guide together this weekend so students walk in confident.</p>
</div>
```

#### B. **Urgent Reminder Announcement**
- **Course ID:** Same as early announcement
- **Scheduled Post:** Wednesday 4 PM ET (Wednesday before test day)
  - Calculated by:
    1. Find next occurrence of test day from current date
    2. Walk back to Wednesday before that date
    3. Schedule for 4 PM ET
- **Title Format:** `⚠️ Tomorrow-ish: Math Test Lesson {lesson}`
- **Content Rules:**
  - Same Power Up display
  - Same Fact Test display
  - Study guide link (if present)
  - Tone: Urgent, last-minute ("just a couple days away", "one focused review pass")
  - Target: Last-minute prep reminder

**HTML Template Function:** `buildMathUrgentHtml()`
```html
<div class="kl_wrapper" style="...">
  <div class="kl_banner" style="background:#ea580c;color:#fff;...">
    <h2>⚠️ Math Test {lesson} — {day}</h2>
  </div>
  <p><strong>Quick reminder:</strong> the Math Test is just a couple days away.</p>
  <ul>
    <li><strong>Power Up:</strong> {power_up}</li>
    <li><strong>Fact Test:</strong> {factTest}</li>
  </ul>
  {optional study guide link}
  <p>Tonight is a great night for one focused review pass.</p>
</div>
```

#### C. **Power Up Mapping**
- Source: `config.powerUpMap` (from system_config table)
- Format: `{ "lesson_number": "power_up_name" }`
- Purpose: Shows custom differentiation strategy per lesson
- Example: `{ "12": "Odd/Even", "15": "Factor Pairs" }`
- Fallback: Shows "—" if not found

#### D. **Fact Test Naming**
- If lesson number exists: `Fact Test {lesson}`
- If no lesson number: `Fact Test` (generic fallback)
- Used to distinguish from Power Up (related but different assessment focus)

---

### 2. **READING TEST / CHECKOUT ANNOUNCEMENTS**

**Trigger:** Any pacing row where `subject === 'Reading'` AND `type` matches `/test/i`

**Generated Announcements:** 1 (combined with Spelling if present)

**Important Context: Together Logic**
- Reading + Spelling are taught as a **paired literacy block** in 4th grade
- Both subjects route to **single shared course** (ID: 21919)
- Announcements are posted **once** to this shared course (not separately)
- See `together-logic.ts` for implementation details

#### A. **Reading Test Announcement Details**
- **Course ID:** `TOGETHER_LOGIC_COURSE_ID` (21919)
- **Scheduled Post:** Next Friday 4 PM ET
- **Title Format:** `📚 Reading Mastery Test {lesson} and Fluency Checkout: {testDate}`
- **Content Rules:**

**Core Assessment Focus (Required):**
- Tests story details, background information, and vocabulary
- Includes **fluency fluency check**: read 100 words in one minute with ≤2 errors
- Students must use **tracking and tapping** technique (not skip words/lines)

**Required Assessment Phrases (Auto-Injected):**
- Sourced from: `config.autoLogic.readingTestPhrases`
- Default if not configured: `['tracking and tapping', '100 words per minute']`
- These are critical literacy benchmarks and always highlighted

**Checkout Passage:**
- Specified as: "come from lesson {checkoutLesson}, reading up to the flower"
- Checkout lesson can differ from test lesson (e.g., review from prior lesson)
- "Up to the flower" = predetermined stopping point in RM curriculum

**Parent Communication:**
- Emphasizes nightly practice importance
- Friendly tone: "Good afternoon, I hope you are having a great week so far!"
- Includes fluency goal (100 WPM) as benchmark

**HTML Template Function:** `buildReadingSpellingHtml()`
```html
<div class="kl_wrapper" style="...">
  <div class="kl_banner" style="background:#2563eb;color:#fff;...">
    <h2>Reading Mastery Test {testNum} — {testDate}</h2>
  </div>
  <p>Good afternoon, I hope you are having a great week so far!</p>
  <p>The mastery test will cover story details, background information, and vocabulary from our recent lessons. Students will also be reading a timed fluency passage.</p>
  <p><strong>Fluency goal:</strong> The goal of this fluency check is to read 100 words in one minute with 2 or fewer errors.</p>
  <p>Make sure they are tracking and tapping so they do not miss any words or skip lines. Practice reading with your child every day, especially out loud.</p>
  <p>For practice, the checkout passage will come from lesson {checkoutLesson}, reading up to the flower.</p>
  {optional spelling test block}
</div>
```

#### B. **Reading Test via Quick Create Dialog**
- Manual UI: Click "Reading Mastery" button in Announcement Center
- Inputs:
  - Test Number (e.g., "12")
  - Test Date (e.g., "Friday, Oct 18")
  - Checkout Passage Lesson (optional; defaults to test number)
- Creates single DRAFT announcement to course 21919
- Bypasses auto-generation; useful for one-off or mid-week tests

---

### 3. **SPELLING TEST ANNOUNCEMENTS**

**Trigger:** Any pacing row where `subject === 'Spelling'` AND `type` matches `/test/i`

**Generated Announcements:** 0 standalone (embedded in Reading announcement)

**Important:** Spelling tests are **never** posted as standalone announcements. They are **always included in the Reading announcement** (see "Together Logic" below).

#### A. **Spelling Test Logic & Content**

**Lesson Coverage Rule (Cumulative):**
- **Spelling Test N** covers Lessons **1 through N×5**
- Test 1 → Lessons 1–5
- Test 2 → Lessons 1–10
- Test 3 → Lessons 1–15
- etc.

**Word Lists Extracted From:**
- Source: `config.spellingWordBank` (from system_config table)
- Format: `{ "1": ["word1", "word2", ...], "2": [...], ... }`
- All 25 words per lesson expected

**Focus Words (Always 21–25):**
- Positions 21–25 of the **cumulative word list** (1-indexed)
- These are the "challenge words" students study most intensively
- Example: Test 2 covers 10 lessons (50 words total), focus words are positions 21–25 (the most recent ones)
- Fallback: If word bank < 5 words in position 21–25, shows "(focus words not yet in word bank)"

**Full Word List:**
- All words from lessons 1 through N×5
- Cumulative, not just the latest lesson
- Helps parents see the full scope of the test
- Fallback: "(word bank empty for these lessons)"

**Implementation Function:** `expandSpellingTest(testNum, wordBank)`
```typescript
export function expandSpellingTest(
  testNum: number,
  wordBank: Record<string, string[]>
): SpellingTestExpansion {
  const lastLesson = testNum * 5;  // Test N covers 1..N*5
  const coveredLessons: number[] = [];
  const allWords: string[] = [];

  for (let i = 1; i <= lastLesson; i++) {
    coveredLessons.push(i);
    const lessonWords = wordBank[String(i)] || [];
    allWords.push(...lessonWords);
  }

  // Focus words = positions 21..25 of full cumulative list
  const focusWords = allWords.slice(20, 25);

  return {
    testNum,
    coveredLessons,
    coveredRangeLabel: `1–${lastLesson}`,
    focusWords,
    allWords,
  };
}
```

#### B. **Spelling Test in Combined Announcement**

When both Reading **and** Spelling tests exist in the same week:
- Single announcement posted to **course 21919**
- Title: `📚 Reading Mastery Test {readingNum} and Fluency Checkout: {testDate}`
- Body includes both Reading section AND Spelling section

**Spelling Block (added if spellingTestNum > 0):**
```html
<h3 style="color:#2563eb;margin-top:20px;">Spelling Test {testNum}</h3>
<p><strong>Focus Words (21–25):</strong> {word1, word2, word3, word4, word5}</p>
```

**If Word Bank Missing:**
```html
<h3 style="color:#2563eb;margin-top:20px;">Spelling Test {testNum}</h3>
<p><strong>Focus Words (21–25):</strong> (focus words not yet in word bank)</p>
<p><strong>Full word list:</strong> (word bank empty for these lessons)</p>
```

#### C. **Spelling Test Data Flow**

```
pacing_row (subject='Spelling', type='Test', lesson_num='6')
  ↓
Auto-generate detects {readingTest + spellingTest}
  ↓
expandSpellingTest(6, config.spellingWordBank)
  ↓
Returns: {
  testNum: 6,
  coveredRangeLabel: "1–30",
  focusWords: ["word21", "word22", ..., "word25"],
  allWords: [all 150 words from lessons 1–30]
}
  ↓
buildReadingSpellingHtml() embeds Spelling block
  ↓
Single announcement to course 21919
```

---

## Other Test-Related Announcements

### 4. **LANGUAGE ARTS WEEKLY SUMMARY**

**Trigger:** Any pacing rows with `subject === 'Language Arts'`

**Generated Announcements:** 1 per week (if content exists)

**Course ID:** Retrieved via `getCourseId('Language Arts')`

**Scheduled Post:** Next Friday 4 PM ET

**Title Format:** `✏️ Language Arts — {quarter} Wk {weekNum} Overview`

**Content Rules:**
- Lists each day's `in_class` content
- Appends `at_home` work if present
- HTML wrapper with subject-specific color (#10b981 — emerald)

**HTML Template Function:** `buildSubjectSummaryHtml()`
```html
<div class="kl_wrapper" style="...border-top:6px solid #10b981...">
  <div class="kl_banner" style="background:#10b981;color:#fff;...">
    <h2>Language Arts — {quarter} Wk {weekNum}</h2>
  </div>
  <p>Here is what we are covering in Language Arts this week:</p>
  <ul>
    <li><strong>Monday:</strong> Lesson 1 <em>(at home: review)</em></li>
    <li><strong>Tuesday:</strong> Lesson 2</li>
    ...
  </ul>
</div>
```

---

### 5. **HISTORY OR SCIENCE WEEKLY SUMMARY**

**Trigger:** Whichever subject (History OR Science) has more pacing rows this week

**Generated Announcements:** 1 per week (if either exists)

**Course ID:** Retrieved via `getCourseId()` for whichever is active

**Scheduled Post:** Next Friday 4 PM ET

**Title Format:** 
- History: `🏛️ History — {quarter} Wk {weekNum} Overview`
- Science: `🔬 Science — {quarter} Wk {weekNum} Overview`

**Content:** Same structure as Language Arts (daily breakdown)

---

### 6. **HOMEROOM WEEKLY UPDATE**

**Trigger:** Always generated if week has any pacing data

**Generated Announcements:** 1 per week

**Course ID:** `22254` (hardcoded Homeroom course)

**Scheduled Post:** Next Friday 4 PM ET

**Title Format:** `🏠 Homeroom Weekly Update — {quarter} Wk {weekNum}`

**Content Rules:**
- Multi-subject overview
- Grouped by subject (Math, Reading, Language Arts, etc.)
- Each subject gets its own color-coded section
- Shows `in_class` content per day per subject
- Responsive to all active subjects in the week

**HTML Template Function:** `buildHomeroomHtml()`
```html
<div class="kl_wrapper" style="...border-top:6px solid #475569...">
  <div class="kl_banner" style="background:#475569;color:#fff;...">
    <h2>Homeroom Weekly Update — Q3 Wk 5</h2>
  </div>
  <p>Here is a quick look at what each subject is doing this week.</p>
  
  <h3 style="color:#ea580c;...">Math</h3>
  <ul>
    <li><strong>Monday:</strong> Lesson 12 Fact Test</li>
    <li><strong>Tuesday:</strong> Lesson 13</li>
  </ul>

  <h3 style="color:#2563eb;...">Reading</h3>
  <ul>
    <li><strong>Monday:</strong> Test 15</li>
    ...
  </ul>
  
  {continues for each active subject}
  
  <p style="margin-top:18px;">As always, reach out anytime with questions.</p>
</div>
```

---

## Scheduling & Timing

All announcements use **US Eastern Time (America/New_York)** with automatic **DST handling**.

### Scheduling Functions

| Function | Returns | Purpose |
|----------|---------|---------|
| `getNextFriday4PM()` | ISO string | Next Friday 4 PM ET (default for most announcements) |
| `getPreviousFriday4PM()` | ISO string | Previous Friday 4 PM ET (early Math test warning) |
| `getWednesdayBefore(testDay)` | ISO string | Wednesday before a given test day at 4 PM ET |

### DST Handling

```typescript
function etOffsetHours(date: Date): number {
  // Returns -5 (EST) or -4 (EDT) based on actual date
  // Handles DST transitions correctly
}

function etDateAt(year, month, day, hour): string {
  // Converts to ISO string for a given ET time
  // Accounts for offset dynamically
}
```

---

## Post-Generation Workflow

### Draft → Posted

1. **Auto-generate** creates announcements with `status='DRAFT'`
2. **Review** each draft in card view:
   - Title and preview shown
   - Course ID stored but not posted yet
   - Can delete individual drafts
3. **Post individually** via single "Post" button, or **Post All Drafts** to post all at once
4. **Posting** calls Edge Function `canvas-post-announcement` with:
   - Course ID
   - Title
   - Message body (HTML)
   - Scheduled post time (can be future-dated)
   - Week ID (for audit trail)

5. **Status updated** to `status='POSTED'` with `posted_at` timestamp
6. **Memory logged** via `logEdit()` + `logDeployHabit()` (teacher habit learning)

---

## Configuration Dependencies

### Required in `system_config` (Supabase)

| Config Key | Type | Used For | Example |
|-----------|------|----------|---------|
| `course_ids` | JSON | Subject → Course ID mapping | `{"Math": 12345, "Reading": 21919, ...}` |
| `assignment_prefixes` | JSON | Prefix filter (unused in announcements) | — |
| `auto_logic.readingTestPhrases` | Array | Reading test assessment focus | `["tracking and tapping", "100 words per minute"]` |
| `auto_logic.fridayNoHomework` | Boolean | (planning only, not used in announcements) | `true` |
| `spelling_word_bank` | JSON | Spelling word bank per lesson | `{"1": ["apple", "bear", ...], ...}` |
| `powerUpMap` | JSON | Math lesson → Power Up name | `{"12": "Odd/Even", "15": "Factor Pairs"}` |

---

## Testing the Logic

### Manual Test Scenarios

1. **Math Test Week:**
   - Create pacing row: Math, Wednesday, type="Test", lesson_num="12"
   - Click Auto-Generate
   - Should create 2 Math announcements:
     - Early warning (previous Friday 4 PM)
     - Urgent reminder (Wednesday 4 PM)

2. **Reading + Spelling Test Week:**
   - Create pacing row: Reading, Thursday, type="Test", lesson_num="10"
   - Create pacing row: Spelling, Thursday, type="Test", lesson_num="3"
   - Click Auto-Generate
   - Should create 1 announcement to course 21919 (Reading & Spelling combined)
   - Should include both test sections

3. **Missing Word Bank:**
   - Delete spelling word bank from config
   - Create Spelling test row
   - Auto-Generate
   - Should show "(focus words not yet in word bank)"

---

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| No pacing data for week | Toast: "No pacing data for this week"; no drafts created |
| Missing course_ids config | Announcement created with `course_id=NULL`; cannot post |
| Reading test without Spelling | Creates announcement with Reading section only |
| Spelling test without Reading | No standalone Spelling announcement; skipped |
| Math test without Power Up in config | Shows "—" for Power Up field |
| Spelling word bank partial | Shows available words; fallback text for missing ranges |
| Multiple Math tests same week | Creates 2 announcements each (can result in 4+ total) |

---

## File References

- **Main Logic:** [`src/pages/AnnouncementCenterPage.tsx`](src/pages/AnnouncementCenterPage.tsx) (lines 129–350)
- **Templates:** [`src/lib/announcement-templates.ts`](src/lib/announcement-templates.ts)
- **Together Logic:** [`src/lib/together-logic.ts`](src/lib/together-logic.ts)
- **Config:** [`src/lib/config.ts`](src/lib/config.ts)
- **Course IDs:** [`src/lib/course-ids.ts`](src/lib/course-ids.ts)
- **Supabase Tables:** `announcements`, `system_config`, `pacing_rows`

---

## Summary Table

| Subject | Test Type | Course | Count | Scheduling | Key Rules |
|---------|-----------|--------|-------|-----------|-----------|
| **Math** | Test/Fact Assessment | 12345 | 2 per test | Fri (early) + Wed (urgent) | Power Up + Study Guide |
| **Reading** | Test/Checkout | 21919 | 1 combined | Next Fri 4 PM | 100 WPM fluency + tracking/tapping |
| **Spelling** | Test | 21919 | Embedded in Reading | Next Fri 4 PM | Lessons 1–N×5, focus words 21–25 |
| **Language Arts** | (weekly summary) | 12346 | 1 per week | Next Fri 4 PM | Daily breakdown |
| **History/Science** | (weekly summary) | varies | 1 per week | Next Fri 4 PM | Whichever has more content |
| **Homeroom** | (weekly overview) | 22254 | 1 per week | Next Fri 4 PM | Multi-subject color-coded sections |
