import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callEdge } from '@/lib/edge';
import { logDeployHabit } from '@/lib/teacher-memory';
import { toast } from 'sonner';
import type { PreviewRow } from '@/pages/AssignmentsPage';

interface DeployResult {
  status?: string;
  canvasUrl?: string;
  error?: string;
}

export function useDeployAssignments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targets: PreviewRow[]) => {
      const results: Record<string, 'DEPLOYED' | 'NO_CHANGE' | 'ERROR'> = {};
      let ok = 0, fail = 0, skip = 0;

      for (const r of targets) {
        try {
          const res = await callEdge<DeployResult>('canvas-deploy-assignment', {
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
            weekId: r.weekId || undefined,
            contentHash: r.contentHash,
            day: r.day,
            type: r.type,
            isSynthetic: r.isSynthetic,
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

      if (fail === 0 && skip === 0) {
        toast.success(`Deployed ${ok} assignments to Canvas`);
      } else if (fail === 0) {
        toast.success(`Deployed ${ok}, skipped ${skip} unchanged`);
      } else {
        toast.warning(`Deployed ${ok}, skipped ${skip}, failed ${fail}`);
      }

      return results;
    },
    onMutate: async (targets: PreviewRow[]) => {
      await queryClient.cancelQueries({ queryKey: ['pacing_rows'] });

      const previousPacingRows = queryClient.getQueryData(['pacing_rows']);

      queryClient.setQueryData(['pacing_rows'], (old: any) => {
        const newRows = old.map((row: any) => {
          const target = targets.find((t) => t.rowId === row.id);
          if (target) {
            return { ...row, deploy_status: 'DEPLOYED' };
          }
          return row;
        });
        return newRows;
      });

      return { previousPacingRows };
    },
    onError: (err, variables, context) => {
      if (context?.previousPacingRows) {
        queryClient.setQueryData(['pacing_rows'], context.previousPacingRows);
      }
      toast.error('Failed to deploy assignments');
    },
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: ['pacing_rows'] });
    },
  });
}
