import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { callEdge } from '@/lib/edge';
import { logDeployHabit } from '@/lib/teacher-memory';
import { sha256Hex } from '@/lib/utils';
import type { Week, CanvasPageRow, PacingRow } from '@/types/thales';
import type { AppConfig } from '@/lib/config';
import { generateCanvasPageHtml, generateHomeroomPageHtml, generateRedirectPageHtml } from '@/lib/canvas-html';
import { filterTogetherPageRows, resolveTogetherCourseId } from '@/lib/together-logic';
import type { PreviewRow } from '@/pages/AssignmentsPage';
import type { AnnouncementDraft } from '@/types/thales';

// ... (Keep the types from usePageDeployments and useDeployAssignments)

export function useDeployments() {
  const queryClient = useQueryClient();

  const deployAssignmentMutation = useMutation({
    mutationFn: async (targets: PreviewRow[]) => {
      const results: Record<string, 'DEPLOYED' | 'NO_CHANGE' | 'ERROR'> = {};
      let ok = 0, fail = 0, skip = 0;

      for (const r of targets) {
        try {
          const res = await callEdge<{ status?: string; canvasUrl?: string; error?: string }>('canvas-deploy-assignment', {
            subject: r.subject,
            courseId: r.courseId,
            title: r.title,
            description: r.description,
            points: r.points,
            gradingType: r.gradingType,
            assignmentGroup: r.assignmentGroup,
            dueDate: r.dueDate || undefined,
            omitFromFinal: r.omitFromFinal,
            existingId: r.canvasUrl ? r.canvasUrl.split('/').pop() : undefined,
            rowId: r.rowId || undefined,
            contentHash: r.contentHash,
          });

          if (res.status === 'DEPLOYED') {
            results[r.rowKey] = 'DEPLOYED';
            ok++;
            logDeployHabit(r.subject).catch(console.error);
          } else if (res.status === 'NO_CHANGE') {
            results[r.rowKey] = 'NO_CHANGE';
            skip++;
          } else {
            results[r.rowKey] = 'ERROR';
            fail++;
          }
        } catch {
          results[r.rowKey] = 'ERROR';
          fail++;
        }
      }

      if (fail === 0 && skip === 0) toast.success(`Deployed ${ok} assignments to Canvas`);
      else if (fail === 0) toast.success(`Deployed ${ok}, skipped ${skip} unchanged`);
      else toast.warning(`Deployed ${ok}, skipped ${skip}, failed ${fail}`);

      return results;
    },
    onMutate: async (targets: PreviewRow[]) => {
      await queryClient.cancelQueries({ queryKey: ['pacing_rows'] });
      const previousPacingRows = queryClient.getQueryData(['pacing_rows']);
      queryClient.setQueryData(['pacing_rows'], (old: any) => {
        const newRows = old.map((row: any) => {
          const target = targets.find((t) => t.rowId === row.id);
          if (target) return { ...row, deploy_status: 'DEPLOYED' };
          return row;
        });
        return newRows;
      });
      return { previousPacingRows };
    },
    onError: (err, variables, context: any) => {
      if (context?.previousPacingRows) {
        queryClient.setQueryData(['pacing_rows'], context.previousPacingRows);
      }
      toast.error('Failed to deploy assignments');
    },
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: ['pacing_rows'] });
    },
  });

  const deployPageMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { subject, selectedWeek, rows, config, latestNewsletter, contentMap } = payload;
      let html = '';
      let courseId: number | undefined;
      const quarterColor = config.quarterColors[selectedWeek.quarter] || '#0065a7';
      const pageSlug = `q${selectedWeek.quarter.match(/(\d+)/)?.[1] || ''}w${selectedWeek.week_num}`;
      const pageTitle = `Q${selectedWeek.quarter.match(/(\d+)/)?.[1] || ''}W${selectedWeek.week_num}`;

      if (subject === 'Homeroom') {
        courseId = config.courseIds['Homeroom'];
        const tests = rows
          .filter((r) => r.type === 'Test' || (r.in_class || '').toLowerCase().includes('test'))
          .map((r) => `${r.day}: ${r.subject}${r.lesson_num ? ` \u2014 ${r.lesson_num}` : ''}`);
        html = generateHomeroomPageHtml({
          weekNum: selectedWeek.week_num,
          quarter: selectedWeek.quarter,
          dateRange: selectedWeek.date_range || '',
          quarterColor,
          reminders: selectedWeek.reminders || '',
          resources: selectedWeek.resources || '',
          homeroomNotes: latestNewsletter?.homeroom_notes || '',
          birthdays: latestNewsletter?.birthdays || '',
          upcomingTests: tests,
        });
      } else {
        const activeHs = selectedWeek.active_hs_subject;
        const isInactiveHs =
          (subject === 'History' || subject === 'Science') && activeHs && activeHs !== subject;

        if (isInactiveHs) {
          courseId = config.courseIds[subject];
          html = generateRedirectPageHtml({
            thisSubject: subject as 'History' | 'Science',
            activeSubject: activeHs as 'History' | 'Science',
            weekNum: selectedWeek.week_num,
            quarter: selectedWeek.quarter,
            dateRange: selectedWeek.date_range || '',
            quarterColor,
          });
        } else {
          const sRows = filterTogetherPageRows(rows, subject);
          if (sRows.length > 0) {
            courseId = resolveTogetherCourseId(subject) ?? config.courseIds[subject];
            html = generateCanvasPageHtml({
              subject: subject === 'Reading' ? 'Reading & Spelling' : subject,
              rows: sRows,
              quarter: selectedWeek.quarter,
              weekNum: selectedWeek.week_num,
              dateRange: selectedWeek.date_range || '',
              reminders: selectedWeek.reminders || '',
              resources: selectedWeek.resources || '',
              quarterColor,
              contentMap,
            });
          }
        }
      }

      if (courseId && html) {
        await logDeployHabit('page', subject, html);
        const hash = await sha256Hex(html);
        const res: { status: string; error?: string } = await callEdge('canvas-deploy-page', {
          subject,
          courseId,
          pageUrl: pageSlug,
          pageTitle,
          bodyHtml: html,
          published: config.autoLogic.pagePublishDefault,
          setFrontPage: true,
          weekId: selectedWeek.id,
          contentHash: hash,
        });

        if (res.status === 'SKIPPED') {
          toast.info(`${subject} page skipped`, { description: 'Content has not changed.' });
        } else if (res.status === 'DEPLOYED' || res.status === 'REPAIRED') {
          toast.success(`${subject} page deployed`);
        } else {
          throw new Error(res.error || 'Unknown error');
        }
      }
    },
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: ['deploy_log'] });
    },
    onError: (e: Error, variables: any) => {
      toast.error(`Failed to deploy ${variables.subject}`, { description: e.message });
    },
  });

  const deployAnnouncementMutation = useMutation({
    mutationFn: async (ann: AnnouncementDraft) => {
      if (!ann.course_id || !ann.title) {
        throw new Error('Missing course ID or title');
      }
      return callEdge('canvas-post-announcement', {
        courseId: ann.course_id,
        title: ann.title,
        message: ann.content,
        announcementId: ann.id,
      });
    },
    onSuccess: () => {
      toast.success('Announcement posted successfully!');
      return queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (e: Error) => {
      toast.error('Failed to post announcement', { description: e.message });
    },
  });

  return {
    deployAssignments: deployAssignmentMutation.mutateAsync,
    isDeployingAssignments: deployAssignmentMutation.isPending,
    deployPage: deployPageMutation.mutateAsync,
    isDeployingPage: deployPageMutation.isPending,
    deployAnnouncement: deployAnnouncementMutation.mutateAsync,
    isDeployingAnnouncement: deployAnnouncementMutation.isPending,
  };
}
