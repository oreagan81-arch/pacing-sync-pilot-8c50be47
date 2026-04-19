import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Megaphone, Clock, Send, Plus, Trash2, RefreshCw, Loader2, CheckCircle2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useConfig, type AppConfig } from '@/lib/config';
import { callEdge } from '@/lib/edge';
import { useRealtimeDeploy } from '@/hooks/use-realtime-deploy';
import { expandSpellingTest } from '@/lib/together-logic';
import { getReadingFluencyBenchmark } from '@/lib/reading-fluency';
import { TOGETHER_LOGIC_COURSE_ID, getCourseId } from '@/lib/course-ids';
import { logEdit, learnFromEdit, logDeployHabit } from '@/lib/teacher-memory';
import {
  getNextFriday4PM,
  getPreviousFriday4PM,
  getWednesdayBefore,
  getOneWeekBefore,
  getTwoDaysBefore,
} from '@/lib/date-utils';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
interface Announcement {
  id: string;
  title: string | null;
  content: string | null;
  subject: string | null;
  type: string | null;
  status: string | null;
  scheduled_post: string | null;
  posted_at: string | null;
  week_id: string | null;
  course_id: number | null;
  created_at: string | null;
}

interface WeekOption {
  id: string;
  quarter: string;
  week_num: number;
}

interface PacingRow {
  id: string;
  week_id: string | null;
  subject: string;
  day: string;
  type: string | null;
  lesson_num: string | null;
  in_class: string | null;
  at_home: string | null;
  canvas_url: string | null;
  object_id: string | null;
}

interface DraftInsert {
  week_id: string | null;
  subject: string;
  title: string;
  content: string;
  type: string;
  status: 'DRAFT';
  course_id: number | null;
  scheduled_post: string | null;
}

const SUBJECTS = ['Math', 'Reading', 'Spelling', 'Language Arts', 'History', 'Science'] as const;

// Subject color tokens (4px left border + accent text)
const SUBJECT_BORDER: Record<string, string> = {
  Math: 'border-l-orange-500',
  Reading: 'border-l-blue-500',
  Spelling: 'border-l-blue-500',
  'Language Arts': 'border-l-emerald-500',
  Science: 'border-l-purple-500',
  History: 'border-l-sky-500',
  Homeroom: 'border-l-primary',
};

