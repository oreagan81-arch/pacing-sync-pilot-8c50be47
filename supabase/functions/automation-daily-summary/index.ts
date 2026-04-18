import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { runWithRetry } from '../_shared/retry.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const JOB_NAME = 'automation-daily-summary';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  const result = await runWithRetry(async () => {
    const today = DAYS[new Date().getDay()];

    const [{ data: rows }, { data: pending }, { data: snapshots }, { data: memories }] = await Promise.all([
      sb.from('pacing_rows').select('subject, type, lesson_num').eq('day', today),
      sb.from('pacing_rows').select('id', { count: 'exact' }).eq('deploy_status', 'PENDING'),
      sb.from('system_health_snapshots').select('score, created_at').order('created_at', { ascending: false }).limit(2),
      sb.from('teacher_memory').select('category, key').gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const tests = (rows ?? []).filter((r) => (r.type ?? '').toLowerCase().includes('test')).length;
    const subjects = Array.from(new Set((rows ?? []).map((r) => r.subject)));
    const pendingCount = pending?.length ?? 0;
    const score = snapshots?.[0]?.score ?? 100;
    const prevScore = snapshots?.[1]?.score ?? score;
    const delta = score - prevScore;
    const deltaStr = delta === 0 ? '' : delta > 0 ? ` (▲${delta})` : ` (▼${Math.abs(delta)})`;

    // simple risk
    let risk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (tests > 2 || pendingCount > 10) risk = 'HIGH';
    else if (tests > 1 || pendingCount > 5) risk = 'MEDIUM';

    const memoryInsight = memories && memories.length > 0
      ? `Learned ${memories.length} new pattern${memories.length === 1 ? '' : 's'} (${memories[0].category}).`
      : 'No new patterns learned overnight.';

    const lines = [
      `📅 ${today}: ${subjects.length} subjects, ${tests} test${tests === 1 ? '' : 's'}.`,
      `🚀 ${pendingCount} pending deploy${pendingCount === 1 ? '' : 's'}.`,
      `❤️ Health ${score}/100${deltaStr}.`,
      `⚠️ Risk: ${risk}.`,
      `🧠 ${memoryInsight}`,
    ];

    await sb.from('deploy_notifications').insert({
      level: 'info',
      title: `Good morning — ${today}'s plan`,
      message: lines.join('\n'),
    });

    return { today, tests, subjects: subjects.length, pendingCount, score, delta, risk, memoryInsight };
  }, { jobName: JOB_NAME });

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: result.success ? 200 : 500,
  });
});
