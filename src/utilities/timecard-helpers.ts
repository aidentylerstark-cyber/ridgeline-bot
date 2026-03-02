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
  // Construct the desired ET datetime as a string, parse via toLocaleString round-trip
  // to find the correct UTC offset (handles EST/EDT automatically).
  const etStr = `${String(month + 1).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year} ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
  // Parse as if it were local time in ET using toLocaleString round-trip:
  // 1. Make a rough UTC guess (EST = UTC-5)
  const roughUtc = new Date(Date.UTC(year, month, day, hour + 5, min));
  // 2. Format that UTC instant as ET to see what ET shows
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(roughUtc);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? '0', 10);
  // What ET clock shows for roughUtc
  const etShowing = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  // What we want ET clock to show
  const targetET = Date.UTC(year, month, day, hour, min, 0);
  // Adjust: if ET is showing too high, roughUtc is too late
  return new Date(roughUtc.getTime() - (etShowing - targetET));
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
 * Get the previous week's Monday 00:00 ET → Monday 00:00 ET boundaries.
 */
export function getPreviousWeekBoundsET(): { monday: Date; nextMonday: Date } {
  const nowStr = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const now = new Date(nowStr);

  const dayOfWeek = now.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  // This week's Monday
  const thisMonday = new Date(now);
  thisMonday.setDate(thisMonday.getDate() - daysFromMonday);

  // Last week's Monday = this Monday - 7 days
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);

  const monday = etToUTC(lastMonday.getFullYear(), lastMonday.getMonth(), lastMonday.getDate());
  const nextMonday = etToUTC(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate());

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