const SUBJECT_HEX: Record<string, string> = {
  Math: '#ea580c',
  Reading: '#2563eb',
  Spelling: '#2563eb',
  'Language Arts': '#10b981',
  Science: '#9333ea',
  History: '#0284c7',
  Homeroom: '#475569',
};

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────
export default function AnnouncementCenterPage() {
  const config = useConfig();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState<Record<string, boolean>>({});
  const [postingAll, setPostingAll] = useState(false);

  // Manual create form
  const [showForm, setShowForm] = useState(false);
  const [formSubject, setFormSubject] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formType, setFormType] = useState('test_reminder');

  // Reading Mastery quick-create dialog
  const [showRM, setShowRM] = useState(false);
  const [rmTestNum, setRmTestNum] = useState('');
  const [rmTestDate, setRmTestDate] = useState('');
  const [rmCheckoutLesson, setRmCheckoutLesson] = useState('');

  const handleRealtimeEvent = useCallback(() => {
    loadAnnouncements(selectedWeekId || undefined);
  }, [selectedWeekId]);
  useRealtimeDeploy(handleRealtimeEvent);

  useEffect(() => {
    supabase.from('weeks').select('id, quarter, week_num').order('quarter').order('week_num')
      .then(({ data }) => { if (data) setWeeks(data); });
  }, []);

  const loadAnnouncements = async (weekId?: string) => {
    setLoading(true);
    let query = supabase.from('announcements').select('*').order('created_at', { ascending: false });
    if (weekId) query = query.eq('week_id', weekId);
    const { data } = await query.limit(50);
    if (data) setAnnouncements(data);
    setLoading(false);
  };

  useEffect(() => {
    loadAnnouncements(selectedWeekId || undefined);
  }, [selectedWeekId]);

  // ──────────────────────────────────────────────────────────────────────────
  // PART 1: Automation Engine
  // ──────────────────────────────────────────────────────────────────────────
  const handleAutoGenerate = async () => {
    if (!selectedWeekId || !config) {
      toast.error('Select a week first');
      return;
    }
    setGenerating(true);
    try {
      const { data: rows } = await supabase
        .from('pacing_rows')
        .select('id, week_id, subject, day, type, lesson_num, in_class, at_home, canvas_url, object_id')
        .eq('week_id', selectedWeekId);

      if (!rows || rows.length === 0) {
        toast.info('No pacing data for this week');
        setGenerating(false);
        return;
      }

      const week = weeks.find((w) => w.id === selectedWeekId);
      const weekLabel = week ? `${week.quarter} Wk ${week.week_num}` : '';
      const drafts: DraftInsert[] = [];

      // ─── A. Math Test Logic (1 week + 2 days before) ──────────────────
      const mathTests = rows.filter((r) => r.subject === 'Math' && /test/i.test(r.type || ''));
      for (const mt of mathTests) {
        const lesson = mt.lesson_num || '';
        const powerUp = lesson ? config.powerUpMap[lesson] || '' : '';
        const factTest = lesson ? `Fact Test ${lesson}` : 'Fact Test';
        const studyGuideUrl = mt.canvas_url || '';

        // Early draft → 1 week before test 4 PM ET
        drafts.push({
          week_id: selectedWeekId,
          subject: 'Math',
          type: 'test_reminder',
          status: 'DRAFT',
          course_id: getCourseId('Math'),
          scheduled_post: getOneWeekBefore(mt.day),
          title: `🔢 Heads Up: Math Test — Lesson ${lesson} (${mt.day})`,
          content: buildMathEarlyHtml({ lesson, day: mt.day, powerUp, factTest, studyGuideUrl, weekLabel }),
        });

        // Urgent draft → 2 days before test 4 PM ET
        drafts.push({
          week_id: selectedWeekId,
          subject: 'Math',
          type: 'test_reminder',
          status: 'DRAFT',
          course_id: getCourseId('Math'),
          scheduled_post: getTwoDaysBefore(mt.day),
          title: `⚠️ Tomorrow-ish: Math Test Lesson ${lesson}`,
          content: buildMathUrgentHtml({ lesson, day: mt.day, powerUp, factTest, studyGuideUrl }),
        });
      }

      // ─── B. Reading + Spelling Together Logic (1 week + 2 days) ─────────
      const readingTest = rows.find((r) => r.subject === 'Reading' && /test/i.test(r.type || ''));
      const spellingTest = rows.find((r) => r.subject === 'Spelling' && /test/i.test(r.type || ''));
      if (readingTest || spellingTest) {
        const rNum = readingTest?.lesson_num || '';
        const sNum = parseInt(spellingTest?.lesson_num || '0', 10) || 0;
        const testDay = readingTest?.day || spellingTest?.day || 'Friday';
        const dateStr = testDay;
        const spellingExp = sNum > 0
          ? expandSpellingTest(sNum, (config.spellingWordBank || {}) as Record<string, string[]>)
          : null;

        // Resolve fluency benchmark based on test number
        const fluencyBenchmark = getReadingFluencyBenchmark(
          rNum,
          config?.autoLogic.readingFluencyBenchmarks || {}
        );

        // Early announcement (1 week before)
        drafts.push({
          week_id: selectedWeekId,
          subject: 'Reading',
          type: 'test_reminder',
          status: 'DRAFT',
          course_id: TOGETHER_LOGIC_COURSE_ID,
          scheduled_post: getOneWeekBefore(testDay),
          title: `📚 Heads Up: Reading Mastery Test ${rNum} — ${dateStr}`,
          content: buildReadingSpellingHtml({
            testNum: rNum,
            testDate: dateStr,
            checkoutLesson: rNum,
            spellingFocus: spellingExp?.focusWords || [],
            spellingTestNum: sNum || null,
            isEarly: true,
            fluencyBenchmark,
          }),
        });

        // Urgent announcement (2 days before)
        drafts.push({
          week_id: selectedWeekId,
          subject: 'Reading',
          type: 'test_reminder',
          status: 'DRAFT',
          course_id: TOGETHER_LOGIC_COURSE_ID,
          scheduled_post: getTwoDaysBefore(testDay),
          title: `⚠️ Two Days Away: Reading & Spelling Tests`,
          content: buildReadingSpellingHtml({
            testNum: rNum,
            testDate: dateStr,
            checkoutLesson: rNum,
            spellingFocus: spellingExp?.focusWords || [],
            spellingTestNum: sNum || null,
            isEarly: false,
            fluencyBenchmark,
          }),
        });
      }

      // ─── C. Language Arts: Tests (1 week + 2 days) + Weekly Summary ─────
      const laTests = rows.filter((r) => r.subject === 'Language Arts' && /test/i.test(r.type || ''));
      const laRows = rows.filter((r) => r.subject === 'Language Arts');
      
      for (const lat of laTests) {
        // Early test announcement (1 week before)
        drafts.push({
          week_id: selectedWeekId,
          subject: 'Language Arts',
          type: 'test_reminder',
          status: 'DRAFT',
          course_id: getCourseId('Language Arts'),
          scheduled_post: getOneWeekBefore(lat.day),
          title: `✏️ Heads Up: Language Arts Test — ${lat.day}`,
          content: buildSubjectTestHtml('Language Arts', lat, weekLabel, true),
        });
        // Urgent test announcement (2 days before)
        drafts.push({
          week_id: selectedWeekId,
          subject: 'Language Arts',
          type: 'test_reminder',
          status: 'DRAFT',
          course_id: getCourseId('Language Arts'),
          scheduled_post: getTwoDaysBefore(lat.day),
          title: `⚠️ Two Days Away: Language Arts Test`,
          content: buildSubjectTestHtml('Language Arts', lat, weekLabel, false),
        });
      }

      // LA weekly summary (if content exists)
      if (laRows.length > 0) {
        drafts.push({
          week_id: selectedWeekId,
          subject: 'Language Arts',
          type: 'weekly_summary',
          status: 'DRAFT',
          course_id: getCourseId('Language Arts'),
          scheduled_post: getNextFriday4PM(),
          title: `✏️ Language Arts — ${weekLabel} Overview`,
          content: buildSubjectSummaryHtml('Language Arts', laRows, weekLabel),
        });
      }

      // ─── C2. History: Tests (1 week + 2 days) + Weekly Summary ─────────
      const histTests = rows.filter((r) => r.subject === 'History' && /test/i.test(r.type || ''));
      const histRows = rows.filter((r) => r.subject === 'History');
      
      for (const hst of histTests) {
        // Early test announcement (1 week before)
        drafts.push({
          week_id: selectedWeekId,
          subject: 'History',
          type: 'test_reminder',
          status: 'DRAFT',
          course_id: getCourseId('History'),
          scheduled_post: getOneWeekBefore(hst.day),
          title: `🏛️ Heads Up: History Test — ${hst.day}`,
          content: buildSubjectTestHtml('History', hst, weekLabel, true),
        });
        // Urgent test announcement (2 days before)
        drafts.push({
          week_id: selectedWeekId,
          subject: 'History',
          type: 'test_reminder',
          status: 'DRAFT',
          course_id: getCourseId('History'),
          scheduled_post: getTwoDaysBefore(hst.day),
          title: `⚠️ Two Days Away: History Test`,
          content: buildSubjectTestHtml('History', hst, weekLabel, false),
        });
      }

      // History weekly summary (if rows exist)
      if (histRows.length > 0) {
        drafts.push({
          week_id: selectedWeekId,
          subject: 'History',
          type: 'weekly_summary',
          status: 'DRAFT',
          course_id: getCourseId('History'),
          scheduled_post: getNextFriday4PM(),
          title: `🏛️ History — ${weekLabel} Overview`,
          content: buildSubjectSummaryHtml('History', histRows, weekLabel),
        });
      }

      // ─── C3. Science: Tests (1 week + 2 days) + Weekly Summary ────────
      const sciTests = rows.filter((r) => r.subject === 'Science' && /test/i.test(r.type || ''));
      const sciRows = rows.filter((r) => r.subject === 'Science');
      
      for (const sct of sciTests) {
        // Early test announcement (1 week before)
        drafts.push({
          week_id: selectedWeekId,
          subject: 'Science',
          type: 'test_reminder',
          status: 'DRAFT',
          course_id: getCourseId('Science'),
          scheduled_post: getOneWeekBefore(sct.day),
          title: `🔬 Heads Up: Science Test — ${sct.day}`,
          content: buildSubjectTestHtml('Science', sct, weekLabel, true),
        });
        // Urgent test announcement (2 days before)
        drafts.push({
          week_id: selectedWeekId,
          subject: 'Science',
          type: 'test_reminder',
          status: 'DRAFT',
          course_id: getCourseId('Science'),
          scheduled_post: getTwoDaysBefore(sct.day),
          title: `⚠️ Two Days Away: Science Test`,
          content: buildSubjectTestHtml('Science', sct, weekLabel, false),
        });
      }

      // Science weekly summary (if rows exist)
      if (sciRows.length > 0) {
        drafts.push({
          week_id: selectedWeekId,
          subject: 'Science',
          type: 'weekly_summary',
          status: 'DRAFT',
          course_id: getCourseId('Science'),
          scheduled_post: getNextFriday4PM(),
          title: `🔬 Science — ${weekLabel} Overview`,
          content: buildSubjectSummaryHtml('Science', sciRows, weekLabel),
        });
      }

      // ─── D. Homeroom Weekly Update ─────────────────────────────────────
      drafts.push({
        week_id: selectedWeekId,
        subject: 'Homeroom',
        type: 'weekly_summary',
        status: 'DRAFT',
        course_id: 22254,
        scheduled_post: getNextFriday4PM(),
        title: `🏠 Homeroom Weekly Update — ${weekLabel}`,
        content: buildHomeroomHtml(rows, weekLabel),
      });

      if (drafts.length === 0) {
        toast.info('No triggers matched this week');
        setGenerating(false);
        return;
      }

      const { error } = await supabase.from('announcements').insert(drafts);
      if (error) throw error;

      toast.success(`Auto-generated ${drafts.length} announcement(s)`);
      loadAnnouncements(selectedWeekId);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      toast.error('Auto-generate failed', { description: message });
    }
    setGenerating(false);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Reading Mastery Quick Create
  // ──────────────────────────────────────────────────────────────────────────
  const handleRMSubmit = async () => {
    if (!rmTestNum || !rmTestDate) {
      toast.error('Test number and date required');
      return;
    }
    try {
      const fluencyBenchmark = getReadingFluencyBenchmark(
        rmTestNum,
        config?.autoLogic.readingFluencyBenchmarks || {}
      );
      const html = buildReadingSpellingHtml({
        testNum: rmTestNum,
        testDate: rmTestDate,
        checkoutLesson: rmCheckoutLesson || rmTestNum,
        spellingFocus: [],
        spellingTestNum: null,
        fluencyBenchmark,
      });
      const { error } = await supabase.from('announcements').insert({
        week_id: selectedWeekId || null,
        subject: 'Reading',
        type: 'test_reminder',
        status: 'DRAFT',
        course_id: TOGETHER_LOGIC_COURSE_ID,
        scheduled_post: getNextFriday4PM(),
        title: `📚 Reading Mastery Test ${rmTestNum} and Fluency Checkout: ${rmTestDate}`,
        content: html,
      });
      if (error) throw error;
      toast.success('Reading Mastery draft created');
      setShowRM(false);
      setRmTestNum(''); setRmTestDate(''); setRmCheckoutLesson('');
      loadAnnouncements(selectedWeekId || undefined);
    } catch (e: any) {
      toast.error('Create failed', { description: e.message });
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Manual create / delete / post (preserved)
  // ──────────────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!formTitle || !formSubject) { toast.error('Title and subject required'); return; }
    try {
      const courseId = config?.courseIds[formSubject];
      const { error } = await supabase.from('announcements').insert({
        week_id: selectedWeekId || null,
        subject: formSubject,
        title: formTitle,
        content: formContent,
        type: formType,
        status: 'DRAFT',
        course_id: courseId || null,
        scheduled_post: getNextFriday4PM(),
      });
      if (error) throw error;
      toast.success('Announcement created');
      setShowForm(false);
      setFormTitle(''); setFormContent(''); setFormSubject('');
      loadAnnouncements(selectedWeekId || undefined);
    } catch (e: any) {
      toast.error('Create failed', { description: e.message });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      toast.success('Deleted');
    } catch (e: any) {
      toast.error('Delete failed', { description: e.message });
    }
  };

  const handlePost = async (ann: Announcement) => {
    if (!ann.course_id || !ann.title) { toast.error('Missing course ID or title'); return; }
    setPosting((p) => ({ ...p, [ann.id]: true }));
    try {
      await callEdge('canvas-post-announcement', {
        courseId: ann.course_id,
        title: ann.title,
        message: ann.content || '',
        delayedPostAt: ann.scheduled_post || undefined,
        weekId: ann.week_id,
        subject: ann.subject,
      });
      await supabase.from('announcements').update({ status: 'POSTED', posted_at: new Date().toISOString() }).eq('id', ann.id);
      void logEdit('announcement', ann.id, null, ann as never, 'deploy');
      void learnFromEdit('announcement', null, ann as never);
      void logDeployHabit(ann.subject || 'Announcement');
      toast.success(`Posted: ${ann.title}`);
      loadAnnouncements(selectedWeekId || undefined);
    } catch (e: any) {
      toast.error('Post failed', { description: e.message });
    }
    setPosting((p) => ({ ...p, [ann.id]: false }));
  };

  const handlePostAll = async () => {
    const drafts = announcements.filter((a) => a.status === 'DRAFT');
    if (drafts.length === 0) { toast.info('No drafts to post'); return; }
    setPostingAll(true);
    const toastId = toast.loading(`Posting 0/${drafts.length} announcements…`);
    let done = 0;
    let errors = 0;
    for (const ann of drafts) {
      toast.loading(`Posting "${ann.title}" (${done + 1}/${drafts.length})…`, { id: toastId });
      try { await handlePost(ann); } catch { errors++; }
      done++;
    }
    if (errors > 0) toast.warning(`Posted ${done - errors}/${drafts.length} (${errors} failed)`, { id: toastId });
    else toast.success(`All ${drafts.length} announcements posted! ✅`, { id: toastId });
    setPostingAll(false);
  };

  const draftCount = announcements.filter((a) => a.status === 'DRAFT').length;
  const postedCount = announcements.filter((a) => a.status === 'POSTED').length;

  const statusColor = (s: string | null) => {
    if (s === 'POSTED') return 'bg-success text-success-foreground';
    if (s === 'ERROR') return 'bg-destructive text-destructive-foreground';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Announcement Center</h1>
          <p className="text-muted-foreground mt-1">Create, auto-generate, and post announcements to Canvas</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {draftCount > 0 && (
            <Badge variant="outline" className="text-xs gap-1">
              <Clock className="h-3 w-3" /> {draftCount} draft{draftCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {postedCount > 0 && (
            <Badge className="text-xs bg-success/10 text-success border-success/20 gap-1">
              <CheckCircle2 className="h-3 w-3" /> {postedCount} posted
            </Badge>
          )}
          <Select value={selectedWeekId || '__all__'} onValueChange={(v) => setSelectedWeekId(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All weeks" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All weeks</SelectItem>
              {weeks.map((w) => <SelectItem key={w.id} value={w.id}>{w.quarter} Wk {w.week_num}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleAutoGenerate} disabled={generating} className="gap-1.5">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Auto-Generate
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowRM(true)} className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Reading Mastery
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
          <Button size="sm" onClick={handlePostAll} disabled={postingAll || draftCount === 0} className="gap-1.5">
            {postingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {postingAll ? 'Posting…' : 'Post All Drafts'}
          </Button>
        </div>
      </div>

      {/* Reading Mastery quick-create dialog */}
      <Dialog open={showRM} onOpenChange={setShowRM}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reading Mastery Quick Create</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Test Number</Label>
              <Input value={rmTestNum} onChange={(e) => setRmTestNum(e.target.value)} placeholder="e.g. 12" />
            </div>
            <div>
              <Label>Test Date</Label>
              <Input value={rmTestDate} onChange={(e) => setRmTestDate(e.target.value)} placeholder="e.g. Friday, Oct 18" />
            </div>
            <div>
              <Label>Checkout Passage Lesson</Label>
              <Input value={rmCheckoutLesson} onChange={(e) => setRmCheckoutLesson(e.target.value)} placeholder="defaults to test number" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRM(false)}>Cancel</Button>
            <Button onClick={handleRMSubmit}>Create Draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showForm && (
        <Card className="border-primary/20 shadow-md">
          <CardContent className="pt-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Select value={formSubject} onValueChange={setFormSubject}>
                <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="test_reminder">Test Reminder</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="homework">Homework</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            <Textarea placeholder="Message body..." value={formContent} onChange={(e) => setFormContent(e.target.value)} rows={3} />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate}>Create</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {loading ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading announcements...
          </CardContent></Card>
        ) : announcements.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No announcements yet. Auto-generate from test data or create manually.</p>
          </CardContent></Card>
        ) : announcements.map((ann) => {
          const borderClass = SUBJECT_BORDER[ann.subject || ''] || 'border-l-muted';
          return (
            <Card key={ann.id} className={`transition-all border-l-4 ${borderClass} ${ann.status === 'POSTED' ? 'opacity-70' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-primary" />
                    {ann.title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{ann.subject}</Badge>
                    <Badge className={`text-xs ${statusColor(ann.status)}`}>{ann.status}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground line-clamp-3" dangerouslySetInnerHTML={{ __html: ann.content || '' }} />
                {ann.status === 'DRAFT' && ann.scheduled_post && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Scheduled: {formatScheduled(ann.scheduled_post)}
                  </p>
                )}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {ann.scheduled_post ? new Date(ann.scheduled_post).toLocaleString() : 'Not scheduled'}
                    </span>
                    {ann.posted_at && <span className="text-success">Posted {new Date(ann.posted_at).toLocaleString()}</span>}
                  </div>
                  <div className="flex gap-2">
                    {ann.status === 'DRAFT' && (
                      <Button size="sm" variant="outline" onClick={() => handlePost(ann)} disabled={posting[ann.id]} className="gap-1 text-xs">
                        {posting[ann.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        Post
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(ann.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// PART 2: HTML Template Builders (Canvas + Cidi Labs DesignPlus safe)
// ────────────────────────────────────────────────────────────────────────────
function wrapper(subject: string, inner: string): string {
  const color = SUBJECT_HEX[subject] || '#475569';
  return `<div class="kl_wrapper" style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;border-top:6px solid ${color};padding:16px;background:#ffffff;">${inner}</div>`;
}
function banner(subject: string, title: string): string {
  const color = SUBJECT_HEX[subject] || '#475569';
  return `<div class="kl_banner" style="background:${color};color:#fff;padding:14px 18px;border-radius:6px;margin-bottom:16px;"><h2 style="margin:0;font-size:20px;">${title}</h2></div>`;
}

interface MathArgs { lesson: string; day: string; powerUp: string; factTest: string; studyGuideUrl: string; weekLabel?: string; }

function buildMathEarlyHtml(a: MathArgs): string {
  const link = a.studyGuideUrl
    ? `<p><a href="${a.studyGuideUrl}" style="color:#ea580c;font-weight:600;">📄 Study Guide</a></p>`
    : '';
  return wrapper('Math', `
    ${banner('Math', `Math Test Coming Up — Lesson ${a.lesson}`)}
    <p>Hi parents, a heads up that <strong>Math Test ${a.lesson}</strong> is scheduled for <strong>${a.day}</strong>.</p>
    <ul>
      <li><strong>Power Up:</strong> ${a.powerUp || '—'}</li>
      <li><strong>Fact Test:</strong> ${a.factTest}</li>
    </ul>
    ${link}
    <p>Please review the study guide together this weekend so students walk in confident.</p>
  `);
}

function buildMathUrgentHtml(a: MathArgs): string {
  const link = a.studyGuideUrl
    ? `<p><a href="${a.studyGuideUrl}" style="color:#ea580c;font-weight:600;">📄 Study Guide</a></p>`
    : '';
  return wrapper('Math', `
    ${banner('Math', `⚠️ Math Test ${a.lesson} — ${a.day}`)}
    <p><strong>Quick reminder:</strong> the Math Test is just a couple days away.</p>
    <ul>
      <li><strong>Power Up:</strong> ${a.powerUp || '—'}</li>
      <li><strong>Fact Test:</strong> ${a.factTest}</li>
    </ul>
    ${link}
    <p>Tonight is a great night for one focused review pass.</p>
  `);
}

interface RSArgs {
  testNum: string;
  testDate: string;
  checkoutLesson: string;
  spellingFocus: string[];
  spellingTestNum: number | null;
  isEarly?: boolean;
  fluencyBenchmark?: { wpm: number; errors: number; label: string };
}

function buildReadingSpellingHtml(a: RSArgs): string {
  const spellingBlock = a.spellingTestNum && a.spellingFocus.length
    ? `
      <h3 style="color:#2563eb;margin-top:20px;">Spelling Test ${a.spellingTestNum}</h3>
      <p><strong>Focus Words (21–25):</strong> ${a.spellingFocus.join(', ')}</p>
    `
    : '';
  
  const greeting = a.isEarly
    ? `<p>Good afternoon! Tests are coming up on <strong>${a.testDate}</strong>.</p>`
    : `<p>Reminder: Reading & Spelling tests are <strong>this week</strong> on <strong>${a.testDate}</strong>. Make final preparations!</p>`;

  const fluencyLabel = a.fluencyBenchmark?.label || '100 words per minute with 2 or fewer errors';

  return wrapper('Reading', `
    ${banner('Reading', `Reading Mastery Test ${a.testNum} — ${a.testDate}`)}
    ${greeting}
    <p>The mastery test will cover story details, background information, and vocabulary from our recent lessons. Students will also be reading a timed fluency passage.</p>
    <p><strong>Fluency goal:</strong> The goal of this fluency check is to read ${fluencyLabel}.</p>
    <p>Make sure they are tracking and tapping so they do not miss any words or skip lines. Practice reading with your child every day, especially out loud.</p>
    <p>For practice, the checkout passage will come from lesson ${a.checkoutLesson}, reading up to the flower.</p>
    ${spellingBlock}
  `);
}

function buildSubjectSummaryHtml(subject: string, rows: PacingRow[], weekLabel: string): string {
  const items = rows
    .filter((r) => r.in_class)
    .map((r) => `<li><strong>${r.day}:</strong> ${escapeHtml(r.in_class || '')}${r.at_home ? ` <em>(at home: ${escapeHtml(r.at_home)})</em>` : ''}</li>`)
    .join('');
  return wrapper(subject, `
    ${banner(subject, `${subject} — ${weekLabel}`)}
    <p>Here is what we are covering in ${subject} this week:</p>
    <ul>${items || '<li>Continued practice from prior lessons.</li>'}</ul>
  `);
}

function buildSubjectTestHtml(subject: string, row: PacingRow, weekLabel: string, isEarly: boolean): string {
  const greeting = isEarly
    ? `<p>Good afternoon! A <strong>${subject} test</strong> is coming up on <strong>${row.day}</strong>.</p>`
    : `<p>Reminder: <strong>${subject} test</strong> is <strong>coming up soon on ${row.day}</strong>. Make final preparations!</p>`;
  
  const lessonInfo = row.lesson_num
    ? `<p><strong>Lesson/Topic:</strong> ${escapeHtml(row.lesson_num)}</p>`
    : '';
  
  const inClassInfo = row.in_class
    ? `<p><strong>Content focus:</strong> ${escapeHtml(row.in_class)}</p>`
    : '';
  
  const homeInfo = row.at_home
    ? `<p><strong>Study at home:</strong> ${escapeHtml(row.at_home)}</p>`
    : '';

  return wrapper(subject, `
    ${banner(subject, `${subject} Test — ${row.day}`)}
    ${greeting}
    ${lessonInfo}
    ${inClassInfo}
    ${homeInfo}
    <p>Please help your child prepare by reviewing materials together this week.</p>
  `);
}

function buildHomeroomHtml(rows: PacingRow[], weekLabel: string): string {
  const subjects = Array.from(new Set(rows.map((r) => r.subject))).filter(Boolean);
  const sections = subjects.map((sub) => {
    const subRows = rows.filter((r) => r.subject === sub && r.in_class);
    if (subRows.length === 0) return '';
    const color = SUBJECT_HEX[sub] || '#475569';
    const lis = subRows.map((r) => `<li><strong>${r.day}:</strong> ${escapeHtml(r.in_class || '')}</li>`).join('');
    return `<h3 style="color:${color};margin-top:18px;border-bottom:2px solid ${color};padding-bottom:4px;">${sub}</h3><ul>${lis}</ul>`;
  }).join('');
  return wrapper('Homeroom', `
    ${banner('Homeroom', `Homeroom Weekly Update — ${weekLabel}`)}
    <p>Here is a quick look at what each subject is doing this week.</p>
    ${sections}
    <p style="margin-top:18px;">As always, reach out anytime with questions.</p>
  `);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

function formatScheduled(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  });
}
