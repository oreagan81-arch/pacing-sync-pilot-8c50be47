export const FRIDAY_SKIP_REASON = 'Friday — no homework';

export const SUBJECTS = ['Math', 'Reading', 'Spelling', 'Language Arts', 'History', 'Science'] as const;
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

export const API_SUBJECT_MAP: Record<string, string> = {
  Math: 'Math', Reading: 'Reading', Spelling: 'Spelling', English: 'Language Arts',
  'Language Arts': 'Language Arts', History: 'History', Science: 'Science',
};

export const LA_ASSIGNABLE_TYPES = new Set(['CP', 'Classroom Practice', 'Test']);

export const SUBJECT_COLORS: Record<string, string> = {
  Math: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
  Reading: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  Spelling: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  'Language Arts': 'bg-purple-500/10 border-purple-500/30 text-purple-300',
  History: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
  Science: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
};

export function subjectColor(subject: string) {
  return SUBJECT_COLORS[subject] || 'bg-gray-500/10 border-gray-500/30 text-gray-300';
}
