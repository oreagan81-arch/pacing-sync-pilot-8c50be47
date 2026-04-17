/**
 * THALES OS — Canonical Canvas Course IDs
 * Hardcoded source of truth. Code wins over DB config if they ever diverge.
 * Spelling routes to Reading course via Together Logic.
 */
export const COURSE_IDS = {
  Math: 21957,
  Reading: 21919,
  Spelling: 21919, // Together Logic — shares Reading course
  'Language Arts': 21944,
  History: 21934,
  Science: 21970,
  Homeroom: 22254,
} as const;

export const TOGETHER_LOGIC_COURSE_ID = 21919;

export function getCourseId(subject: string): number | null {
  return COURSE_IDS[subject as keyof typeof COURSE_IDS] ?? null;
}
