import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { AppConfig } from '@/lib/config';
import type { WeekOption } from './useWeeksList';

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

      // TODO: Implement announcement template generation logic here
      // For now, just return 0 to indicate no announcements were generated
      const generatedCount = 0;

      if (generatedCount === 0) {
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
