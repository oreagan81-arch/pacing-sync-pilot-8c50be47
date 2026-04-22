import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSystemStore } from '@/store/useSystemStore';
import { useConfig } from '@/lib/config';
import {
  generateCanvasPageHtml,
  generateHomeroomPageHtml,
  generateRedirectPageHtml,
  type CanvasPageRow,
} from '@/lib/canvas-html';
import type { ContentMapEntry } from '@/lib/auto-link';
import {
  filterTogetherPageRows,
  resolveTogetherCourseId,
} from '@/lib/together-logic';
import type { Week } from '@/types/thales';

export function usePageBuilder() {
  const config = useConfig();
  const { selectedMonth, pacingData, fetchPacingData } = useSystemStore();

  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string>('');
  const [savedRows, setSavedRows] = useState<CanvasPageRow[]>([]);
  const [contentMap, setContentMap] = useState<ContentMapEntry[]>([]);
  const [latestNewsletter, setLatestNewsletter] = useState<{ homeroom_notes: string | null; birthdays: string | null } | null>(null);

  const selectedWeek = useMemo(() => {
    return weeks.find((w) => w.id === selectedWeekId) || null;
  }, [weeks, selectedWeekId]);

  // Fetch initial data
  useEffect(() => {
    supabase.from('weeks').select('*').order('quarter').order('week_num').then(({ data }) => {
      if (data) setWeeks(data);
    });
    supabase.from('content_map').select('lesson_ref, subject, canvas_url, canonical_name').then(({ data }) => {
      if (data) setContentMap(data as ContentMapEntry[]);
    });
    supabase
      .from('newsletters')
      .select('homeroom_notes, birthdays')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setLatestNewsletter(data ?? null));
  }, []);

  // Sync with global store
  useEffect(() => {
    if (selectedWeekId || weeks.length === 0) return;
    const matchingWeek = weeks.find((week) => week.quarter === selectedMonth && week.week_num === selectedWeek);
    if (matchingWeek) {
      setSelectedWeekId(matchingWeek.id);
    }
  }, [weeks, selectedWeekId, selectedMonth, selectedWeek]);

  // Fetch week-specific data
  useEffect(() => {
    if (!selectedWeekId) return;
    const week = weeks.find((w) => w.id === selectedWeekId) || null;
    setSelectedWeek(week);

    if (week) {
      fetchPacingData(week.quarter, week.week_num);
    }

    supabase
      .from('pacing_rows')
      .select('*')
      .eq('week_id', selectedWeekId)
      .then(({ data }) => {
        setSavedRows((data as unknown as CanvasPageRow[]) || []);
      });
  }, [selectedWeekId, weeks, fetchPacingData]);

  const rows: CanvasPageRow[] = useMemo(() => {
    if (!pacingData) return savedRows;

    const savedRowMap = new Map(savedRows.map((row) => [`${row.subject}:${row.day}`, row]));
    const result: CanvasPageRow[] = [];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    for (const [subject, cells] of Object.entries(pacingData.subjects)) {
      cells.forEach((cell, idx) => {
        const day = days[idx];
        const savedRow = savedRowMap.get(`${subject}:${day}`);
        result.push({
          day,
          type: savedRow?.type || (cell.isTest ? 'Test' : cell.isReview ? 'Review' : cell.isNoClass ? '-' : 'Lesson'),
          lesson_num: cell.lessonNum || savedRow?.lesson_num || null,
          in_class: cell.value || savedRow?.in_class || null,
          at_home: savedRow?.at_home || null,
          canvas_url: savedRow?.canvas_url || null,
          canvas_assignment_id: savedRow?.canvas_assignment_id || null,
          object_id: savedRow?.object_id || null,
          subject,
          resources: savedRow?.resources || null,
        });
      });
    }

    return result;
  }, [pacingData, savedRows]);

  return {
    config,
    weeks,
    selectedWeekId,
    setSelectedWeekId,
    selectedWeek,
    rows,
    contentMap,
    latestNewsletter,
  };
}
