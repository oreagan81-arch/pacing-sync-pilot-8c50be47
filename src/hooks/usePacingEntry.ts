import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useConfig } from '@/lib/config';
import { evaluateWeekRisk } from '@/lib/risk-engine';
import { toast } from 'sonner';
import type { ContentMapEntry } from '@/lib/auto-link';
import { usePacingData } from './usePacingData';
import { usePacingMutations } from './usePacingMutations';
import { API_SUBJECT_MAP, DAYS } from '@/lib/constants';
import { initWeekData } from '@/types/thales';

const SUBJECTS = ['Math', 'Reading', 'Spelling', 'Language Arts', 'History', 'Science'] as const;

export function usePacingEntry(
  activeQuarter: string,
  activeWeek: number,
  setActiveQuarter: (q: string) => void,
  setActiveWeek: (w: number) => void,
  setRiskLevel: (l: 'LOW' | 'MEDIUM' | 'HIGH') => void,
  setRiskScore: (s: number) => void
) {
  const config = useConfig();
  const { weekData, setWeekData, savedWeeks, contentMap, loading, loadWeekById: loadWeekDataById } = usePacingData(activeQuarter, activeWeek);
  const { saveWeek, isSaving, importSheet, isImporting } = usePacingMutations();
  const [dateRange, setDateRange] = useState('');
  const [reminders, setReminders] = useState('');
  const [resources, setResources] = useState('');
  const [activeHsSubject, setActiveHsSubject] = useState<string>('Both');

  const risk = useMemo(() => {
    const rows = SUBJECTS.flatMap((subj) =>
      DAYS.map((day) => ({
        type: weekData[subj][day].type, day,
        create_assign: weekData[subj][day].create_assign &&
          !(config?.autoLogic.historyScienceNoAssign && (subj === 'History' || subj === 'Science')) &&
          day !== 'Friday',
      }))
    );
    return evaluateWeekRisk(rows);
  }, [weekData, config]);

  useEffect(() => {
    setRiskLevel(risk.level);
    setRiskScore(risk.score);
  }, [risk, setRiskLevel, setRiskScore]);

  const updateCell = useCallback((subject: string, day: string, field: keyof DayData, value: string | boolean) => {
    setWeekData((prev) => ({
      ...prev,
      [subject]: { ...prev[subject], [day]: { ...prev[subject][day], [field]: value } },
    }));
  }, []);

  const handleSave = () => {
    saveWeek({ activeQuarter, activeWeek, dateRange, reminders, resources, activeHsSubject, weekData });
  };

  const loadWeekById = useCallback(async (weekId: string, showToast = true) => {
    const week = savedWeeks.find((w) => w.id === weekId);
    if (!week) return;

    setActiveQuarter(week.quarter);
    setActiveWeek(week.week_num);

    await loadWeekDataById(weekId, showToast);

    const { data: weekData2 } = await supabase.from('weeks').select('*').eq('id', weekId).returns<Week>().single();

    if (weekData2) {
      setDateRange(weekData2.date_range || '');
      setReminders(weekData2.reminders || '');
      setResources(weekData2.resources || '');
      setActiveHsSubject(weekData2.active_hs_subject || 'Both');
    }
  }, [savedWeeks, setActiveQuarter, setActiveWeek, loadWeekDataById]);

  useEffect(() => {
    const matchingWeek = savedWeeks.find((week) => week.quarter === activeQuarter && week.week_num === activeWeek);
    if (matchingWeek) {
      loadWeekById(matchingWeek.id, false).catch((err) => {
        console.error('Failed to auto-load week data', err);
        toast.error('Failed to auto-load week data');
      });
    }
  }, [savedWeeks, activeQuarter, activeWeek, loadWeekById]);

  const handleSheetImport = async () => {
    const sheetData = await importSheet(activeWeek);
    if (!sheetData) return;

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
  };

  return {
    weekData, dateRange, reminders, resources, saving: isSaving, sheetLoading: isImporting, activeHsSubject, savedWeeks, contentMap,
    setDateRange, setReminders, setResources, setActiveHsSubject, updateCell,
    handleSave, handleSheetImport, loadWeekById,
    getPowerUp: () => {}, // TODO
    isTestWeek: () => false, // TODO
  };
}
