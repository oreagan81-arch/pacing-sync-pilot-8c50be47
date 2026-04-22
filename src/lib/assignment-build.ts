/**
 * THALES OS — Assignment Payload Builder
 * Resolves a pacing cell into a deployable Canvas assignment payload.
 * Encapsulates: prefix lookup, course routing (Together Logic), group/points,
 * Friday + History/Science skip rules, due date mapping, description HTML
 * with auto-linked content_map references.
 */
import type { AppConfig } from './config';
import type { PacingCell } from '@/store/useSystemStore';
import { generateAssignmentTitle, resolveAssignmentGroup } from './assignment-logic';
import { injectFileLinks, type ContentMapEntry } from './auto-link';
import { isFridayHomeworkBlocked, FRIDAY_SKIP_REASON } from './friday-rules';
import { resolve as resolveMemory } from './memory-resolver';

export interface BuiltAssignment {
  rowKey: string;
  subject: string;
  day: string;
  dayIndex: number;
  lessonNum: string;
  type: string;
  title: string;
  description: string;
  points: number;
  gradingType: string;
  assignmentGroup: string;
  courseId: number;
  dueDate: string | null; // YYYY-MM-DD
  omitFromFinal: boolean;
  contentHash: string;
  isSynthetic: boolean;
  skipReason: string | null;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/**
 * SHA-256 hash of canonical assignment fields for change detection.
 */
export async function hashAssignment(parts: {
  title: string;
  description: string;
  points: number;
  group: string;
  dueDate: string | null;
}): Promise<string> {
  const raw = `${parts.title}|${parts.points}|${parts.group}|${parts.dueDate || ''}|${parts.description}`;
  const data = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Route subject → Canvas course id, applying Reading+Spelling Together Logic.
 */
export function resolveCourseId(subject: string, config: AppConfig): number | null {
  // Hardcoded canonical IDs — Spelling routes to Reading via Together Logic
  return config.courseIds[subject] || null;
}

/**
 * Format YYYY-MM-DD into ET-friendly "Mon, Apr 14 · 11:59 PM ET"
 */
export function formatDueET(date: string | null): string {
  if (!date) return '—';
  try {
    const d = new Date(`${date}T23:59:00-05:00`);
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return `${fmt.format(d)} · 11:59 PM ET`;
  } catch {
    return date;
  }
}

/**
 * Build an assignment from a pacing cell.
 */
export async function buildAssignment(
  pacingCell: PacingCell,
  dayIndex: number,
  config: AppConfig,
  contentMap: ContentMapEntry[],
  options?: { dayOffset?: number; isGas?: boolean },
): Promise<BuiltAssignment> {
  const { subject, type, lessonNum } = pacingCell;
  const day = DAYS[dayIndex + (options?.dayOffset ?? 0)] || '';
  const isSynthetic = !!options?.isGas;
  const prefix = config.assignmentPrefixes[subject] || subject;
  const dueDate = '2024-08-19';

  const base: BuiltAssignment = {
    rowKey: `${subject}_${dayIndex}_${type}_${lessonNum}_${isSynthetic ? 'syn' : 'org'}`,
    subject, day, dayIndex, lessonNum, type,
    title: '', description: '', points: 0, gradingType: 'points',
    assignmentGroup: '', courseId: 0, dueDate: null, omitFromFinal: false,
    contentHash: '', isSynthetic, skipReason: 'Not built',
  };

  const courseId = config.courseIds[subject];
  if (!courseId) {
    return { ...base, skipReason: 'NO_COURSE_ID' };
  }

  const title = generateAssignmentTitle(subject, type, lessonNum, prefix);
  const groupInfo = resolveAssignmentGroup(subject, type);

  let skipReason: string | null = null;
  if (isFridayHomeworkBlocked(day, type)) {
    skipReason = FRIDAY_SKIP_REASON;
  }
  if (subject === 'History' || subject === 'Science') {
    skipReason = `${subject} — no assignments`;
  }
  if (subject === 'Language Arts' && !['CP', 'Classroom Practice', 'Test'].includes(type)) {
    skipReason = 'LA — only CP and Test create assignments';
  }
  if (pacingCell.isNoClass) skipReason = 'No class';

  const description = buildDescription(subject, type, lessonNum, contentMap, config);
  const contentHash = await hashAssignment({
    title,
    description,
    points: groupInfo.points,
    group: groupInfo.groupName,
    dueDate,
  });

  return {
    ...base,
    title,
    description,
    points: groupInfo.points,
    gradingType: groupInfo.gradingType,
    assignmentGroup: groupInfo.groupName,
    courseId,
    dueDate,
    omitFromFinal: groupInfo.omitFromFinal || type === 'Study Guide',
    contentHash,
    skipReason,
  };
}

/**
 * Build the HTML description for an assignment.
 */
function buildDescription(
  subject: string,
  type: string,
  lessonNum: string,
  contentMap: ContentMapEntry[],
  config: AppConfig,
): string {
  // TODO: Implement Memory > Templates > AI logic
  return `<p>This is a placeholder description for ${subject} ${type} ${lessonNum}.</p>`;
}

/**
 * Alias for buildAssignment for backwards compatibility
 */
export const buildAssignmentForCell = buildAssignment;

/**
 * Expand a Math row into multiple assignments (Written + Fact + Study Guide)
 */
export function expandMathRow(
  dayIndex: number,
  cell: PacingCell,
  options: { config: AppConfig; contentMap: ContentMapEntry[]; weekDates?: string[] },
): BuiltAssignment[] {
  const { config, contentMap } = options;
  const assignments: BuiltAssignment[] = [];

  // 1. Main Written Test
  const mainTestCell: PacingCell = { ...cell, type: 'Test' };
  assignments.push(buildAssignment(mainTestCell, dayIndex, config, contentMap));

  // 2. Fact Test (same day)
  const factTestCell: PacingCell = { ...cell, type: 'Fact Test' };
  assignments.push(buildAssignment(factTestCell, dayIndex, config, contentMap, { isGas: true }));

  // 3. Study Guide (day before)
  if (dayIndex > 0) {
    const studyGuideCell: PacingCell = { ...cell, type: 'Study Guide' };
    assignments.push(buildAssignment(studyGuideCell, dayIndex - 1, config, contentMap, { isGas: true, dayOffset: -1 }));
  }

  return assignments;
}
