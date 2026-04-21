import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WeekOption {
  id: string;
  quarter: string;
  week_num: number;
}

export function useWeeksList() {
  return useQuery({
    queryKey: ['weeks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weeks')
        .select('id, quarter, week_num')
        .order('quarter')
        .order('week_num');
      
      if (error) throw error;
      return (data || []) as WeekOption[];
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}
