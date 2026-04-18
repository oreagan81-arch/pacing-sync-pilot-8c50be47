import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const adminClient = () => createClient(SUPABASE_URL, SERVICE_ROLE);

export interface RetryOptions {
  jobName: string;
  maxRetries?: number;
  backoffMs?: number[];
}

export async function runWithRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<{ success: boolean; result?: T; error?: string; attempts: number }> {
  const { jobName, maxRetries = 3, backoffMs = [2000, 8000, 30000] } = opts;
  const sb = adminClient();

  // mark running
  await sb.from('automation_jobs').update({
    status: 'running',
    last_run: new Date().toISOString(),
  }).eq('job_name', jobName);

  let lastError = '';
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fn();
      await sb.from('automation_jobs').update({
        status: 'idle',
        retry_count: 0,
        last_result: { success: true, attempts: attempt + 1, at: new Date().toISOString() },
      }).eq('job_name', jobName);
      return { success: true, result, attempts: attempt + 1 };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.error(`[${jobName}] attempt ${attempt + 1} failed:`, lastError);
      await sb.from('automation_jobs').update({
        retry_count: attempt + 1,
        status: 'retrying',
      }).eq('job_name', jobName);
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, backoffMs[attempt] ?? 30000));
      }
    }
  }

  // all retries failed
  await sb.from('automation_jobs').update({
    status: 'error',
    last_result: { success: false, error: lastError, attempts: maxRetries, at: new Date().toISOString() },
  }).eq('job_name', jobName);

  await sb.from('deploy_notifications').insert({
    level: 'error',
    title: `${jobName} failed`,
    message: `Failed after ${maxRetries} attempts: ${lastError}`,
    entity_ref: jobName,
  });

  await sb.from('deploy_log').insert({
    action: jobName,
    status: 'ERROR',
    message: `Failed after ${maxRetries} attempts: ${lastError}`,
  });

  return { success: false, error: lastError, attempts: maxRetries };
}
