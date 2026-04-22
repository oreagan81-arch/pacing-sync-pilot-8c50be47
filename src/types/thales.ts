// Curated domain type surface for Thales OS.
// Single import point: `import type { Subject, BuiltAssignment } from '@/types/thales'`.

export type { BuiltAssignment, BuildContext } from '@/lib/assignment-build';
export type { AssignmentGroupInfo } from '@/lib/assignment-logic';

export type Subject =
  | 'Math'
  | 'Reading'
  | 'Spelling'
  | 'Language Arts'
  | 'History'
  | 'Science'
  | 'Homeroom';

export type Day = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';

/**
 * Structured resource entry for a pacing cell.
 * `label` is the friendly name shown to students.
 * `url` is optional — when present, renders as a clickable/downloadable link.
 */
export interface Resource {
  label: string;
  url?: string;
}

/**
 * Parse a stored resources string into Resource[].
 * - Tries JSON first (new format).
 * - Falls back to single { label } entry (legacy free-text rows, including "a,b,c").
 * Returns [] for empty/null.
 */
export function parseResources(raw: string | null | undefined): Resource[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((r) => r && typeof r === 'object' && typeof r.label === 'string')
          .map((r) => ({ label: r.label, url: typeof r.url === 'string' && r.url ? r.url : undefined }));
      }
    } catch {
      /* fall through to legacy */
    }
  }
  // Legacy: single string blob → one resource entry, label only.
  return [{ label: trimmed }];
}

/**
 * Serialize Resource[] for DB storage. Empty list → null (clears the column).
 */
export function serializeResources(list: Resource[]): string | null {
  const cleaned = list.filter((r) => r.label.trim());
  if (cleaned.length === 0) return null;
  return JSON.stringify(cleaned.map((r) => ({ label: r.label.trim(), ...(r.url?.trim() ? { url: r.url.trim() } : {}) })));
}

export type AssignmentType =
  | 'Lesson'
  | 'CP'
  | 'Classroom Practice'
  | 'Test'
  | 'Study Guide'
  | 'Fact Test'
  | 'Review';

export interface AnnouncementDraft {
  id: string;
  title: string | null;
  content: string | null;
  subject: Subject | string | null;
  type: string | null;
  course_id: number | null;
  status: 'DRAFT' | 'SCHEDULED' | 'POSTED' | 'ERROR' | string | null;
  scheduled_post: string | null;
  posted_at: string | null;
  week_id: string | null;
}

export interface Week {
  id: string;
  quarter: string;
  week_num: number;
  date_range: string | null;
  reminders: string | null;
  resources: string | null;
  active_hs_subject: string | null;
}

export interface PacingRow {
  subject: string;
  day: string;
  type: string | null;
  lesson_num: string | null;
  in_class: string | null;
  at_home: string | null;
  resources: string | null;
  create_assign: boolean;
}

export interface DayData {
  type: string;
  lesson_num: string;
  in_class: string;
  at_home: string;
  resources: string;
  create_assign: boolean;
}

export type WeekData = Record<string, Record<string, DayData>>;

const SUBJECTS = ['Math', 'Reading', 'Spelling', 'Language Arts', 'History', 'Science'] as const;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

function emptyDay(): DayData {
  return { type: '', lesson_num: '', in_class: '', at_home: '', resources: '', create_assign: true };
}

export function initWeekData(): WeekData {
  return SUBJECTS.reduce((acc, subj) => {
    acc[subj] = DAYS.reduce((dayAcc, day) => {
      dayAcc[day] = emptyDay();
      return dayAcc;
    }, {} as Record<string, DayData>);
    return acc;
  }, {} as WeekData);
}
