import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

const SUBJECTS = ['Math', 'Reading', 'Spelling', 'Language Arts', 'History', 'Science'] as const;

interface AnnouncementFormProps {
  showForm: boolean;
  onShowFormChange: (show: boolean) => void;
  formSubject: string;
  onFormSubjectChange: (subject: string) => void;
  formTitle: string;
  onFormTitleChange: (title: string) => void;
  formContent: string;
  onFormContentChange: (content: string) => void;
  formType: string;
  onFormTypeChange: (type: string) => void;
  onCreate: () => void;
}

const AnnouncementForm: React.FC<AnnouncementFormProps> = ({
  showForm,
  onShowFormChange,
  formSubject,
  onFormSubjectChange,
  formTitle,
  onFormTitleChange,
  formContent,
  onFormContentChange,
  formType,
  onFormTypeChange,
  onCreate,
}) => {
  return (
    <Dialog open={showForm} onOpenChange={onShowFormChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Manual Announcement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">Title</Label>
            <Input id="title" value={formTitle} onChange={(e) => onFormTitleChange(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="subject" className="text-right">Subject</Label>
            <Select value={formSubject} onValueChange={onFormSubjectChange}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">Type</Label>
            <Select value={formType} onValueChange={onFormTypeChange}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="test_reminder">Test Reminder</SelectItem>
                <SelectItem value="weekly_summary">Weekly Summary</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="content" className="text-right pt-2">Content (HTML)</Label>
            <Textarea id="content" value={formContent} onChange={(e) => onFormContentChange(e.target.value)} className="col-span-3" rows={8} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onCreate}><Plus className="mr-2 h-4 w-4" /> Create Draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AnnouncementForm;
