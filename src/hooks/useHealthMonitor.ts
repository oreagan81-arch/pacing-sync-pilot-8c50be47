import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DeployLogEntry {
  id: string;
  action: string | null;
  subject: string | null;
  status: string | null;
  message: string | null;
  canvas_url: string | null;
  created_at: string | null;
  week_id: string | null;
}

export interface Stats {
  total: number;
  deployed: number;
  errors: number;
  noChange: number;
}

export function useHealthMonitor() {
  const [logs, setLogs] = useState<DeployLogEntry[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, deployed: 0, errors: 0, noChange: 0 });
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  const computeStats = (entries: DeployLogEntry[]) => ({
    total: entries.length,
    deployed: entries.filter(l => l.status === 'DEPLOYED').length,
    errors: entries.filter(l => l.status === 'ERROR').length,
    noChange: entries.filter(l => l.status === 'NO_CHANGE').length,
  });

  const loadLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('deploy_log').select('*').order('created_at', { ascending: false }).limit(100);
    if (filter !== 'all') query = query.eq('action', filter);
    const { data } = await query;
    if (data) {
      setLogs(data);
      setStats(computeStats(data));
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  useEffect(() => {
    let isMounted = true;
    const channel = supabase
      .channel('deploy-log-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deploy_log' }, (payload) => {
        if (!isMounted) return;
        const newEntry = payload.new as DeployLogEntry;
        setLogs(prev => {
          const updated = [newEntry, ...prev].slice(0, 100);
          setStats(computeStats(updated));
          return updated;
        });
        
        const label = [newEntry.action?.replace(/_/g, ' '), newEntry.subject].filter(Boolean).join(' \u2014 ');
        if (newEntry.status === 'DEPLOYED') {
          toast.success(label, { description: newEntry.message || undefined });
        } else if (newEntry.status === 'ERROR') {
          toast.error(label, { description: newEntry.message || undefined });
        }
      })
      .subscribe((status) => {
        if (isMounted) {
          setConnected(status === 'SUBSCRIBED');
        }
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { logs, stats, filter, setFilter, loading, connected, loadLogs };
}
