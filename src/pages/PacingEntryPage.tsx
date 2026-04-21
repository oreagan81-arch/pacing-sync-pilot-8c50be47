import { usePacingEntry } from '@/hooks/usePacingEntry';
import { PacingEntryHeader } from '../components/pacing-entry/PacingEntryHeader';
import { PacingEntryGrid } from '../components/pacing-entry/PacingEntryGrid';
import { SUBJECTS } from '../lib/constants';

const SUBJECT_TYPES: Record<string, string[]> = {
  Math: ['Lesson', 'Test', 'Fact Test', 'Study Guide', 'No Class', '-'],
  Reading: ['Lesson', 'Test', 'Checkout', 'No Class', '-'],
  Spelling: ['Lesson', 'Test', 'No Class', '-'],
  'Language Arts': ['Lesson', 'CP', 'Test', 'No Class', '-'],
  History: ['Lesson', 'Test', 'No Class', '-'],
  Science: ['Lesson', 'Test', 'No Class', '-'],
};

// Language Arts only deploys assignments for these types
const LA_ASSIGNABLE_TYPES = new Set(['CP', 'Classroom Practice', 'Test']);
const isLanguageArtsAssignable = (type: string | null | undefined) =>
  LA_ASSIGNABLE_TYPES.has(type ?? '');

interface PacingEntryPageProps {
  activeQuarter: string;
  setActiveQuarter: (q: string) => void;
  activeWeek: number;
  setActiveWeek: (w: number) => void;
  setRiskLevel: (l: 'LOW' | 'MEDIUM' | 'HIGH') => void;
  setRiskScore: (s: number) => void;
  quarterColor: string;
}

export default function PacingEntryPage({
  activeQuarter,
  setActiveQuarter,
  activeWeek,
  setActiveWeek,
  setRiskLevel,
  setRiskScore,
  quarterColor,
}: PacingEntryPageProps) {
  const {
    weekData, dateRange, reminders, resources, saving, sheetLoading, activeHsSubject, savedWeeks, contentMap,
    setDateRange, setReminders, setResources, setActiveHsSubject, updateCell,
    handleSave, handleSheetImport, loadWeekById, getPowerUp, isTestWeek,
  } = usePacingEntry(activeQuarter, activeWeek, setActiveQuarter, setActiveWeek, setRiskLevel, setRiskScore);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PacingEntryHeader
        activeQuarter={activeQuarter}
        setActiveQuarter={setActiveQuarter}
        activeWeek={activeWeek}
        setActiveWeek={setActiveWeek}
        dateRange={dateRange}
        setDateRange={setDateRange}
        reminders={reminders}
        setReminders={setReminders}
        resources={resources}
        setResources={setResources}
        activeHsSubject={activeHsSubject}
        setActiveHsSubject={setActiveHsSubject}
        savedWeeks={savedWeeks}
        handleLoadWeek={loadWeekById}
        handleSave={handleSave}
        saving={saving}
        sheetLoading={sheetLoading}
        handleSheetImport={handleSheetImport}
        quarterColor={quarterColor}
      />
      <PacingEntryGrid
        weekData={weekData}
        contentMap={contentMap}
        updateCell={updateCell}
        isTestWeek={isTestWeek}
        getPowerUp={getPowerUp}
        SUBJECT_TYPES={SUBJECT_TYPES}
      />
    </div>
  );
}
