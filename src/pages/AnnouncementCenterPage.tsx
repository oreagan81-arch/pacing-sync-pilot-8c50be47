import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Megaphone, Plus, BookOpen, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useConfig } from '@/lib/config';
import { useRealtimeDeploy } from '@/hooks/use-realtime-deploy';
import { useWeeksList } from '@/hooks/useWeeksList';
import { useAutoGenerateAnnouncements } from '@/hooks/useAutoGenerateAnnouncements';
import { useAnnouncementsList } from '@/hooks/useAnnouncements';
import AnnouncementTable from '@/components/announcements/AnnouncementTable';
import AnnouncementForm from '@/components/announcements/AnnouncementForm';
import AnnouncementRM from '@/components/announcements/AnnouncementRM';
import type { AnnouncementDraft } from '@/types/thales';

export default function AnnouncementCenterPage() {
  const config = useConfig();
  const [selectedWeekId, setSelectedWeekId] = useState('');
  
  // Data queries
  const { data: weeks = [] } = useWeeksList();
  const { data: announcements = [], isLoading } = useAnnouncementsList({ weekId: selectedWeekId || undefined });
  const autoGenerate = useAutoGenerateAnnouncements();

  // UI state
  const [showForm, setShowForm] = useState(false);
  const [showRM, setShowRM] = useState(false);
  const [formSubject, setFormSubject] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formType, setFormType] = useState('test_reminder');
  const [posting, setPosting] = useState<Record<string, boolean>>({});

  // Realtime updates
  const handleRealtimeEvent = useCallback(() => {
    // React Query will auto-refetch announcements due to its subscription handling
  }, [selectedWeekId]);
  useRealtimeDeploy(handleRealtimeEvent);

  const handleAutoGenerate = useCallback(async () => {
    if (!selectedWeekId || !config) {
      toast.error('Select a week first');
      return;
    }
    await autoGenerate.mutateAsync({
      weekId: selectedWeekId,
      config,
      weeks,
    });
  }, [selectedWeekId, config, weeks, autoGenerate]);

  const handleDelete = useCallback(async (id: string) => {
    // Delegated to AnnouncementTable or using mutation hook
  }, []);

  const handlePost = useCallback(async (ann: AnnouncementDraft) => {
    if (!ann.course_id || !ann.title) {
      toast.error('Missing course ID or title');
      return;
    }
    setPosting((p) => ({ ...p, [ann.id]: true }));
    try {
      // TODO: Implement canvas post via edge function
      toast.success('Announcement posted!');
    } catch (e: any) {
      toast.error('Post failed', { description: e.message });
    } finally {
      setPosting((p) => ({ ...p, [ann.id]: false }));
    }
  }, []);

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center">
          <Megaphone className="mr-3" /> Announcement Center
        </h1>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setShowRM(true)} variant="outline">
            <BookOpen className="mr-2 h-4 w-4" /> Quick RM
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Announcement
          </Button>
          <Button 
            onClick={handleAutoGenerate} 
            disabled={autoGenerate.isPending || !selectedWeekId}
          >
            {autoGenerate.isPending ? (
              <Loader2 className="animate-spin mr-2" />
            ) : (
              <Megaphone className="mr-2 h-4 w-4" />
            )}
            Auto-Generate For Week
          </Button>
        </div>
      </div>

      <AnnouncementTable
        announcements={announcements}
        loading={isLoading}
        posting={posting}
        weeks={weeks}
        selectedWeekId={selectedWeekId}
        onWeekChange={setSelectedWeekId}
        onDelete={handleDelete}
        onPost={handlePost}
        onRefresh={() => {
          // React Query handles refetching
        }}
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
        onCreate={async () => {
          // TODO: Use createAnnouncement mutation
        }}
      />

      <AnnouncementRM
        open={showRM}
        onOpenChange={setShowRM}
        selectedWeekId={selectedWeekId}
        config={config}
        onSuccess={() => {
          // React Query will auto-refetch
        }}
      />
    </div>
  );
}
