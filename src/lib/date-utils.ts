/**
 * THALES OS — Date & Time Utilities (America/New_York)
 * Scheduling helpers for Eastern Time announcements with DST support.
 */

/** Day of week to numeric mapping. */
const DAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/** Eastern Time offset in hours for a given date (handles DST). */
function etOffsetHours(date: Date): number {
  // Use Intl to find ET offset; -5 EST or -4 EDT
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  });
  const parts = dtf.formatToParts(date);
  const tz = parts.find((p) => p.type === 'timeZoneName')?.value || 'EST';
  return tz === 'EDT' ? -4 : -5;
}

/** Build an ISO string for a given Y/M/D at HH:00 ET. */
function etDateAt(year: number, month: number, day: number, hour: number): string {
  const tmp = new Date(Date.UTC(year, month, day, hour, 0, 0));
  const offset = etOffsetHours(tmp);
  return new Date(Date.UTC(year, month, day, hour - offset, 0, 0)).toISOString();
}

/**
 * Get the next Friday at 4 PM ET.
 * If today is Friday, returns next Friday.
 */
export function getNextFriday4PM(): string {
  const now = new Date();
  const day = now.getDay();
  const daysUntilFriday = (5 - day + 7) % 7 || 7;
  const target = new Date(now);
  target.setDate(now.getDate() + daysUntilFriday);
  return etDateAt(target.getFullYear(), target.getMonth(), target.getDate(), 16);
}

/**
 * Get the previous Friday at 4 PM ET.
 * If today is Friday, returns this Friday.
 */
export function getPreviousFriday4PM(): string {
  const now = new Date();
  const day = now.getDay();
  const daysSinceFriday = (day - 5 + 7) % 7 || 7;
  const target = new Date(now);
  target.setDate(now.getDate() - daysSinceFriday);
  return etDateAt(target.getFullYear(), target.getMonth(), target.getDate(), 16);
}

/**
 * Get Wednesday before a given test day at 4 PM ET.
 * Used for immediate pre-test reminders.
 */
export function getWednesdayBefore(testDay: string): string {
  const targetDow = DAY_INDEX[testDay] ?? 5;
  const now = new Date();
  const today = now.getDay();
  // Find next occurrence of test day
  const daysUntilTest = (targetDow - today + 7) % 7 || 7;
  const test = new Date(now);
  test.setDate(now.getDate() + daysUntilTest);
  // Walk back to Wednesday before that test
  const back = (test.getDay() - 3 + 7) % 7 || 7;
  const wed = new Date(test);
  wed.setDate(test.getDate() - back);
  return etDateAt(wed.getFullYear(), wed.getMonth(), wed.getDate(), 16);
}

/**
 * Get exactly one week (7 days) before a given test day at 4 PM ET.
 * Used for early test announcements.
 */
export function getOneWeekBefore(testDay: string): string {
  const targetDow = DAY_INDEX[testDay] ?? 5;
  const now = new Date();
  const today = now.getDay();
  // Find next occurrence of test day
  const daysUntilTest = (targetDow - today + 7) % 7 || 7;
  const test = new Date(now);
  test.setDate(now.getDate() + daysUntilTest);
  // Go back exactly 7 days from the test date
  const oneWeekBefore = new Date(test);
  oneWeekBefore.setDate(test.getDate() - 7);
  return etDateAt(
    oneWeekBefore.getFullYear(),
    oneWeekBefore.getMonth(),
    oneWeekBefore.getDate(),
    16
  );
}

/**
 * Get exactly two days before a given test day at 4 PM ET.
 * Used for urgent/final prep announcements.
 */
export function getTwoDaysBefore(testDay: string): string {
  const targetDow = DAY_INDEX[testDay] ?? 5;
  const now = new Date();
  const today = now.getDay();
  // Find next occurrence of test day
  const daysUntilTest = (targetDow - today + 7) % 7 || 7;
  const test = new Date(now);
  test.setDate(now.getDate() + daysUntilTest);
  // Go back exactly 2 days from the test date
  const twoDaysBefore = new Date(test);
  twoDaysBefore.setDate(test.getDate() - 2);
  return etDateAt(
    twoDaysBefore.getFullYear(),
    twoDaysBefore.getMonth(),
    twoDaysBefore.getDate(),
    16
  );
}
