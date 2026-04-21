import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useConfig } from '@/lib/config';
import { evaluateWeekRisk } from '@/lib/risk-engine';
import { toast } from 'sonner';
import type { ContentMapEntry } from '@/lib/auto-link';

const SUBJECTS = ['Math', 'Reading', 'Spelling', 'Language Arts', 'History', 'Science'] as const;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

const API_SUBJECT_MAP: Record<string, string> = {
  Math: 'Math', Reading: 'Reading', Spelling: 'Spelling', English: 'Language Arts',
  'Language Arts': 'Language Arts', History: 'History', Science: 'Science',
};

const LA_ASSIGNABLE_TYPES = new Set(['CP', 'Classroom Practice', 'Test']);

interface DayData {
  type: string; lesson_num: string; in_class: string; at_home: string;
  resources: string; create_assign: boolean;
}
type WeekData = Record<string, Record<string, DayData>>;

function emptyDay(): DayData {
  return { type: '', lesson_num: '', in_class: '', at_home: '', resources: '', create_assign: true };
}

function initWeekData(): WeekData {
  return SUBJECTS.reduce((acc, subj) => {
    acc[subj] = DAYS.reduce((dayAcc, day) => {
      dayAcc[day] = emptyDay();
      return dayAcc;
    }, {} as Record<string, DayData>);
    return acc;
  }, {} as WeekData);
}

