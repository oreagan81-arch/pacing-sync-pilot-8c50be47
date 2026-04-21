import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Megaphone, Plus, BookOpen, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useConfig } from '@/lib/config';
import { callEdge } from '@/lib/edge';
import { useRealtimeDeploy } from '@/hooks/use-realtime-deploy';
import { expandSpellingTest } from '@/lib/together-logic';
import { getReadingFluencyBenchmark } from '@/lib/reading-fluency';
import { getNextFriday4PM } from '../../supabase/functions/_shared/date-utils';
import AnnouncementTable from '@/components/announcements/AnnouncementTable';
import AnnouncementForm from '@/components/announcements/AnnouncementForm';

// Assuming these types are moved to a central types file
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
  
const TOGETHER_LOGIC_COURSE_ID = 22254; // Replace with your actual course ID

const getCourseId = (subject: string, config: any) => {
    if (config && config.courseIds) {
      return config.courseIds[subject];
    }
    return null;
  };
  

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
    if (data) setAnnouncements(data as Announcement[]);
    setLoading(false);
  };

  useEffect(() => {
    loadAnnouncements(selectedWeekId || undefined);
  }, [selectedWeekId]);

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

      // Logic for auto-generating announcements would go here...

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
    //   const html = buildReadingSpellingHtml({
    //     testNum: rmTestNum,
    //     testDate: rmTestDate,
    //     checkoutLesson: rmCheckoutLesson || rmTestNum,
    //     spellingFocus: [],
    //     spellingTestNum: null,
    //     fluencyBenchmark,
    //   });
      const { error } = await supabase.from('announcements').insert({
        week_id: selectedWeekId || null,
        subject: 'Reading',
        type: 'test_reminder',
        status: 'DRAFT',
        course_id: TOGETHER_LOGIC_COURSE_ID,
        scheduled_post: getNextFriday4PM(),
        title: `📚 Reading Mastery Test ${rmTestNum} and Fluency Checkout: ${rmTestDate}`,
        content: "html",
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

  const handleCreate = async () => {
    if (!formTitle || !formSubject) { toast.error('Title and subject required'); return; }
    try {
      const courseId = getCourseId(formSubject, config);
      const { error } = await supabase.from('announcements').insert({
        week_id: selectedWeekId || null,
        subject: formSubject,
        title: formTitle,
        content: formContent,
        type: formType,
        status: 'DRAFT',
        course_id: courseId,
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
        message: ann.content,
      });
      await supabase.from('announcements').update({ status: 'POSTED', posted_at: new Date().toISOString() }).eq('id', ann.id);
      toast.success('Announcement posted!');
      setAnnouncements(prev => prev.map(a => a.id === ann.id ? { ...a, status: 'POSTED' } : a));
    } catch (e: any) {
      toast.error('Post failed', { description: e.message });
    }
    setPosting((p) => ({ ...p, [ann.id]: false }));
  };
  
  const handlePostAll = async () => {
    const draftsToPost = announcements.filter(a => a.status === 'DRAFT');
    if (draftsToPost.length === 0) {
      toast.info('No drafts to post.');
      return;
    }
    setPostingAll(true);
    for (const ann of draftsToPost) {
      await handlePost(ann);
    }
    setPostingAll(false);
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center"><Megaphone className="mr-3" /> Announcement Center</h1>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setShowRM(true)} variant="outline"><BookOpen className="mr-2 h-4 w-4" /> Quick RM</Button>
          <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> New Announcement</Button>
          <Button onClick={handleAutoGenerate} disabled={generating || !selectedWeekId}>
            {generating ? <Loader2 className="animate-spin mr-2" /> : <Megaphone className="mr-2 h-4 w-4" />}
            Auto-Generate For Week
          </Button>
          <Button onClick={handlePostAll} disabled={postingAll}>
            {postingAll ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2 h-4 w-4" />}
            Post All Drafts
          </Button>
        </div>
      </div>
      
      <AnnouncementTable
        announcements={announcements}
        loading={loading}
        posting={posting}
        weeks={weeks}
        selectedWeekId={selectedWeekId}
        onWeekChange={setSelectedWeekId}
        onDelete={handleDelete}
        onPost={handlePost}
        onRefresh={() => loadAnnouncements(selectedWeekId)}
      />

      <AnnouncementForm
        showForm={showForm}
        onShowFormChange={setShowForm}
        formSubject={formSubject}
        onFormSubjectChange={setFormSubject}
        formTitle={formTitle}
        onFormTitleChange={setFormTitle}
        formContent={formContent}
        onFormContentChange={setFormContent}
        formType={formType}
        onFormTypeChange={setFormType}
        onCreate={handleCreate}
      />
      
      <Dialog open={showRM} onOpenChange={setShowRM}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick-Create Reading Mastery Test</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rm-test-num" className="text-right">Test Lesson #</Label>
              <Input id="rm-test-num" value={rmTestNum} onChange={(e) => setRmTestNum(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rm-test-date" className="text-right">Test Date</Label>
              <Input id="rm-test-date" value={rmTestDate} onChange={(e) => setRmTestDate(e.target.value)} className="col-span-3" placeholder="e.g., Friday, Sept 8" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rm-checkout-lesson" className="text-right">Checkout Lesson #</Label>
              <Input id="rm-checkout-lesson" value={rmCheckoutLesson} onChange={(e) => setRmCheckoutLesson(e.target.value)} className="col-span-3" placeholder="Defaults to Test #" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleRMSubmit}><Plus className="mr-2 h-4 w-4" /> Create Draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
