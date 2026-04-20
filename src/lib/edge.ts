import { supabase } from '@/integrations/supabase/client';

export async function callEdge<T>(fnName: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fnName, { body });
  if (error) {
    const msg = (error instanceof Error ? error.message : error?.message) || String(error) || 'Unknown error';
    throw new Error(`${fnName}: ${msg}`);
  }
  return data as T;
}
