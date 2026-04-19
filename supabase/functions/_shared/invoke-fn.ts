/**
 * Unified edge function invoker for automation jobs.
 * Used by automation-friday-deploy and automation-nightly to invoke other functions.
 * Handles auth, error reporting, and JSON parsing.
 */

export async function invokeFn<T = unknown>(
  supabaseUrl: string,
  serviceRole: string,
  name: string,
  body: unknown
): Promise<T> {
  const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRole}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`${name} → ${res.status}: ${text.slice(0, 200)}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    // If JSON parse fails, return text as-is (wrapped)
    return text as unknown as T;
  }
}
