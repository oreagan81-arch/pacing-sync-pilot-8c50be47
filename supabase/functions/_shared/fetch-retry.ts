/**
 * Unified fetch-with-retry for all edge functions.
 * Handles 429 (rate limit) and 5xx errors with exponential backoff.
 * Canonical backoff: [1000, 4000, 12000]ms (aligned with AWS/Canvas defaults)
 */

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  maxAttempts: number = 3
): Promise<Response> {
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);

      // Success: return immediately
      if (res.status < 500 && res.status !== 429) {
        return res;
      }

      // Retryable error: back off if attempts remain
      if (attempt < maxAttempts - 1) {
        const backoffMs = [1000, 4000, 12000][attempt];
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      // Final attempt: return error response
      return res;
    } catch (e) {
      lastErr = e;

      // Network error: try again if attempts remain  
      if (attempt < maxAttempts - 1) {
        const backoffMs = 1000 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastErr ?? new Error('fetchWithRetry: all attempts exhausted');
}
