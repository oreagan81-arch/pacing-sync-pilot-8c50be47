import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ContentMapEntry } from '@/lib/auto-link';
import { initWeekData, type WeekData, type Week, type PacingRow } from '@/types/thales';

export function usePacingData(activeQuarter: string, activeWeek: number) {
  const [weekData, setWeekData] = useState<WeekData>(initWeekData);
  const [savedWeeks, setSavedWeeks] = useState<Week[]>([]);
  const [contentMap, setContentMap] = useState<ContentMapEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch saved weeks and content map once
  useEffect(() => {
    Promise.all([
      supabase.from('weeks').select('*').order('quarter').order('week_num').returns<Week[]>(),
      supabase.from('content_map').select('lesson_ref,subject,canvas_url,canonical_name').returns<ContentMapEntry[]>(),
    ]).then(([{ data: weeksData }, { data: contentMapData }]) => {
      if (weeksData) setSavedWeeks(weeksData);
      if (contentMapData) setContentMap(contentMapData);
    });
  }, []);

  const loadWeekById = async (weekId: string, showToast = true) => {
    setLoading(true);
    const week = savedWeeks.find((w) => w.id === weekId);
    if (!week) {
      setLoading(false);
      return;
    }

    const { data: rows } = await supabase.from('pacing_rows').select('*').eq('week_id', weekId).returns<PacingRow[]>();

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
      setWeekData(newData);
    }
    setLoading(false);
    if (showToast) toast.success(`Loaded ${week.quarter} Week ${week.week_num}`);
  };

  // Auto-load week data when active quarter/week changes
  useEffect(() => {
    const matchingWeek = savedWeeks.find((week) => week.quarter === activeQuarter && week.week_num === activeWeek);
    if (matchingWeek) {
      loadWeekById(matchingWeek.id, false).catch((err) => {
        console.error('Failed to auto-load week data', err);
        toast.error('Failed to auto-load week data');
      });
    } else {
      setWeekData(initWeekData()); // Reset if no matching week found
    }
  }, [savedWeeks, activeQuarter, activeWeek]);

  return { weekData, setWeekData, savedWeeks, contentMap, loading, loadWeekById };
}
