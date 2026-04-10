import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Rocket, ExternalLink, ClipboardList, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useConfig } from '@/lib/config';
import { generateAssignmentTitle, resolveAssignmentGroup } from '@/lib/assignment-logic';
import { callEdge } from '@/lib/edge';

interface PacingRow {
  id: string;
  week_id: string;
  subject: string;
  day: string;
  type: string | null;
  lesson_num: string | null;
  in_class: string | null;
  at_home: string | null;
  resources: string | null;
  create_assign: boolean | null;
  object_id: string | null;
  canvas_assignment_id: string | null;
  canvas_url: string | null;
  deploy_status: string | null;
}

interface WeekOption {
  id: string;
  quarter: string;
  week_num: number;
  date_range: string | null;
}

interface AssignmentRow extends PacingRow {
  title: string;
  groupName: string;
  points: number;
  gradingType: string;
  omitFromFinal?: boolean;
  editingTitle: boolean;
  customTitle: string;
}

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function AssignmentsPage() {
  const config = useConfig();
  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [selectedWeek, setSelectedWeek] = useState<WeekOption | null>(null);
  const [rawRows, setRawRows] = useState<PacingRow[]>([]);
  const [deploying, setDeploying] = useState<Record<string, boolean>>({});
  const [deployingAll, setDeployingAll] = useState(false);
  const [editingTitles, setEditingTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from('weeks').select('id, quarter, week_num, date_range').order('quarter').order('week_num').then(({ data }) => {
      if (data) setWeeks(data);
    });
  }, []);

  useEffect(() => {
    if (!selectedWeekId) return;
    setSelectedWeek(weeks.find((w) => w.id === selectedWeekId) || null);

    supabase.from('pacing_rows').select('*').eq('week_id', selectedWeekId).then(({ data }) => {
      if (data) setRawRows(data as PacingRow[]);
    });
  }, [selectedWeekId, weeks]);

  // Build assignment rows with auto-generated titles
  const assignmentRows: AssignmentRow[] = useMemo(() => {
    if (!config) return [];
    const result: AssignmentRow[] = [];

    for (const row of rawRows) {
      if (!row.type || row.type === '-' || row.type === 'X' || row.type === 'No Class') continue;

      const isNoAssign = config.autoLogic.historyScienceNoAssign && (row.subject === 'History' || row.subject === 'Science');
      const isFriday = row.day === 'Friday';
      const shouldCreate = row.create_assign && !isNoAssign && !isFriday;

      if (!shouldCreate) {
        // Still show as grayed out
        result.push({
          ...row,
          title: '—',
          groupName: '—',
          points: 0,
          gradingType: '—',
          editingTitle: false,
          customTitle: '',
        });
        continue;
      }

      const prefix = config.assignmentPrefixes[row.subject] || '';
      const group = resolveAssignmentGroup(row.subject, row.type || 'Lesson');

      // Math Test auto-triples
      if (row.subject === 'Math' && row.type === 'Test' && config.autoLogic.mathTestTriple) {
        // Test
        result.push({
          ...row,
          title: generateAssignmentTitle('Math', 'Test', row.lesson_num, prefix),
          ...resolveAssignmentGroup('Math', 'Test'),
          editingTitle: false,
          customTitle: '',
        });
        // Fact Test
        result.push({
          ...row,
          id: `${row.id}-fact`,
          title: generateAssignmentTitle('Math', 'Fact Test', row.lesson_num, prefix),
          ...resolveAssignmentGroup('Math', 'Fact Test'),
          editingTitle: false,
          customTitle: '',
        });
        // Study Guide
        result.push({
          ...row,
          id: `${row.id}-sg`,
          title: generateAssignmentTitle('Math', 'Study Guide', row.lesson_num, prefix),
          ...resolveAssignmentGroup('Math', 'Study Guide'),
          editingTitle: false,
          customTitle: '',
        });
        continue;
      }

      result.push({
        ...row,
        title: generateAssignmentTitle(row.subject, row.type || 'Lesson', row.lesson_num, prefix),
        ...group,
        editingTitle: false,
        customTitle: '',
      });
    }

    // Sort by day order then subject
    result.sort((a, b) => {
      const dayDiff = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return a.subject.localeCompare(b.subject);
    });

    return result;
  }, [rawRows, config]);

  const pendingRows = assignmentRows.filter(
    (r) => r.points > 0 && r.deploy_status !== 'DEPLOYED' && r.title !== '—'
  );

  const getDisplayTitle = (row: AssignmentRow) => editingTitles[row.id] ?? row.title;

  // Deploy single assignment
  const handleDeploy = async (row: AssignmentRow) => {
    if (!config || !selectedWeek) return;
    const courseId = config.courseIds[row.subject];
    if (!courseId) {
      toast.error(`No course ID for ${row.subject}`);
      return;
    }

    const title = getDisplayTitle(row);
    const realRowId = row.id.includes('-') ? row.id.split('-')[0] : row.id;

    setDeploying((p) => ({ ...p, [row.id]: true }));
    const toastId = toast.loading(`Creating: ${title}\u2026`);

    try {
      const result = await callEdge<{ status: string; assignmentId?: string; canvasUrl?: string }>(
        'canvas-deploy-assignment',
        {
          subject: row.subject,
          courseId,
          title,
          description: row.at_home || '',
          points: row.points,
          gradingType: row.gradingType,
          assignmentGroup: row.groupName,
          dueDate: null, // Would come from date_range parsing
          existingId: row.canvas_assignment_id || null,
          rowId: realRowId,
          weekId: selectedWeek.id,
          omitFromFinal: row.omitFromFinal || false,
        }
      );

      toast.success('Assignment created!', {
        id: toastId,
        action: result.canvasUrl
          ? { label: 'Open', onClick: () => window.open(result.canvasUrl, '_blank') }
          : undefined,
      });

      // Refresh rows
      const { data } = await supabase.from('pacing_rows').select('*').eq('week_id', selectedWeekId);
      if (data) setRawRows(data as PacingRow[]);
    } catch (e: any) {
      toast.error('Deploy failed', { id: toastId, description: e.message });
    }
    setDeploying((p) => ({ ...p, [row.id]: false }));
  };

  // Deploy all pending
  const handleDeployAll = async () => {
    setDeployingAll(true);
    const toastId = toast.loading(`Deploying ${pendingRows.length} assignments\u2026`);
    let done = 0;
    for (const row of pendingRows) {
      done++;
      toast.loading(`Deploying (${done}/${pendingRows.length})\u2026`, { id: toastId });
      await handleDeploy(row);
    }
    toast.success(`All ${pendingRows.length} assignments deployed!`, { id: toastId });
    setDeployingAll(false);
  };

  const statusBadge = (status: string | null) => {
    switch (status) {
      case 'DEPLOYED':
        return <Badge className="text-[10px] bg-success text-success-foreground">DEPLOYED</Badge>;
      case 'ERROR':
        return <Badge variant="destructive" className="text-[10px]">ERROR</Badge>;
      case 'NO_CHANGE':
        return <Badge variant="secondary" className="text-[10px]">NO CHANGE</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">PENDING</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedWeekId} onValueChange={setSelectedWeekId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select a week\u2026" />
          </SelectTrigger>
          <SelectContent>
            {weeks.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.quarter} Week {w.week_num}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedWeek && (
          <span className="text-sm text-muted-foreground">{selectedWeek.date_range}</span>
        )}

        <div className="ml-auto flex gap-2">
          {pendingRows.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {pendingRows.length} pending
            </Badge>
          )}
          <Button
            variant="deploy"
            size="sm"
            onClick={handleDeployAll}
            disabled={deployingAll || pendingRows.length === 0}
            className="gap-1.5"
          >
            <Rocket className="h-3.5 w-3.5" />
            Deploy All Pending
          </Button>
        </div>
      </div>

      {!selectedWeekId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Select a saved week to review and deploy assignments.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Subject</TableHead>
                    <TableHead className="text-xs">Day</TableHead>
                    <TableHead className="text-xs">Title</TableHead>
                    <TableHead className="text-xs">Group</TableHead>
                    <TableHead className="text-xs text-center">Points</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignmentRows.map((row) => {
                    const isDisabled = row.title === '—';
                    const isEditing = editingTitles[row.id] !== undefined;
                    return (
                      <TableRow
                        key={row.id}
                        className={isDisabled ? 'opacity-40' : ''}
                      >
                        <TableCell className="text-xs font-medium">{row.subject}</TableCell>
                        <TableCell className="text-xs">{row.day}</TableCell>
                        <TableCell className="text-xs max-w-[250px]">
                          {isDisabled ? (
                            <span className="italic text-muted-foreground">No Assignment (auto-logic)</span>
                          ) : isEditing ? (
                            <Input
                              className="h-7 text-xs"
                              value={editingTitles[row.id]}
                              onChange={(e) => setEditingTitles((p) => ({ ...p, [row.id]: e.target.value }))}
                              onBlur={() => {
                                if (!editingTitles[row.id]?.trim()) {
                                  setEditingTitles((p) => {
                                    const n = { ...p };
                                    delete n[row.id];
                                    return n;
                                  });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setEditingTitles((p) => {
                                    const n = { ...p };
                                    delete n[row.id];
                                    return n;
                                  });
                                }
                              }}
                              autoFocus
                            />
                          ) : (
                            <div className="flex items-center gap-1">
                              <span>{row.title}</span>
                              <button
                                onClick={() => setEditingTitles((p) => ({ ...p, [row.id]: row.title }))}
                                className="opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                              >
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{row.groupName}</TableCell>
                        <TableCell className="text-xs text-center">{isDisabled ? '—' : row.points}</TableCell>
                        <TableCell className="text-xs text-center">
                          {isDisabled ? '—' : statusBadge(row.deploy_status)}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          {!isDisabled && (
                            <div className="flex items-center justify-end gap-1">
                              {row.canvas_url && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => window.open(row.canvas_url!, '_blank')}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                variant="deploy"
                                size="sm"
                                className="h-7 text-[11px] gap-1"
                                onClick={() => handleDeploy(row)}
                                disabled={deploying[row.id]}
                              >
                                <Rocket className="h-3 w-3" />
                                {deploying[row.id] ? '\u2026' : 'Deploy'}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {assignmentRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No pacing data for this week.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
