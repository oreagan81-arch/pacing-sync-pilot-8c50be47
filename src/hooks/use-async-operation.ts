import { useCallback, useState } from 'react';
import { toast } from 'sonner';

/**
 * Common pattern for async operations with auto-loading, error handling.
 * Saves 20+ lines per usage.
 */
export function useAsyncOperation() {
  const [loading, setLoading] = useState(false);

  const executeAsync = useCallback(async <T,>(
    fn: () => Promise<T>,
    options?: {
      onSuccess?: (result: T) => void;
      successMsg?: string;
      errorMsg?: string;
    }
  ): Promise<T | null> => {
    setLoading(true);
    try {
      const result = await fn();
      if (options?.successMsg) {
        toast.success(options.successMsg);
      }
      options?.onSuccess?.(result);
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      toast.error(options?.errorMsg || 'Operation failed', { description: message });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, executeAsync };
}
