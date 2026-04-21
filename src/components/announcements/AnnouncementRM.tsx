import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getReadingFluencyBenchmark } from '@/lib/reading-fluency';
import { getNextFriday4PM } from '@/lib/date-utils';
import type { AppConfig } from '@/lib/config';

interface AnnouncementRMProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedWeekId: string | null;
  config: AppConfig | null;
  onSuccess?: () => void;
}

const TOGETHER_LOGIC_COURSE_ID = 22254;

export default function AnnouncementRM({
  open,
  onOpenChange,
  selectedWeekId,
  config,
  onSuccess,
}: AnnouncementRMProps) {
  const [testNum, setTestNum] = useState('');
  const [testDate, setTestDate] = useState('');
  const [checkoutLesson, setCheckoutLesson] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!testNum || !testDate) {
      toast.error('Test number and date required');
      return;
    }

    setLoading(true);
    try {
      const fluencyBenchmark = getReadingFluencyBenchmark(
        testNum,
        config?.autoLogic?.readingFluencyBenchmarks || {}
      );

      const { error } = await supabase.from('announcements').insert({
        week_id: selectedWeekId || null,
        subject: 'Reading',
        type: 'test_reminder',
        status: 'DRAFT',
        course_id: TOGETHER_LOGIC_COURSE_ID,
        scheduled_post: getNextFriday4PM(),
        title: `📚 Reading Mastery Test ${testNum} and Fluency Checkout: ${testDate}`,
        content: `Test number: ${testNum}, Date: ${testDate}, Benchmark: ${fluencyBenchmark}`,
      });

      if (error) throw error;

      toast.success('Reading Mastery draft created');
      setTestNum('');
      setTestDate('');
      setCheckoutLesson('');
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error('Create failed', { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [testNum, testDate, config, selectedWeekId, onOpenChange, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick-Create Reading Mastery Test</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="rm-test-num" className="text-right">
              Test Lesson #
            </Label>
            <Input
              id="rm-test-num"
              value={testNum}
              onChange={(e) => setTestNum(e.target.value)}
              className="col-span-3"
              placeholder="e.g., 42"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="rm-test-date" className="text-right">
              Test Date
            </Label>
            <Input
              id="rm-test-date"
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
              className="col-span-3"
              placeholder="e.g., Friday, Sept 8"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="rm-checkout-lesson" className="text-right">
              Checkout Lesson #
            </Label>
            <Input
              id="rm-checkout-lesson"
              value={checkoutLesson}
              onChange={(e) => setCheckoutLesson(e.target.value)}
              className="col-span-3"
              placeholder="Defaults to Test #"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading}>
            <Plus className="mr-2 h-4 w-4" />
            {loading ? 'Creating...' : 'Create Draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
