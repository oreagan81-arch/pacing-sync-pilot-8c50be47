import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { AppConfig } from '@/lib/config';
import type { WeekOption } from './useWeeksList';
import {
  renderCombinedReadingSpellingBody,
  buildCombinedTitle,
  renderReadingTestBody,
  renderSpellingTestBody,
} from '@/lib/announcement-templates';

export interface PacingRow {
  id: string;
  week_id: string | null;
  subject: string;
  day: string;
  type: string | null;
  lesson_num: string | null;
  in_class: string | null;
  at_home: string | null;
  canvas_url: string | null;
  object_id: string | null;
}

interface AutoGenerateInput {
  weekId: string;
  config: AppConfig;
  weeks: WeekOption[];
}

export function useAutoGenerateAnnouncements() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ weekId, config, weeks }: AutoGenerateInput) => {
      const { data: rows, error: rowsError } = await supabase
        .from('pacing_rows')
        .select('id, week_id, subject, day, type, lesson_num, in_class, at_home, canvas_url, object_id')
        .eq('week_id', weekId);

      if (rowsError) throw rowsError;
      if (!rows || rows.length === 0) {
        toast.info('No pacing data for this week');
        return 0;
      }

      const week = weeks.find((w) => w.id === weekId);
      const weekLabel = week ? `${week.quarter} Wk ${week.week_num}` : '';

      const drafts = [];

      // Test Reminders
      const tests = rows.filter((r) => (r.type ?? '').toLowerCase().includes('test'));
      for (const test of tests) {
        const title = `${test.subject} Test Reminder`;
        let content = `<p>A test for ${test.subject} is scheduled for ${test.day}.</p>`;
        if (test.subject === 'Reading') {
          content = renderReadingTestBody({ lessonNum: test.lesson_num, readingTestPhrases: [] });
        } else if (test.subject === 'Spelling') {
          content = renderSpellingTestBody({ testNum: parseInt(test.lesson_num || '0'), wordBank: {} });
        }
        drafts.push({
          week_id: weekId,
          subject: test.subject,
          title,
          content,
          type: 'test_reminder',
          status: 'DRAFT',
          course_id: config.courseIds[test.subject],
        });
      }

      // Weekly Summaries
      const subjects = Array.from(new Set(rows.map((r) => r.subject)));
      for (const subject of subjects) {
        const title = `${weekLabel} ${subject} Summary`;
        const content = `<p>This week in ${subject}, we will be covering...</p>`;
        drafts.push({
          week_id: weekId,
          subject,
          title,
          content,
          type: 'weekly_summary',
          status: 'DRAFT',
          course_id: config.courseIds[subject],
        });
      }

      if (drafts.length > 0) {
        const { error } = await supabase.from('announcements').insert(drafts);
        if (error) throw error;
      }
      
      const generatedCount = drafts.length;

      if (generatedCount === 0) {
// ... existing code ...
        toast.info('No announcement triggers matched this week');
      } else {
        toast.success(`Auto-generated ${generatedCount} announcement(s)`);
      }

      return generatedCount;
    },
    onSuccess: (count) => {
      if (count > 0) {
        qc.invalidateQueries({ queryKey: ['announcements'] });
      }
    },
    onError: (error: Error) => {
      toast.error('Auto-generate failed', { description: error.message });
    },
  });
}