export function usePacingEntry(
  activeQuarter: string,
  activeWeek: number,
  setActiveQuarter: (q: string) => void,
  setActiveWeek: (w: number) => void,
  setRiskLevel: (l: 'LOW' | 'MEDIUM' | 'HIGH') => void,
  setRiskScore: (s: number) => void
) {
  const config = useConfig();
  const [weekData, setWeekData] = useState<WeekData>(initWeekData);
  const [dateRange, setDateRange] = useState('');
  const [reminders, setReminders] = useState('');
  const [resources, setResources] = useState('');
  const [saving, setSaving] = useState(false);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [activeHsSubject, setActiveHsSubject] = useState<string>('Both');
  const [savedWeeks, setSavedWeeks] = useState<{ id: string; quarter: string; week_num: number }[]>([]);
  const [contentMap, setContentMap] = useState<ContentMapEntry[]>([]);

  useEffect(() => {
    supabase.from('content_map').select('lesson_ref,subject,canvas_url,canonical_name')
      .then(({ data }) => { if (data) setContentMap(data as ContentMapEntry[]); });
  }, []);

  useEffect(() => {
    const rows = SUBJECTS.flatMap((subj) =>
      DAYS.map((day) => ({
        type: weekData[subj][day].type, day,
        create_assign: weekData[subj][day].create_assign &&
          !(config?.autoLogic.historyScienceNoAssign && (subj === 'History' || subj === 'Science')) &&
          day !== 'Friday',
      }))
    );
    const risk = evaluateWeekRisk(rows);
    setRiskLevel(risk.level);
    setRiskScore(risk.score);
  }, [weekData, config, setRiskLevel, setRiskScore]);

  useEffect(() => {
    supabase.from('weeks').select('id,quarter,week_num').order('quarter').order('week_num')
      .then(({ data }) => { if (data) setSavedWeeks(data); });
  }, []);

  const updateCell = useCallback((subject: string, day: string, field: keyof DayData, value: string | boolean) => {
    setWeekData((prev) => ({
      ...prev,
      [subject]: { ...prev[subject], [day]: { ...prev[subject][day], [field]: value } },
    }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: weekRow, error: weekErr } = await supabase.from('weeks').upsert({
        quarter: activeQuarter, week_num: activeWeek, date_range: dateRange, reminders, resources,
        active_hs_subject: activeHsSubject === 'Both' ? null : activeHsSubject,
      }, { onConflict: 'quarter,week_num' }).select('id').single();

      if (weekErr || !weekRow) throw new Error(weekErr?.message || 'Failed to save week');

      const isLanguageArtsAssignable = (type: string | null | undefined) => LA_ASSIGNABLE_TYPES.has(type ?? '');
      const rows = SUBJECTS.flatMap((subj) =>
        DAYS.map((day) => {
          const d = weekData[subj][day];
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

      toast.success('Week saved!');
      const { data: updated } = await supabase.from('weeks').select('id, quarter, week_num').order('quarter').order('week_num');
      if (updated) setSavedWeeks(updated);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      toast.error('Save failed', { description: message });
    }
    setSaving(false);
  };

  const loadWeekById = useCallback(async (weekId: string, showToast = true) => {
    const week = savedWeeks.find((w) => w.id === weekId);
    if (!week) return;

    setActiveQuarter(week.quarter);
    setActiveWeek(week.week_num);

    const [{ data: weekData2 }, { data: rows }] = await Promise.all([
      supabase.from('weeks').select('*').eq('id', weekId).single(),
      supabase.from('pacing_rows').select('*').eq('week_id', weekId),
    ]);

    if (weekData2) {
      setDateRange(weekData2.date_range || '');
      setReminders(weekData2.reminders || '');
      setResources(weekData2.resources || '');
      setActiveHsSubject((weekData2 as any).active_hs_subject as string || 'Both');
    }

    if (rows) {
      const newData = initWeekData();
      for (const row of rows) {
        if (newData[row.subject] && newData[row.subject][row.day]) {
          newData[row.subject][row.day] = {
            type: row.type || '', lesson_num: row.lesson_num || '', in_class: row.in_class || '',
            at_home: row.at_home || '', resources: row.resources || '', create_assign: row.create_assign ?? true,
          };
        }
      }
      setWeekData(newData);
    }

    if (showToast) toast.success(`Loaded ${week.quarter} Week ${week.week_num}`);
  }, [savedWeeks, setActiveQuarter, setActiveWeek]);

  useEffect(() => {
    const matchingWeek = savedWeeks.find((week) => week.quarter === activeQuarter && week.week_num === activeWeek);
    if (matchingWeek) void loadWeekById(matchingWeek.id, false);
  }, [savedWeeks, activeQuarter, activeWeek, loadWeekById]);

  const handleSheetImport = async () => {
    setSheetLoading(true);
    try {
      const { data: sheetData, error: sheetErr } = await supabase.functions.invoke('sheets-import', {
        body: { weekNum: activeWeek },
      });
      if (sheetErr) throw new Error(sheetErr.message);
      if (sheetData?.error) throw new Error(sheetData.error);

      const apiData = sheetData?.data ?? sheetData?.data ?? sheetData;
      const dates = apiData?.dates;
      const subjects = apiData?.subjects;

      if (!subjects || typeof subjects !== 'object') {
        toast.info('No data found in sheet');
        return;
      }

      if (Array.isArray(dates) && dates.length >= 2) {
        const start = new Date(dates[0]); const end = new Date(dates[dates.length - 1]);
        const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        setDateRange(`${fmt(start)}–${fmt(end)}`);
      }

      const newData = initWeekData();
      let cellCount = 0;
      for (const [apiSubject, values] of Object.entries(subjects)) {
        const subject = API_SUBJECT_MAP[apiSubject];
        if (!subject || !newData[subject] || !Array.isArray(values)) continue;

        (values as any[]).forEach((val, i) => {
          const day = DAYS[i];
          if (!day || !newData[subject][day]) return;

          const cellVal = String(val ?? '');
          const lowerVal = cellVal.toLowerCase();
          const isTest = lowerVal.includes('test');
          const isNoClass = cellVal === '-' || lowerVal === 'no class';
          const lessonNum = cellVal.match(/\d+/)?.[0] || '';

          newData[subject][day] = {
            type: isTest ? 'Test' : isNoClass ? '-' : 'Lesson', lesson_num: lessonNum,
            in_class: cellVal, at_home: '', resources: '', create_assign: !isNoClass && day !== 'Friday',
          };
          cellCount++;
        });
      }
      setWeekData(newData);
      toast.success(`Imported ${cellCount} cells from Google Sheets`);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      toast.error('Sheet import failed', { description: message });
    } finally {
      setSheetLoading(false);
    }
  };

  return {
    weekData, dateRange, reminders, resources, saving, sheetLoading, activeHsSubject, savedWeeks, contentMap,
    setDateRange, setReminders, setResources, setActiveHsSubject, updateCell,
    handleSave, handleSheetImport, loadWeekById,
    getPowerUp: (lessonNum: string) => config?.powerUpMap[lessonNum] || null,
    isTestWeek: (subject: string) => DAYS.some((d) => weekData[subject][d].type?.toLowerCase().includes('test')),
  };
}
