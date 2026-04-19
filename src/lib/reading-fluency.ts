/**
 * THALES OS — Reading Fluency Benchmarks
 * Dynamic fluency goal selection based on test number and semester progression.
 */

export interface FlexBenchmark {
  wpm: number;
  errors: number;
  label: string;
}

/**
 * Resolve the fluency benchmark for a given Reading Mastery Test number.
 * Tests scale up over the semester:
 *   Tests 1-7:   100 WPM, ≤2 errors
 *   Tests 8-10:  115 WPM, ≤2 errors
 *   Tests 11-13: 130 WPM, ≤2 errors
 *
 * @param testNum The Reading Mastery Test number (as string or number)
 * @param benchmarks Record of ranges to benchmark definitions (e.g., { "1-7": { wpm: 100, errors: 2 }, ... })
 * @returns FlexBenchmark with wpm, errors, and formatted label
 */
export function getReadingFluencyBenchmark(
  testNum: string | number,
  benchmarks: Record<string, { wpm: number; errors: number }>
): FlexBenchmark {
  const num = typeof testNum === 'string' ? parseInt(testNum, 10) : testNum;

  if (isNaN(num)) {
    // Fallback to highest/most recent benchmark
    return getDefaultBenchmark(benchmarks);
  }

  // Parse ranges and find matching benchmark
  const sortedRanges = Object.keys(benchmarks)
    .map(range => {
      const [min, max] = range.split('-').map(s => parseInt(s.trim(), 10));
      return { min, max, key: range };
    })
    .filter(r => !isNaN(r.min) && !isNaN(r.max))
    .sort((a, b) => a.min - b.min);

  for (const range of sortedRanges) {
    if (num >= range.min && num <= range.max) {
      const benchmark = benchmarks[range.key];
      return formatBenchmark(benchmark);
    }
  }

  // No match found; use highest benchmark (most rigorous)
  return getDefaultBenchmark(benchmarks);
}

/**
 * Get the highest/most recent benchmark (fallback when test number not found).
 */
function getDefaultBenchmark(benchmarks: Record<string, { wpm: number; errors: number }>): FlexBenchmark {
  const entries = Object.entries(benchmarks);

  if (entries.length === 0) {
    // Absolute fallback to defaults
    return {
      wpm: 100,
      errors: 2,
      label: '100 words per minute with 2 or fewer errors',
    };
  }

  // Get the last (highest) entry
  const [, lastBenchmark] = entries[entries.length - 1];
  return formatBenchmark(lastBenchmark);
}

/**
 * Format a benchmark into a human-readable label.
 */
function formatBenchmark(benchmark: { wpm: number; errors: number }): FlexBenchmark {
  const errorText = benchmark.errors === 1 ? 'error' : 'errors';
  const label = `${benchmark.wpm} words per minute with ${benchmark.errors} or fewer ${errorText}`;

  return {
    wpm: benchmark.wpm,
    errors: benchmark.errors,
    label,
  };
}
