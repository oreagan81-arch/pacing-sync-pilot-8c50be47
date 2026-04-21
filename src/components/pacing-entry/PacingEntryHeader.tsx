import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Zap, Sheet, Loader2, CalendarDays } from 'lucide-react';
import PasteImportDialog from '@/components/PasteImportDialog';

interface PacingEntryHeaderProps {
    activeQuarter: string;
    setActiveQuarter: (q: string) => void;
    activeWeek: number;
    setActiveWeek: (w: number) => void;
    dateRange: string;
    setDateRange: (dr: string) => void;
    reminders: string;
    setReminders: (r: string) => void;
    resources: string;
    setResources: (r: string) => void;
    activeHsSubject: string;
    setActiveHsSubject: (hs: string) => void;
    savedWeeks: { id: string; quarter: string; week_num: number }[];
    handleLoadWeek: (id: string) => void;
    handleSave: () => void;
    saving: boolean;
    sheetLoading: boolean;
    handleSheetImport: () => void;
    quarterColor: string;
}

export function PacingEntryHeader({
    activeQuarter, setActiveQuarter, activeWeek, setActiveWeek, dateRange, setDateRange,
    reminders, setReminders, resources, setResources, activeHsSubject, setActiveHsSubject,
    savedWeeks, handleLoadWeek, handleSave, saving, sheetLoading, handleSheetImport, quarterColor
}: PacingEntryHeaderProps) {
    const handleAutoRemind = () => { /* Logic would be moved to the hook */ };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header and controls */}
            <div className="flex flex-wrap items-center gap-3">
                {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
                    <button
                        key={q}
                        onClick={() => setActiveQuarter(q)}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${activeQuarter === q ? 'text-white shadow-md' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                        style={activeQuarter === q ? { backgroundColor: quarterColor } : undefined}
                    >
                        {q}
                    </button>
                ))}
                <Select value={String(activeWeek)} onValueChange={(v) => setActiveWeek(Number(v))}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (<SelectItem key={i + 1} value={String(i + 1)}>Week {i + 1}</SelectItem>))}
                    </SelectContent>
                </Select>
                <Input placeholder="Date range (e.g. Jan 6–10)" value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="w-48" />
                <div className="flex-grow" />
                <Select value={activeHsSubject} onValueChange={setActiveHsSubject}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Both">History & Science Alternating</SelectItem>
                        <SelectItem value="History">History Active</SelectItem>
                        <SelectItem value="Science">Science Active</SelectItem>
                    </SelectContent>
                </Select>
                <Button onClick={handleSave} disabled={saving} className="w-28 gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? 'Saving...' : 'Save'}
                </Button>
            </div>

            {/* Load from saved / Import from Sheet */}
            <div className="flex flex-wrap items-center gap-3">
                <Select onValueChange={handleLoadWeek}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Load from saved..." /></SelectTrigger>
                    <SelectContent>
                        {savedWeeks.map(w => <SelectItem key={w.id} value={w.id}>{w.quarter} Week {w.week_num}</SelectItem>)}
                    </SelectContent>
                </Select>
                <PasteImportDialog onImport={() => {}} />
                <Button onClick={handleSheetImport} variant="outline" disabled={sheetLoading} className="gap-2">
                    {sheetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sheet className="h-4 w-4" />}
                    Import from Sheet
                </Button>
                <div className="flex-grow" />
            </div>

            {/* Reminders & Resources */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Reminders</h3>
                        <Button variant="ghost" size="sm" onClick={handleAutoRemind} className="gap-1.5"><Zap className="h-3.5 w-3.5 text-yellow-400" />Auto</Button>
                    </div>
                    <Textarea placeholder="Weekly reminders..." value={reminders} onChange={(e) => setReminders(e.target.value)} className="h-24" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Global Resources</h3>
                    <Textarea placeholder="Links, notes, etc." value={resources} onChange={(e) => setResources(e.target.value)} className="h-24" />
                </div>
            </div>
        </div>
    );
}
