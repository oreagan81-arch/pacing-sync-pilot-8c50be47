import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { PacingRow, WeekData } from '@/types/thales';
import { initWeekData } from '@/types/thales';

interface SystemState {
  activeQuarter: string;
  activeWeek: number;
  pacingData: WeekData;
  isLoading: boolean;
  setActiveQuarter: (quarter: string) => void;
  setActiveWeek: (week: number) => void;
  fetchPacingData: (quarter: string, week: number) => Promise<void>;
}

export const useSystemStore = create<SystemState>((set, get) => ({
  activeQuarter: 'Q1',
  activeWeek: 1,
  pacingData: initWeekData(),
  isLoading: true,
  setActiveQuarter: (quarter) => set({ activeQuarter: quarter }),
  setActiveWeek: (week) => set({ activeWeek: week }),
  fetchPacingData: async (quarter, week) => {
    set({ isLoading: true });
    const { data: weekData } = await supabase
      .from('weeks')
      .select('id')
      .eq('quarter', quarter)
      .eq('week_num', week)
      .single();

    if (weekData) {
      const { data: rows } = await supabase
        .from('pacing_rows')
        .select('*')
        .eq('week_id', weekData.id)
        .returns<PacingRow[]>();

      if (rows) {
        const newData = initWeekData();
        for (const row of rows) {
          if (newData[row.subject] && newData[row.subject][row.day]) {
            newData[row.subject][row.day] = {
              type: row.type || '',
              lesson_num: row.lesson_num || '',
              in_class: row.in_class || '',
              at_home: row.at_home || '',
              resources: row.resources || '',
              create_assign: row.create_assign ?? true,
            };
          }
        }
        set({ pacingData: newData });
      }
    } else {
      set({ pacingData: initWeekData() });
    }
    set({ isLoading: false });
  },
}));
