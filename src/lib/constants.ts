export const FRIDAY_SKIP_REASON = 'Friday — no homework';

export const SUBJECTS = ['Math', 'Reading', 'Spelling', 'Language Arts', 'History', 'Science'] as const;
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

export const API_SUBJECT_MAP: Record<string, string> = {
  Math: 'Math', Reading: 'Reading', Spelling: 'Spelling', English: 'Language Arts',
  'Language Arts': 'Language Arts', History: 'History', Science: 'Science',
};

export const LA_ASSIGNABLE_TYPES = new Set(['CP', 'Classroom Practice', 'Test']);
