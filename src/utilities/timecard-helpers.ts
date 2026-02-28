/**
 * Shared timecard utilities — used by buttons, auto-clockout, and payroll.
 */

/** Format minutes into a human-readable duration string. */
export function formatDuration(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

/**
 * Convert a local ET date (year/month/day) + time-of-day to a proper UTC Date,
 * accounting for EST vs EDT automatically.
 *
 * Works by constructing the target date string in ET, parsing with Intl to find
 * the real UTC offset, then applying it.
 */
function etToUTC(year: number, month: number, day: number, hour = 0, min = 0): Date {
  // Build an approximate UTC date, then use Intl to find the real ET offset
  const approx = new Date(Date.UTC(year, month, day, hour + 5, min)); // rough EST guess
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(approx);

  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? '0', 10);
  const etHour = get('hour');
  // The offset in hours = etHour - hour (mod 24)
  // But it's easier: compute the difference between what we wanted and what we got
  const etDate = new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')));
  const offsetMs = etDate.getTime() - approx.getTime();

  // The actual UTC time = target ET time + offset from UTC
  // offsetMs = ET - UTC, so UTC = targetET - offset... but we need to think about this more carefully.
  // approx is in UTC, etDate is what ET shows for that UTC moment.
  // We want: the UTC moment where ET clock shows (year, month, day, hour, min).
  // etDate shows what the ET clock shows for `approx`.
  // Difference: etDate - target = how far off we are.
  const targetET = Date.UTC(year, month, day, hour, min, 0);
  const drift = etDate.getTime() - targetET;
  return new Date(approx.getTime() - drift);
}

/**
 * Get the Monday 00:00 ET → next Monday 00:00 ET boundaries for the current week.
 * Properly handles EST/EDT transitions.
 */
export function getWeekBoundsET(): { monday: Date; nextMonday: Date } {
  // Get current date in ET
  const nowStr = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const now = new Date(nowStr);

  const dayOfWeek = now.getDay(); // 0=Sun
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const mondayLocal = new Date(now);
  mondayLocal.setDate(mondayLocal.getDate() - daysFromMonday);

  const nextMondayLocal = new Date(mondayLocal);
  nextMondayLocal.setDate(nextMondayLocal.getDate() + 7);

  const monday = etToUTC(mondayLocal.getFullYear(), mondayLocal.getMonth(), mondayLocal.getDate());
  const nextMonday = etToUTC(nextMondayLocal.getFullYear(), nextMondayLocal.getMonth(), nextMondayLocal.getDate());

  return { monday, nextMonday };
}

/**
 * Get pay period bounds: previous Monday 00:00 ET through Sunday 00:00 ET.
 * Called on Saturday night, covers Mon–Sat inclusive.
 */
export function getPayPeriodBoundsET(): { start: Date; end: Date; startLocal: Date; endLocal: Date } {
  const nowStr = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const now = new Date(nowStr);

  // Saturday = day 6, previous Monday = 5 days ago
  const dayOfWeek = now.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const prevMonday = new Date(now);
  prevMonday.setDate(prevMonday.getDate() - daysFromMonday);

  // End = Sunday (day after Saturday) = tomorrow
  const sunday = new Date(now);
  sunday.setDate(sunday.getDate() + 1);

  const start = etToUTC(prevMonday.getFullYear(), prevMonday.getMonth(), prevMonday.getDate());
  const end = etToUTC(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());

  return { start, end, startLocal: prevMonday, endLocal: sunday };
}
