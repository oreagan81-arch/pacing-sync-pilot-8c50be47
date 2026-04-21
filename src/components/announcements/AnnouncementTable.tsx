import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Megaphone, Clock, Send, Trash2, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';

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
}

interface WeekOption {
  id: string;
  quarter: string;
  week_num: number;
}

const SUBJECT_BORDER: Record<string, string> = {
  Math: 'border-l-orange-500',
  Reading: 'border-l-blue-500',
  Spelling: 'border-l-blue-500',
  'Language Arts': 'border-l-emerald-500',
  Science: 'border-l-purple-500',
  History: 'border-l-sky-500',
  Homeroom: 'border-l-primary',
};

interface AnnouncementTableProps {
  announcements: Announcement[];
  loading: boolean;
  posting: Record<string, boolean>;
  weeks: WeekOption[];
  selectedWeekId: string;
  onWeekChange: (weekId: string) => void;
  onDelete: (id: string) => void;
  onPost: (announcement: Announcement) => void;
  onRefresh: () => void;
}

const AnnouncementTable: React.FC<AnnouncementTableProps> = ({
  announcements,
  loading,
  posting,
  weeks,
  selectedWeekId,
  onWeekChange,
  onDelete,
  onPost,
  onRefresh,
}) => {
  const getWeekLabel = (weekId: string | null) => {
    if (!weekId) return 'N/A';
    const week = weeks.find((w) => w.id === weekId);
    return week ? `${week.quarter} W${week.week_num}` : 'N/A';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center space-x-4">
          <CardTitle>Generated Announcements</CardTitle>
          {loading && <Loader2 className="animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center space-x-2">
          <Select value={selectedWeekId} onValueChange={onWeekChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by week" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Weeks</SelectItem>
              {weeks.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.quarter} Wk {w.week_num}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={onRefresh} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {announcements.map((ann) => (
            <div
              key={ann.id}
              className={`flex items-start justify-between p-4 rounded-lg border-l-4 ${
                SUBJECT_BORDER[ann.subject || ''] || 'border-l-gray-400'
              } bg-muted/20`}
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-3">
                  <h3 className="font-semibold text-lg">{ann.title}</h3>
                  <Badge variant="outline">{ann.subject}</Badge>
                  <Badge variant="secondary">{ann.type}</Badge>
                  <Badge variant="outline">{getWeekLabel(ann.week_id)}</Badge>
                </div>
                <div
                  className="prose prose-sm max-w-none text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: ann.content || '' }}
                />
                <div className="flex items-center space-x-4 text-xs text-muted-foreground pt-2">
                  {ann.status === 'DRAFT' && ann.scheduled_post && (
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>Scheduled: {new Date(ann.scheduled_post).toLocaleString()}</span>
                    </div>
                  )}
                  {ann.status === 'POSTED' && ann.posted_at && (
                    <div className="flex items-center space-x-1 text-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Posted: {new Date(ann.posted_at).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end space-y-2 ml-4">
                {ann.status === 'DRAFT' ? (
                  <Button size="sm" onClick={() => onPost(ann)} disabled={posting[ann.id]}>
                    {posting[ann.id] ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2 h-4 w-4" />}
                    Post Now
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" disabled>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Posted
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => onDelete(ann.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AnnouncementTable;
