import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, ChevronsLeft, ChevronsRight, Palette } from 'lucide-react';
import { usePacingCalendar } from '../hooks/usePacingCalendar';

// Placeholder for the real FullCalendar component
const CalendarViewPlaceholder = () => (
  <div className="w-full h-[600px] bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-2xl flex items-center justify-center">
    <div className="text-center">
      <Calendar className="w-16 h-16 text-slate-600 mx-auto" />
      <p className="mt-4 font-bold text-slate-500">Calendar View Will Render Here</p>
      <p className="text-xs text-slate-600">NPM package installation is currently blocked.</p>
    </div>
  </div>
);

// Placeholder for draggable lesson types
const LessonPalettePlaceholder = () => (
  <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
      <Palette className="w-3 h-3" />
      Lesson Palette
    </div>
    <div className="grid grid-cols-2 gap-2">
      {['Lesson', 'Test', 'Review', 'Investigation', 'CP', 'Activity'].map(type => (
        <div key={type} className="bg-slate-800 p-2 rounded-lg text-center text-xs font-bold cursor-grab active:cursor-grabbing">
          {type}
        </div>
      ))}
    </div>
  </div>
);

export default function PacingCalendarPage() {
  const [activeQuarter, setActiveQuarter] = useState('Q3');
  const [activeWeek, setActiveWeek] = useState(1);
  const [riskLevel, setRiskLevel] = useState<'LOW'|'MEDIUM'|'HIGH'>('LOW');
  const [riskScore, setRiskScore] = useState(100);

  // NOTE: usePacingEntry would need adaptation to support a calendar view's data needs
  // const { weekData, updateCell } = usePacingEntry(
  //   activeQuarter, activeWeek, setActiveQuarter, setActiveWeek, setRiskLevel, setRiskScore
  // );

  // Mock event data until the hook is adapted
  const events = [
    { title: 'Math L.101', date: '2026-07-06', color: '#ea580c' },
    { title: 'Reading Test 12', date: '2026-07-08', color: '#2563eb' },
    { title: 'LA Shurley Ch. 3', date: '2026-07-09', color: '#10b981' },
  ];

  return (
    <div className="p-8 font-sans bg-[#020617] text-slate-200 min-h-screen">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 bg-slate-900/50 p-6 rounded-[2rem] border-2 border-slate-800 shadow-2xl">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Pacing Calendar</h2>
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mt-1">Visual Drag & Drop Planning</p>
        </div>
        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <Button variant="ghost" size="sm"><ChevronsLeft className="w-5 h-5" /></Button>
          <span className="font-bold text-lg">July 2026</span>
          <Button variant="ghost" size="sm"><ChevronsRight className="w-5 h-5" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3">
          {/* This is where the actual FullCalendar component would go */}
          <PlaceholderCalendar />
        </div>
        <div className="lg:col-span-1">
          <LessonPalette />
        </div>
      </div>
    </div>
  );
}
