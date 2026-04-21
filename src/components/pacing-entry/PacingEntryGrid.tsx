import { DaySubjectCard, type DayCellData } from '@/components/pacing/DaySubjectCard';
import type { ContentMapEntry } from '@/lib/auto-link';
import { SUBJECTS, DAYS } from '@/lib/constants';

interface PacingEntryGridProps {
    weekData: Record<string, Record<string, DayCellData>>;
    contentMap: ContentMapEntry[];
    updateCell: (subject: string, day: string, field: keyof DayCellData, value: string | boolean) => void;
    isTestWeek: (subject: string) => boolean;
    getPowerUp: (lessonNum: string) => string | null;
    SUBJECT_TYPES: Record<string, string[]>;
}

export function PacingEntryGrid({
    weekData, contentMap, updateCell, isTestWeek, getPowerUp, SUBJECT_TYPES
}: PacingEntryGridProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            {SUBJECTS.map((subject) => (
                <div key={subject} className="space-y-4">
                    <h2 className={`text-lg font-bold text-center ${isTestWeek(subject) ? 'text-yellow-400' : ''}`}>{subject}</h2>
                    {DAYS.map((day) => {
                        const cellData = weekData[subject]?.[day];
                        if (!cellData) return null;
                        return (
                            <DaySubjectCard
                                key={day}
                                day={day}
                                subject={subject}
                                data={cellData}
                                onUpdate={updateCell}
                                subjectTypes={SUBJECT_TYPES[subject] || []}
                                contentMap={contentMap}
                                powerUp={getPowerUp(cellData.lesson_num)}
                            />
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
