import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Week, PacingRow, WeekData } from '@/types/thales';
import { API_SUBJECT_MAP, DAYS, LA_ASSIGNABLE_TYPES, SUBJECTS } from '@/lib/constants';
import { useConfig } from '@/lib/config';

interface SaveWeekPayload {
  activeQuarter: string;
  activeWeek: number;
  dateRange: string;
  reminders: string;
  resources: string;
  activeHsSubject: string;
  weekData: WeekData;
}

export function usePacingMutations() {
  const queryClient = useQueryClient();
  const config = useConfig();

  const saveWeekMutation = useMutation({
    mutationFn: async (payload: SaveWeekPayload) => {
      const { data: weekRow, error: weekErr } = await supabase.from('weeks').upsert({
        quarter: payload.activeQuarter,
        week_num: payload.activeWeek,
        date_range: payload.dateRange,
        reminders: payload.reminders,
        resources: payload.resources,
        active_hs_subject: payload.activeHsSubject === 'Both' ? null : payload.activeHsSubject,
      }, { onConflict: 'quarter,week_num' }).select('id').single();

      if (weekErr || !weekRow) throw new Error(weekErr?.message || 'Failed to save week');

      const isLanguageArtsAssignable = (type: string | null | undefined) => LA_ASSIGNABLE_TYPES.has(type ?? '');
      const rows = SUBJECTS.flatMap((subj) =>
        DAYS.map((day) => {
          const d = payload.weekData[subj][day];
          const isNoAssign = config?.autoLogic.historyScienceNoAssign && (subj === 'History' || subj === 'Science');
          const isFriday = day === 'Friday';
          const laBlocked = subj === 'Language Arts' && !isLanguageArtsAssignable(d.type);
          return {
            week_id: weekRow.id, subject: subj, day, type: d.type || null, lesson_num: d.lesson_num || null,
            in_class: d.in_class || null, at_home: isFriday ? null : d.at_home || null, resources: d.resources || null,
            create_assign: !(isNoAssign || isFriday || laBlocked) && d.create_assign,
          };
        })
      );
      const { error: rowsErr } = await supabase.from('pacing_rows').upsert(rows, { onConflict: 'week_id,subject,day' });
      if (rowsErr) throw new Error(rowsErr.message);
    },
    onSuccess: () => {
      toast.success('Week saved!');
      return queryClient.invalidateQueries({ queryKey: ['weeks'] });
    },
    onError: (e: Error) => {
      toast.error('Save failed', { description: e.message });
    },
  });

  const importSheetMutation = useMutation({
    mutationFn: async (activeWeek: number) => {
      const { data: sheetData, error: sheetErr } = await supabase.functions.invoke('sheets-import', {
        body: { weekNum: activeWeek },
      });
      if (sheetErr) throw new Error(sheetErr.message);
      if (sheetData?.error) throw new Error(sheetData.error);
      return sheetData;
    },
    onSuccess: (data) => {
      const cellCount = data?.data?.subjects ? Object.values(data.data.subjects).flat().length : 0;
      toast.success(`Imported ${cellCount} cells from Google Sheets`);
    },
    onError: (e: Error) => {
      toast.error('Sheet import failed', { description: e.message });
    },
  });

  return {
    saveWeek: saveWeekMutation.mutateAsync,
    isSaving: saveWeekMutation.isPending,
    importSheet: importSheetMutation.mutateAsync,
    isImporting: importSheetMutation.isPending,
  };
}
